package com.crmcelulares.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

final class AppUpdater {
    static final String REPO="https://github.com/bryanteta/-crm-ventas-celulares/releases/download/";
    static final String RAW="https://raw.githubusercontent.com/bryanteta/-crm-ventas-celulares/lunivo-updates/";
    static final String API="https://api.github.com/repos/bryanteta/-crm-ventas-celulares/releases/latest";
    static final long MAX=50L*1024*1024;
    private final Activity activity;
    private final Consumer<JSONObject> sink;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Handler main=new Handler(Looper.getMainLooper());
    private JSONObject manifest;
    private volatile boolean busy,closed;
    private boolean downloaded;
    private String message="Busca nuevas versiones de Lunivo.";
    AppUpdater(Activity a,Consumer<JSONObject> s){activity=a;sink=s;try{String cached=a.getPreferences(0).getString("updateManifest","");if(!cached.isEmpty()){JSONObject m=new JSONObject(cached);validate(m);manifest=m;}}catch(Exception ignored){}}
    static void validate(JSONObject m)throws Exception{
        if(m.getInt("versionCode")<1||!m.getString("versionName").matches("[0-9]+\\.[0-9]+\\.[0-9]+")||!m.getString("sha256").matches("[0-9a-f]{64}"))throw new IOException("Invalid manifest");
        String url=m.getString("apkUrl");boolean raw=url.startsWith(RAW+"v"+m.getString("versionName")+"/")&&url.matches("https://raw\\.githubusercontent\\.com/bryanteta/-crm-ventas-celulares/lunivo-updates/v[0-9]+\\.[0-9]+\\.[0-9]+/[A-Za-z0-9._-]+\\.apk");if(!raw&&(!url.startsWith(REPO+"v"+m.getString("versionName")+"/")||!url.matches("https://github\\.com/bryanteta/-crm-ventas-celulares/releases/download/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+\\.apk")))throw new IOException("Invalid URL");
    }
    static boolean allowed(URL u){String h=u.getHost();return u.getProtocol().equals("https")&&(h.equals("api.github.com")||h.equals("github.com")||h.equals("release-assets.githubusercontent.com")||h.equals("objects.githubusercontent.com")||h.equals("raw.githubusercontent.com"));}
    private static void fetch(String address,OutputStream out,long limit)throws Exception{
        URL url=new URL(address);
        for(int n=0;n<6;n++){
            if(!allowed(url))throw new IOException("Untrusted redirect");HttpURLConnection c=(HttpURLConnection)url.openConnection();c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setInstanceFollowRedirects(false);c.setRequestProperty("User-Agent","Lunivo-Android");c.setRequestProperty("Accept","application/vnd.github+json");
            try{int status=c.getResponseCode();if(status>=300&&status<400){url=new URL(url,c.getHeaderField("Location"));continue;}if(status!=200)throw new IOException("HTTP "+status);if(c.getContentLengthLong()>limit)throw new IOException("Too large");try(InputStream in=c.getInputStream()){byte[] b=new byte[32768];long size=0;int len;while((len=in.read(b))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedException();size+=len;if(size>limit)throw new IOException("Too large");out.write(b,0,len);}}return;}finally{c.disconnect();}
        }throw new IOException("Redirect limit");
    }
    private static JSONObject json(String url)throws Exception{ByteArrayOutputStream b=new ByteArrayOutputStream();fetch(url,b,256*1024);return new JSONObject(b.toString("UTF-8"));}
    private File file(){return new File(activity.getCacheDir(),"updates/lunivo.apk");}
    void state(){if(closed)return;try{sink.accept(new JSONObject().put("type","updateStatus").put("busy",busy).put("available",manifest!=null&&manifest.getInt("versionCode")>BuildConfig.VERSION_CODE).put("downloaded",downloaded).put("version",manifest==null?"":manifest.getString("versionName")).put("installed",BuildConfig.VERSION_NAME).put("message",message));}catch(Exception ignored){}}
    void check(boolean force){
        if(closed||busy)return;long last=activity.getPreferences(0).getLong("updateCheck",0);if(!force&&System.currentTimeMillis()-last<24*60*60*1000L){state();return;}
        busy=true;message="Buscando actualizaciones…";state();worker.execute(()->{try{JSONObject release=json(API);String url=null;org.json.JSONArray assets=release.getJSONArray("assets");for(int n=0;n<assets.length();n++){JSONObject asset=assets.getJSONObject(n);if(asset.getString("name").equals("lunivo-update.json"))url=asset.getString("browser_download_url");}if(url==null){String tag=release.getString("tag_name");if(!tag.matches("v[0-9]+\\.[0-9]+\\.[0-9]+"))throw new IOException("Invalid tag");url=RAW+tag+"/lunivo-update.json";}else if(!url.startsWith(REPO))throw new IOException("Invalid manifest URL");JSONObject m=json(url);validate(m);main.post(()->{if(closed)return;boolean changed=manifest==null||!manifest.optString("sha256").equals(m.optString("sha256"));manifest=m;if(changed)downloaded=false;activity.getPreferences(0).edit().putString("updateManifest",m.toString()).putLong("updateCheck",System.currentTimeMillis()).apply();message=m.optInt("versionCode")>BuildConfig.VERSION_CODE?"Nueva versión disponible. Puedes descargarla sin borrar tus datos.":"Tienes la versión más reciente.";busy=false;state();});}catch(Exception e){main.post(()->{message="No se pudo consultar GitHub. Revisa tu conexión y vuelve a buscar.";busy=false;state();});}});
    }
    void download(){if(closed||busy||manifest==null||manifest.optInt("versionCode")<=BuildConfig.VERSION_CODE)return;final JSONObject selected=manifest;busy=true;downloaded=false;message="Descargando actualización…";state();worker.execute(()->{File apk=file();try{if(!apk.getParentFile().isDirectory()&&!apk.getParentFile().mkdirs())throw new IOException();try(OutputStream out=new FileOutputStream(apk)){fetch(selected.getString("apkUrl"),out,MAX);}verify(apk,selected);main.post(()->{busy=false;downloaded=true;message="Descarga verificada. Pulsa Instalar actualización.";state();});}catch(Exception e){apk.delete();main.post(()->{busy=false;message="No se completó una descarga válida. Vuelve a descargarla.";state();});}});}
    @SuppressWarnings("deprecation")
    private void verify(File apk,JSONObject m)throws Exception{
        MessageDigest digest=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(apk)){byte[] b=new byte[32768];int n;while((n=in.read(b))!=-1)digest.update(b,0,n);}StringBuilder hex=new StringBuilder();for(byte v:digest.digest())hex.append(String.format(Locale.ROOT,"%02x",v&255));if(!hex.toString().equals(m.getString("sha256")))throw new IOException("Digest mismatch");
        PackageManager pm=activity.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;PackageInfo candidate=pm.getPackageArchiveInfo(apk.getAbsolutePath(),flags),current=pm.getPackageInfo(activity.getPackageName(),flags);
        if(candidate==null||!activity.getPackageName().equals(candidate.packageName)||!m.getString("versionName").equals(candidate.versionName)||candidate.versionCode!=m.getInt("versionCode")||candidate.versionCode<=BuildConfig.VERSION_CODE)throw new IOException("Wrong package/version");
        android.content.pm.Signature[] a=Build.VERSION.SDK_INT>=28?candidate.signingInfo.getApkContentsSigners():candidate.signatures,b=Build.VERSION.SDK_INT>=28?current.signingInfo.getApkContentsSigners():current.signatures;
        if(a==null||b==null||a.length!=b.length||a.length==0)throw new IOException("Missing signatures");Set<String> first=new HashSet<>(),second=new HashSet<>();for(android.content.pm.Signature s:a)first.add(s.toCharsString());for(android.content.pm.Signature s:b)second.add(s.toCharsString());if(!first.equals(second))throw new IOException("Signer mismatch");
    }
    void install(){if(closed||busy||!downloaded||manifest==null)return;if(!activity.getPackageManager().canRequestPackageInstalls()){try{activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));message="Autoriza a Lunivo y vuelve a pulsar Instalar actualización.";}catch(RuntimeException e){message="Autoriza la instalación desde Lunivo en los ajustes de Android.";}state();return;}
        busy=true;state();worker.execute(()->{try{verify(file(),manifest);main.post(()->{busy=false;if(closed||activity.isFinishing())return;if(!activity.hasWindowFocus()){message="Vuelve a Lunivo y pulsa Instalar actualización.";state();return;}try{Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".updates",file());activity.startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));message="Confirma la actualización en Android. Conserva la instalación y sus datos.";}catch(RuntimeException e){message="No se pudo abrir el instalador de Android. Vuelve a intentarlo.";}state();});}catch(Exception e){main.post(()->{busy=false;downloaded=false;message="La descarga ya no es válida. Descárgala de nuevo.";state();});}});
    }
    void close(){closed=true;worker.shutdownNow();}
}
