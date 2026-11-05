package com.crmcelulares.app;

import android.content.Context;
import android.content.Intent;
import android.webkit.WebView;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class InventoryInstrumentedTest {
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    @Test public void realKeystoreEncryptsAndRecoversCredentialWithoutPlaintext() throws Exception {
        String scope="inventory-instrumented-account";InventoryCredentials credentials=new InventoryCredentials(context);
        try {credentials.save(scope,"instrumented-fake-key");assertEquals("instrumented-fake-key",credentials.read(scope));assertFalse(context.getSharedPreferences("lunivo-inventory-credentials",Context.MODE_PRIVATE).getString(scope,"").contains("instrumented-fake-key"));}
        finally {credentials.clear(scope);}assertFalse(credentials.configured(scope));
    }
    private String js(WebView view,String code) throws Exception {
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->view.evaluateJavascript(code,s->{result.set(s);done.countDown();}));assertTrue(done.await(10,TimeUnit.SECONDS));return result.get();
    }
    @Test public void packagedWebviewBridgeLoadsBothActualSupplierSnapshots() throws Exception {
        JSONObject snapshot;try(InputStream input=context.getAssets().open("www/assets/provider-bootstrap.json")){snapshot=new JSONObject(new String(input.readAllBytes(),StandardCharsets.UTF_8));}
        JSONObject providers=snapshot.getJSONObject("providers");int variants=providers.getJSONObject("samuel").getJSONArray("rows").length()+providers.getJSONObject("split").getJSONArray("rows").length();assertTrue(variants>0);
        MainActivity activity=(MainActivity)InstrumentationRegistry.getInstrumentation().startActivitySync(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
            java.lang.reflect.Field field=MainActivity.class.getDeclaredField("webView");field.setAccessible(true);WebView view=(WebView)field.get(activity);
            long end=SystemClock.elapsedRealtime()+20000;while(SystemClock.elapsedRealtime()<end&&!"true".equals(js(view,"Boolean(window.LunivoSuite&&window.LunivoInventoryAndroid)")))SystemClock.sleep(100);
            assertEquals("true",js(view,"Boolean(window.LunivoSuite&&window.LunivoInventoryAndroid)"));
            // Keep the packaged snapshot current during this offline test; do not query live providers.
            js(view,"Date.now=()=>"+java.time.Instant.parse(snapshot.getString("checkedAt")).toEpochMilli()+";window.LunivoSyncCanSave=()=>true;window.savedInventoryTestAccount=LunivoStore.account();LunivoProfiles.switchAccount('inventory-instrumented-test');LunivoStore.switchAccount('inventory-instrumented-test');LunivoApp.reload(true);location.hash='#ventas/proveedores';window.LunivoSuite.render();true");
            end=SystemClock.elapsedRealtime()+20000;while(SystemClock.elapsedRealtime()<end&&!String.valueOf(variants).equals(js(view,"document.querySelectorAll('#offers-list .suite-offer').length")))SystemClock.sleep(100);
            assertEquals(String.valueOf(variants),js(view,"document.querySelectorAll('#offers-list .suite-offer').length"));
            assertEquals("true",js(view,"document.querySelector('#feed-status').textContent.includes('Samuel')&&document.querySelector('#feed-status').textContent.includes('Saúl')&&document.querySelector('#feed-status').textContent.includes('Javier')"));
        } finally {InstrumentationRegistry.getInstrumentation().runOnMainSync(activity::finish);}
    }
}
