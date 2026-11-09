package com.crmcelulares.app;
import org.junit.Test;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

public class InventoryHttpTest {
    static class Connection extends HttpURLConnection {
        int code=200;String contentType="application/json",location;byte[] body="{}".getBytes(StandardCharsets.UTF_8);boolean closed,streamOpened;long declaredSize=-1;
        Connection(URL url){super(url);}
        @Override public void connect(){}
        @Override public boolean usingProxy(){return false;}
        @Override public void disconnect(){closed=true;}
        @Override public int getResponseCode(){return code;}
        @Override public String getContentType(){return contentType;}
        @Override public String getHeaderField(String name){return "Location".equalsIgnoreCase(name)?location:null;}
        @Override public long getContentLengthLong(){return declaredSize;}
        @Override public InputStream getInputStream(){streamOpened=true;return new ByteArrayInputStream(body);}
    }
    @Test public void samuelNeverReceivesSplitCredential() throws Exception {
        Connection c=new Connection(new URL(InventoryHttp.SAMUEL));c.contentType="application/json; charset=utf-8";
        InventoryHttp client=new InventoryHttp(url->{assertEquals(InventoryHttp.SAMUEL,url.toString());return c;});
        assertEquals("{}",client.get("samuel","private-test-key"));assertNull(c.getRequestProperty("X-API-Key"));assertEquals("GET",c.getRequestMethod());assertEquals("application/json",c.getRequestProperty("Accept"));assertFalse(c.getInstanceFollowRedirects());assertTrue(c.closed);
    }
    @Test public void samuelFollowsGoogleContentRedirectWithoutCredentialAndPreservesUtf8() throws Exception {
        List<Connection> opened=new ArrayList<>();
        String expected="{\"message\":\"Categoría A · 👋\"}";
        InventoryHttp client=new InventoryHttp(url->{Connection c=new Connection(url);opened.add(c);if(opened.size()==1){c.code=302;c.location="https://script.googleusercontent.com/macros/echo?user_content_key=read-only";}else{assertEquals("script.googleusercontent.com",url.getHost());c.body=expected.getBytes(StandardCharsets.UTF_8);}return c;});
        assertEquals(expected,client.get("samuel","private-test-key"));assertEquals(2,opened.size());
        for(Connection c:opened){assertTrue(c.closed);assertNull(c.getRequestProperty("X-API-Key"));assertFalse(c.getInstanceFollowRedirects());assertTrue(c.getConnectTimeout()<=15000);assertTrue(c.getReadTimeout()<=20000);}
    }
    @Test public void samuelRejectsUntrustedRedirectsBeforeOpeningThem() throws Exception {
        for(String location:new String[]{"http://script.googleusercontent.com/macros/echo","https://script.googleusercontent.com.evil.test/","https://accounts.google.com/login","https://script.googleusercontent.com:444/","https://user:password@script.googleusercontent.com/","http://[",null,""}){
            AtomicInteger calls=new AtomicInteger();Connection c=new Connection(new URL(InventoryHttp.SAMUEL));c.code=302;c.location=location;
            InventoryHttp client=new InventoryHttp(url->{assertEquals(1,calls.incrementAndGet());return c;});
            try{client.get("samuel","private-test-key");fail();}catch(IOException e){assertFalse(e.getMessage().contains("private-test-key"));}
            assertEquals(1,calls.get());assertTrue(c.closed);assertFalse(c.streamOpened);
        }
    }
    @Test public void googleRedirectLoopsAreBoundedAndConnectionsClosed() throws Exception {
        List<Connection> opened=new ArrayList<>();
        InventoryHttp client=new InventoryHttp(url->{Connection c=new Connection(url);c.code=302;c.location=InventoryHttp.SAMUEL;opened.add(c);return c;});
        try{client.get("samuel","");fail();}catch(IOException expected){}
        assertEquals(InventoryHttp.MAX_REDIRECTS+1,opened.size());for(Connection c:opened)assertTrue(c.closed);
    }
    @Test public void splitUsesOnlyDocumentedHeaderAndNeverEchoesCredential() throws Exception {
        Connection c=new Connection(new URL(InventoryHttp.SPLIT));InventoryHttp client=new InventoryHttp(url->{assertEquals(InventoryHttp.SPLIT,url.toString());return c;});client.get("split","private-test-key");assertEquals("private-test-key",c.getRequestProperty("X-API-Key"));
        c.code=403;try{client.get("split","private-test-key");fail();}catch(IOException e){assertFalse(e.getMessage().contains("private-test-key"));assertTrue(e.getMessage().contains("clave"));}assertTrue(c.closed);
    }
    @Test public void splitCannotForwardCredentialOnRedirect() throws Exception {
        AtomicInteger calls=new AtomicInteger();Connection c=new Connection(new URL(InventoryHttp.SPLIT));c.code=302;c.location="https://script.googleusercontent.com/macros/echo";
        InventoryHttp client=new InventoryHttp(url->{assertEquals(1,calls.incrementAndGet());return c;});
        try{client.get("split","private-test-key");fail();}catch(IOException expected){}
        assertEquals(1,calls.get());assertTrue(c.closed);
    }
    @Test public void unknownProviderAndMissingKeyNeverOpenConnection() throws Exception {
        InventoryHttp client=new InventoryHttp(url->{throw new AssertionError("Network must not run");});for(String p:new String[]{"unknown","split"})try{client.get(p,"");fail();}catch(IOException expected){}
    }
    @Test public void htmlAndOversizedResponsesKeepPriorList() throws Exception {
        for(String provider:new String[]{"samuel","split"}){
            Connection c=new Connection(new URL("samuel".equals(provider)?InventoryHttp.SAMUEL:InventoryHttp.SPLIT));InventoryHttp client=new InventoryHttp(url->c);c.contentType="text/html";
            try{client.get(provider,"test-key");fail();}catch(IOException expected){}
            c.contentType="application/json";c.declaredSize=InventoryHttp.MAX_BYTES+1L;c.streamOpened=false;
            try{client.get(provider,"test-key");fail();}catch(IOException expected){}assertFalse(c.streamOpened);
            c.declaredSize=-1;c.body=new byte[InventoryHttp.MAX_BYTES+1];
            try{client.get(provider,"test-key");fail();}catch(IOException expected){}assertTrue(c.closed);
        }
    }
}
