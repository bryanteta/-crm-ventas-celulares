package com.crmcelulares.app;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class InventoryBridgeCatalogTest {
    static final String KEY="catalog-admin-key-".repeat(3);
    static class Connection extends HttpURLConnection {
        int code;String body;final ByteArrayOutputStream sent=new ByteArrayOutputStream();
        Connection(URL url,int code,String body){super(url);this.code=code;this.body=body;}
        @Override public void connect(){}
        @Override public boolean usingProxy(){return false;}
        @Override public void disconnect(){}
        @Override public int getResponseCode(){return code;}
        @Override public String getContentType(){return "application/json";}
        @Override public InputStream getInputStream(){return new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8));}
        @Override public InputStream getErrorStream(){return getInputStream();}
        @Override public OutputStream getOutputStream(){return sent;}
    }
    private final List<Connection> opened=new ArrayList<>();
    private int sessionStatus=200;
    private InventoryBridge bridge() throws Exception {
        SecretKey key=KeyGenerator.getInstance("AES").generateKey();
        SharedPreferences split=RuntimeEnvironment.getApplication().getSharedPreferences("bridge-split",Context.MODE_PRIVATE),catalog=RuntimeEnvironment.getApplication().getSharedPreferences("bridge-catalog",Context.MODE_PRIVATE);
        split.edit().clear().commit();catalog.edit().clear().commit();
        CatalogHttp http=new CatalogHttp(url->{String path=url.getPath();Connection c=path.equals("/admin/session")?new Connection(url,sessionStatus,"{\"ok\":true}"):path.equals("/customizations.json")?new Connection(url,200,"{\"version\":1}"):new Connection(url,409,"{\"error\":\"Hay cambios más recientes.\"}");opened.add(c);return c;});
        return new InventoryBridge(new InventoryCredentials(split,()->key),new InventoryHttp(),new InventoryCredentials(catalog,()->key,InventoryCredentials.CATALOG_PATTERN,"invalid"),http);
    }
    private static JSONObject request(String type) throws Exception { return new JSONObject().put("id","r1").put("scope","account-one").put("type",type); }
    @Test public void catalogKeyIsVerifiedBeforeSavingAndKeptSeparateFromSplit() throws Exception {
        InventoryBridge bridge=bridge();
        sessionStatus=401;JSONObject rejected=bridge.process(request("catalogSaveKey").put("key",KEY));assertFalse(rejected.getBoolean("ok"));assertTrue(rejected.getString("message").contains("no es válida"));
        assertFalse(bridge.process(request("catalogState")).getBoolean("configured"));
        assertFalse(bridge.process(request("catalogSaveKey").put("key","short")).getBoolean("ok"));
        sessionStatus=200;assertTrue(bridge.process(request("catalogSaveKey").put("key",KEY)).getBoolean("configured"));
        assertTrue(bridge.process(request("catalogState")).getBoolean("configured"));assertFalse(bridge.process(request("state")).getBoolean("configured"));
        assertEquals("Bearer "+KEY,opened.get(opened.size()-1).getRequestProperty("Authorization"));
        assertFalse(bridge.process(request("catalogClearKey")).getBoolean("configured"));assertFalse(bridge.process(request("catalogState")).getBoolean("configured"));
    }
    @Test public void editsRequireTheSavedKeyAndReturnWorkerStatus() throws Exception {
        InventoryBridge bridge=bridge();
        JSONObject missing=bridge.process(request("catalogEdit").put("method","PUT").put("body","{}"));assertFalse(missing.getBoolean("ok"));assertTrue(missing.getString("message").contains("Ajustes"));
        bridge.process(request("catalogSaveKey").put("key",KEY));
        JSONObject conflict=bridge.process(request("catalogEdit").put("method","PUT").put("body","{\"key\":\"a\"}"));assertTrue(conflict.getBoolean("ok"));assertEquals(409,conflict.getInt("status"));
        assertFalse(bridge.process(request("catalogEdit").put("method","POST").put("body","{}")).getBoolean("ok"));
        JSONObject read=bridge.process(request("catalogRead"));assertTrue(read.getBoolean("ok"));assertEquals("{\"version\":1}",read.getString("body"));
        assertNull(opened.get(opened.size()-1).getRequestProperty("Authorization"));
    }
}
