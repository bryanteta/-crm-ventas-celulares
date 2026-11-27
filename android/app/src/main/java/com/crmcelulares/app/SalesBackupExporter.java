package com.crmcelulares.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/** Bounded, ordered transfer to private staging followed by the system document picker. */
final class SalesBackupExporter {
    static final int REQUEST=7315, IMPORT_REQUEST=7316;
    static final long LIMIT=128L*1024*1024;
    private final Activity activity;
    private final Consumer<JSONObject> sink;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private String importId; private String id; private File file; private OutputStream output; private MessageDigest digest;
    private long size,expected; private int index; private String hash; private boolean choosing,writing,closed;
    SalesBackupExporter(Activity activity,Consumer<JSONObject> sink){this.activity=activity;this.sink=sink;}
    static Intent intent(){return new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,"Lunivo-respaldo-ventas.json");}
    private void emit(String request,String status,String message){if(closed)return;try{JSONObject event=new JSONObject().put("type","backupExportResult").put("requestId",request).put("status",status).put("message",message);activity.runOnUiThread(()->{if(!closed)sink.accept(event);});}catch(Exception ignored){}}
    void handle(JSONObject request){worker.execute(()->{String req=request.optString("requestId");try{
        if(closed)return;String type=request.getString("type");
        if(type.equals("backupImport")){
            if(id!=null||importId!=null)throw new IllegalStateException("Termina la transferencia actual.");importId=req;activity.runOnUiThread(()->{try{activity.startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json"),IMPORT_REQUEST);}catch(Exception error){worker.execute(()->{importId=null;emit(req,"error","No se pudo abrir el selector de respaldos.");});}});return;
        }
        if(type.equals("backupExportBegin")){
            if(id!=null||importId!=null)throw new IllegalStateException("Termina o cancela la exportación actual.");
            long bytes=request.getLong("bytes");if(bytes<1||bytes>LIMIT||!request.optString("sha256").matches("[a-f0-9]{64}")||req.isEmpty())throw new IllegalArgumentException("Respaldo inválido o demasiado grande.");
            id=req;file=File.createTempFile("lunivo-recovery-",".json",activity.getCacheDir());output=new FileOutputStream(file);digest=MessageDigest.getInstance("SHA-256");id=req;expected=bytes;hash=request.getString("sha256");size=0;index=0;emit(req,"ready","");
        }else{
            if(!req.equals(id))throw new IllegalStateException("La exportación ya no está activa.");
            if(type.equals("backupExportCancel")){if(writing)throw new IllegalStateException("Espera a que termine el archivo.");clean();emit(req,"cancelled","Exportación cancelada.");return;}
            if(choosing||writing)throw new IllegalStateException("El archivo ya está en preparación.");
            if(type.equals("backupExportChunk")){
                String encoded=request.getString("chunk");if(encoded.length()>90000||request.getInt("index")!=index)throw new IllegalArgumentException("Parte fuera de orden.");byte[] bytes=Base64.decode(encoded,Base64.NO_WRAP);if(size+bytes.length>expected)throw new IllegalArgumentException("Tamaño inesperado.");output.write(bytes);digest.update(bytes);size+=bytes.length;index++;emit(req,"chunk","");
            }else if(type.equals("backupExportEnd")){
                output.close();output=null;StringBuilder actual=new StringBuilder();for(byte b:digest.digest())actual.append(String.format("%02x",b&255));if(size!=expected||!actual.toString().equals(hash))throw new IllegalArgumentException("El respaldo llegó incompleto.");choosing=true;activity.runOnUiThread(()->{try{activity.startActivityForResult(intent(),REQUEST);}catch(Exception error){worker.execute(()->{clean();emit(req,"error","No se pudo abrir el selector de archivos.");});}});
            }else throw new IllegalArgumentException("Acción desconocida.");
        }
    }catch(Exception error){if(req.equals(id)&&!writing)clean();emit(req,"error",error.getMessage()==null?"No se pudo exportar el respaldo.":error.getMessage());}});}
    boolean result(int request,int result,Intent data){
        if(request==IMPORT_REQUEST){Uri uri=data==null?null:data.getData();worker.execute(()->{String req=importId;if(req==null)return;try{
            if(result!=Activity.RESULT_OK||uri==null){emit(req,"cancelled","Importación cancelada.");return;}
            try(InputStream in=activity.getContentResolver().openInputStream(uri)){if(in==null)throw new IOException();byte[] buffer=new byte[49152];long total=0;int n,index=0;MessageDigest sha=MessageDigest.getInstance("SHA-256");while((n=in.read(buffer))!=-1){total+=n;if(total>LIMIT)throw new IOException("El archivo supera 128 MB.");sha.update(buffer,0,n);JSONObject event=new JSONObject().put("type","backupImportPart").put("requestId",req).put("index",index++).put("chunk",Base64.encodeToString(buffer,0,n,Base64.NO_WRAP));activity.runOnUiThread(()->{if(!closed)sink.accept(event);});}StringBuilder actual=new StringBuilder();for(byte b:sha.digest())actual.append(String.format("%02x",b&255));JSONObject event=new JSONObject().put("type","backupImportComplete").put("requestId",req).put("bytes",total).put("sha256",actual.toString());activity.runOnUiThread(()->{if(!closed)sink.accept(event);});}
        }catch(Exception error){emit(req,"error","No se pudo leer un respaldo completo y válido.");}finally{importId=null;}});return true;}
        if(request!=REQUEST)return false;Uri uri=data==null?null:data.getData();worker.execute(()->{String req=id;if(req==null||!choosing){emit(req==null?"":req,"error","La exportación se interrumpió. Vuelve a exportar.");return;}choosing=false;
        if(result!=Activity.RESULT_OK||uri==null){clean();emit(req,"cancelled","Exportación cancelada.");return;}writing=true;
        try{try(InputStream in=new FileInputStream(file);OutputStream out=activity.getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException();byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);out.flush();}clean();emit(req,"saved","Respaldo guardado. Conserva el archivo en privado.");}
        catch(Exception error){clean();emit(req,"error","No se pudo guardar el respaldo completo. Vuelve a exportar.");}finally{writing=false;}
    });return true;}
    private void clean(){try{if(output!=null)output.close();}catch(IOException ignored){}output=null;if(file!=null)file.delete();file=null;id=null;choosing=false;}
    void close(){closed=true;worker.execute(this::clean);worker.shutdown();}
}
