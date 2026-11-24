package com.crmcelulares.app;
import org.junit.Test;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import static org.junit.Assert.*;

public class CatalogHttpTest {
    static class Connection extends HttpURLConnection {
        int code=200;String contentType="application/json; charset=utf-8";byte[] body="{}".getBytes(StandardCharsets.UTF_8);boolean closed;long declaredSize=-1;final ByteArrayOutputStream sent=new ByteArrayOutputStream();
        Connection(URL url){super(url);}
        @Override public void connect(){}
        @Override public boolean usingProxy(){return false;}
        @Override public void disconnect(){closed=true;}
        @Override public int getResponseCode(){return code;}
        @Override public String getContentType(){return contentType;}
        @Override public long getContentLengthLong(){return declaredSize;}
        @Override public InputStream getInputStream() throws IOException {if(code>=400)throw new IOException("error stream expected");return new ByteArrayInputStream(body);}
        @Override public InputStream getErrorStream(){return new ByteArrayInputStream(body);}
        @Override public OutputStream getOutputStream(){return sent;}
    }
    private static CatalogHttp client(List<Connection> opened, java.util.function.Consumer<Connection> setup){
        return new CatalogHttp(url->{Connection c=new Connection(url);setup.accept(c);opened.add(c);return c;});
    }
    @Test public void publicPricesNeverCarryTheAdministrationKey() throws Exception {
        List<Connection> opened=new ArrayList<>();CatalogHttp http=client(opened,c->c.body="{\"version\":1}".getBytes(StandardCharsets.UTF_8));
        assertEquals("{\"version\":1}",http.customizations());Connection c=opened.get(0);
        assertEquals(CatalogHttp.ORIGIN+"/customizations.json",c.getURL().toString());assertEquals("GET",c.getRequestMethod());assertNull(c.getRequestProperty("Authorization"));assertFalse(c.getInstanceFollowRedirects());assertTrue(c.closed);
    }
    @Test public void sessionDistinguishesWrongKeysFromOutages() throws Exception {
        List<Connection> opened=new ArrayList<>();
        assertTrue(client(opened,c->{}).session("k".repeat(40)));assertEquals("Bearer "+"k".repeat(40),opened.get(0).getRequestProperty("Authorization"));assertEquals(CatalogHttp.ORIGIN+"/admin/session",opened.get(0).getURL().toString());
        assertFalse(client(opened,c->c.code=401).session("k".repeat(40)));
        try{client(opened,c->c.code=429).session("k".repeat(40));fail();}catch(IOException e){assertTrue(e.getMessage().contains("cinco minutos"));}
        try{client(opened,c->{c.code=502;c.contentType="text/html";}).session("k".repeat(40));fail();}catch(IOException e){assertTrue(e.getMessage().contains("502"));}
    }
    @Test public void editsUseOnlyTheFixedPathAndReturnConflictsToTheApp() throws Exception {
        List<Connection> opened=new ArrayList<>();String body="{\"key\":\"x\",\"patch\":{\"priceCents\":49900,\"images\":[]}}";
        CatalogHttp.Result saved=client(opened,c->c.body="{\"version\":1}".getBytes(StandardCharsets.UTF_8)).edit("PUT","k".repeat(40),body);
        assertEquals(200,saved.status);Connection c=opened.get(0);assertEquals(CatalogHttp.ORIGIN+"/admin/customizations",c.getURL().toString());assertEquals("PUT",c.getRequestMethod());assertEquals("application/json",c.getRequestProperty("Content-Type"));assertEquals(body,c.sent.toString("UTF-8"));
        CatalogHttp.Result conflict=client(opened,c2->{c2.code=409;c2.body="{\"error\":\"Hay cambios más recientes.\"}".getBytes(StandardCharsets.UTF_8);}).edit("DELETE","k".repeat(40),"{}");
        assertEquals(409,conflict.status);assertTrue(conflict.body.contains("más recientes"));
        for(String method:new String[]{"GET","POST","PATCH"}){try{client(opened,x->{}).edit(method,"k".repeat(40),"{}");fail();}catch(IOException expected){}}
        try{client(opened,x->{}).edit("PUT","k".repeat(40),"x".repeat(CatalogHttp.MAX_BODY+1));fail();}catch(IOException expected){}
        try{client(opened,x->{}).edit("PUT","","{}");fail();}catch(IOException e){assertTrue(e.getMessage().contains("Ajustes"));}
    }
    @Test public void redirectsUnexpectedContentAndOversizedResponsesAreRejected() throws Exception {
        List<Connection> opened=new ArrayList<>();
        for(int code:new int[]{301,302,307,308}){try{client(opened,c->c.code=code).customizations();fail();}catch(IOException e){assertTrue(e.getMessage().contains("redirigió"));}}
        try{client(opened,c->c.contentType="text/html").customizations();fail();}catch(IOException expected){}
        try{client(opened,c->c.declaredSize=CatalogHttp.MAX_BYTES+1L).customizations();fail();}catch(IOException expected){}
        try{client(opened,c->c.body=new byte[CatalogHttp.MAX_BYTES+1]).customizations();fail();}catch(IOException expected){}
        for(Connection c:opened)assertTrue(c.closed);
    }
}
