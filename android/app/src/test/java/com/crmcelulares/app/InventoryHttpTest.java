package com.crmcelulares.app;
import org.junit.Test;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.IOException;
import static org.junit.Assert.*;

public class InventoryHttpTest {
    static class Connection extends HttpURLConnection {
        int code=200;String contentType="application/json";byte[] body="{}".getBytes(java.nio.charset.StandardCharsets.UTF_8);boolean closed;
        Connection(URL url){super(url);}
        @Override public void connect(){}
        @Override public boolean usingProxy(){return false;}
        @Override public void disconnect(){closed=true;}
        @Override public int getResponseCode(){return code;}
        @Override public String getContentType(){return contentType;}
        @Override public long getContentLengthLong(){return -1;}
        @Override public InputStream getInputStream(){return new ByteArrayInputStream(body);}
    }
    @Test public void samuelNeverReceivesSplitCredential() throws Exception {
        Connection c=new Connection(new URL(InventoryHttp.SAMUEL));c.contentType="text/csv; charset=utf-8";
        InventoryHttp client=new InventoryHttp(url->{assertEquals(InventoryHttp.SAMUEL,url.toString());return c;});
        assertEquals("{}",client.get("samuel","private-test-key"));assertNull(c.getRequestProperty("X-API-Key"));assertEquals("GET",c.getRequestMethod());assertFalse(c.getInstanceFollowRedirects());assertTrue(c.closed);
    }
    @Test public void splitUsesOnlyDocumentedHeaderAndNeverEchoesCredential() throws Exception {
        Connection c=new Connection(new URL(InventoryHttp.SPLIT));InventoryHttp client=new InventoryHttp(url->{assertEquals(InventoryHttp.SPLIT,url.toString());return c;});client.get("split","private-test-key");assertEquals("private-test-key",c.getRequestProperty("X-API-Key"));
        c.code=403;try{client.get("split","private-test-key");fail();}catch(IOException e){assertFalse(e.getMessage().contains("private-test-key"));assertTrue(e.getMessage().contains("clave"));}assertTrue(c.closed);
    }
    @Test public void unknownProviderAndMissingKeyNeverOpenConnection() throws Exception {
        InventoryHttp client=new InventoryHttp(url->{throw new AssertionError("Network must not run");});for(String p:new String[]{"unknown","split"})try{client.get(p,"");fail();}catch(IOException expected){}
    }
    @Test public void redirectsHtmlAndOversizedStreamKeepPriorList() throws Exception {
        Connection c=new Connection(new URL(InventoryHttp.SPLIT));InventoryHttp client=new InventoryHttp(url->c);c.code=302;try{client.get("split","test-key");fail();}catch(IOException expected){}c.code=200;c.contentType="text/html";try{client.get("split","test-key");fail();}catch(IOException expected){}c.contentType="application/json";c.body=new byte[InventoryHttp.MAX_BYTES+1];try{client.get("split","test-key");fail();}catch(IOException expected){}assertTrue(c.closed);
    }
}
