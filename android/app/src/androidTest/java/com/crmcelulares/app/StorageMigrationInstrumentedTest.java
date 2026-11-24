package com.crmcelulares.app;

import static org.junit.Assert.*;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Uses an isolated storage key; never replaces a customer's local/account data. */
@RunWith(AndroidJUnit4.class)
public class StorageMigrationInstrumentedTest {
    private ActivityScenario<MainActivity> scenario;
    private WebView web(View view) {
        if(view instanceof WebView)return (WebView)view;
        if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++){WebView found=web(group.getChildAt(i));if(found!=null)return found;}}
        return null;
    }
    private String js(String source)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(activity->web(activity.getWindow().getDecorView()).evaluateJavascript(source,value->{result.set(value);latch.countDown();}));
        assertTrue(latch.await(30,TimeUnit.SECONDS));return String.valueOf(new JSONTokener(result.get()).nextValue());
    }
    private void until(String condition)throws Exception{
        long end=SystemClock.elapsedRealtime()+120000;
        while(SystemClock.elapsedRealtime()<end){if("true".equals(js("Boolean("+condition+")")))return;SystemClock.sleep(100);}
        fail("Storage migration did not finish: "+condition);
    }
    @Test public void migrateAndGrowThenRecreateWebView()throws Exception{
        scenario=ActivityScenario.launch(MainActivity.class);
        try{
            until("window.LunivoSuiteStore&&document.readyState==='complete'");
            js("window.migrationTestKey='lunivo-suite-preview-v1:instrumented-'+crypto.randomUUID();window.migrationExpected=JSON.stringify({sales:Array.from({length:1800},(_,i)=>({id:'m-'+i,client:'Prueba '+i,notes:'x'.repeat(2000)})),offers:[],inventory:[],receiptCounters:{'2026-11':1800}});localStorage.setItem(migrationTestKey,migrationExpected);window.migrationError='';LunivoSuiteStore.open(migrationTestKey).then(()=>{window.migrationOk=LunivoSuiteStore.peek(migrationTestKey)===migrationExpected;});true");
            until("window.migrationOk===true");assertEquals("null",js("localStorage.getItem(migrationTestKey)"));
            String key=js("migrationTestKey");
            js("(()=>{const d=JSON.parse(LunivoSuiteStore.peek(migrationTestKey));for(let i=1800;i<5000;i++)d.sales.push({id:'m-'+i,client:'Prueba '+i,notes:'x'.repeat(2000)});LunivoSuiteStore.write(migrationTestKey,d).then(()=>window.growthOk=true).catch(e=>window.migrationError=e.message);return true;})()");
            until("window.growthOk===true");assertEquals("5000",js("JSON.parse(LunivoSuiteStore.peek(migrationTestKey)).sales.length"));
            scenario.recreate();until("window.LunivoSuiteStore&&document.readyState==='complete'");
            js("LunivoSuiteStore.open("+org.json.JSONObject.quote(key)+").then(()=>{window.restoredCount=JSON.parse(LunivoSuiteStore.peek("+org.json.JSONObject.quote(key)+")).sales.length;});true");
            until("window.restoredCount===5000");
        }finally{if(scenario!=null)scenario.close();}
    }
}
