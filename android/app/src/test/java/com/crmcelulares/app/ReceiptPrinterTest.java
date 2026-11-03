package com.crmcelulares.app;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class ReceiptPrinterTest {
    private WebResourceRequest request(String url, boolean mainFrame) {
        return new WebResourceRequest() {
            public Uri getUrl(){return Uri.parse(url);}
            public boolean isForMainFrame(){return mainFrame;}
            public boolean isRedirect(){return false;}
            public boolean hasGesture(){return false;}
            public String getMethod(){return "GET";}
            public Map<String,String> getRequestHeaders(){return Collections.emptyMap();}
        };
    }
    @Test public void onlyBoundedDocumentAndNumericReceiptNamesAreAccepted() {
        assertTrue(ReceiptPrinter.validRequest("<!doctype html><html></html>", "Lunivo-2026-1001"));
        assertFalse(ReceiptPrinter.validRequest(null, "Lunivo-2026-1001"));
        assertFalse(ReceiptPrinter.validRequest("<script>alert(1)</script>", "Lunivo-2026-1001"));
        assertFalse(ReceiptPrinter.validRequest("<!doctype html>", "../client"));
        assertFalse(ReceiptPrinter.validRequest("<!doctype html>", null));
        assertFalse(ReceiptPrinter.validRequest("<!doctype html>" + new String(new char[200001]), "Lunivo-2026-1001"));
    }
    @Test public void mainDocumentComesFromMemoryAsHtmlNotBlockedNetwork() throws Exception {
        String html="<!doctype html><html>Garantía LUNIVO · 1101</html>";
        int[] callbacks={0,0};
        ReceiptPrinter.DocumentClient client=new ReceiptPrinter.DocumentClient(html,null,()->callbacks[0]++,()->callbacks[1]++);
        WebResourceResponse response=client.shouldInterceptRequest(null,request(ReceiptPrinter.DOCUMENT_URL,true));
        assertEquals(200,response.getStatusCode());assertEquals("text/html",response.getMimeType());assertEquals("UTF-8",response.getEncoding());
        assertEquals(html,new String(response.getData().readAllBytes(),StandardCharsets.UTF_8));
        assertTrue(response.getResponseHeaders().get("Content-Security-Policy").contains("default-src 'none'"));
        assertFalse(client.shouldOverrideUrlLoading(null,request(ReceiptPrinter.DOCUMENT_URL,true)));
        client.onPageFinished(null,ReceiptPrinter.DOCUMENT_URL);client.onPageFinished(null,ReceiptPrinter.DOCUMENT_URL);
        assertEquals(1,callbacks[0]);assertEquals(0,callbacks[1]);
    }
    @Test public void externalFilesAndDataNavigationsStayBlocked() {
        ReceiptPrinter.DocumentClient client=new ReceiptPrinter.DocumentClient("<!doctype html>",null,()->{},()->{});
        for(String url:new String[]{"https://example.com/receipt.html","file:///sdcard/private","content://private","about:srcdoc","data:text/html,fail"}) {
            assertTrue(url,client.shouldOverrideUrlLoading(null,request(url,true)));
            assertEquals(403,client.shouldInterceptRequest(null,request(url,true)).getStatusCode());
        }
    }
    @Test public void errorPageCannotBePrintedEvenIfPageFinishedFires() {
        int[] callbacks={0,0};
        ReceiptPrinter.DocumentClient client=new ReceiptPrinter.DocumentClient("<!doctype html>",null,()->callbacks[0]++,()->callbacks[1]++);
        client.shouldInterceptRequest(null,request(ReceiptPrinter.DOCUMENT_URL,true));
        client.onReceivedError(null,request(ReceiptPrinter.DOCUMENT_URL,true),null);
        client.onPageFinished(null,ReceiptPrinter.DOCUMENT_URL);
        assertEquals(0,callbacks[0]);assertEquals(1,callbacks[1]);
    }
    @Test public void httpErrorAndMissingDocumentNeverStartPrinting() {
        int[] callbacks={0,0};
        ReceiptPrinter.DocumentClient missing=new ReceiptPrinter.DocumentClient("<!doctype html>",null,()->callbacks[0]++,()->callbacks[1]++);
        missing.onPageFinished(null,ReceiptPrinter.DOCUMENT_URL);
        ReceiptPrinter.DocumentClient blocked=new ReceiptPrinter.DocumentClient("<!doctype html>",null,()->callbacks[0]++,()->callbacks[1]++);
        blocked.onReceivedHttpError(null,request(ReceiptPrinter.DOCUMENT_URL,true),new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Collections.emptyMap(),null));
        blocked.onPageFinished(null,ReceiptPrinter.DOCUMENT_URL);
        assertEquals(0,callbacks[0]);assertEquals(2,callbacks[1]);
    }
    @Test public void packagedLogoIsAvailableAndSubresourceErrorsDoNotReplaceDocument() throws Exception {
        int[] callbacks={0,0};
        WebViewAssetLoader assets=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(RuntimeEnvironment.getApplication())).build();
        ReceiptPrinter.DocumentClient client=new ReceiptPrinter.DocumentClient("<!doctype html>",assets,()->callbacks[0]++,()->callbacks[1]++);
        WebResourceResponse logo=client.shouldInterceptRequest(null,request(ReceiptPrinter.LOGO_URL,false));
        assertEquals("image/png",logo.getMimeType());assertEquals(137,logo.getData().read());
        client.shouldInterceptRequest(null,request(ReceiptPrinter.DOCUMENT_URL,true));
        client.onReceivedError(null,request("https://example.com/pixel",false),null);
        client.onPageFinished(null,ReceiptPrinter.DOCUMENT_URL);assertEquals(1,callbacks[0]);assertEquals(0,callbacks[1]);
    }
}
