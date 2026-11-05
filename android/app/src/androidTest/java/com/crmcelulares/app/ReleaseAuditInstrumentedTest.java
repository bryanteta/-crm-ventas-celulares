package com.crmcelulares.app;

import static org.junit.Assert.*;

import android.app.NotificationManager;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONTokener;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.FileInputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Exercises the actual release WebView and native bridge without signing in or writing cloud data. */
@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 30)
public class ReleaseAuditInstrumentedTest {
    private ActivityScenario<MainActivity> scenario;
    private String savedAppearance;
    private WebView web(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group=(ViewGroup)view;
            for (int i=0;i<group.getChildCount();i++) { WebView child=web(group.getChildAt(i));if(child!=null)return child; }
        }
        return null;
    }
    private String js(String source) throws Exception {
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(activity->web(activity.getWindow().getDecorView()).evaluateJavascript(source,value->{result.set(value);done.countDown();}));
        assertTrue("WebView response",done.await(30,TimeUnit.SECONDS));
        return String.valueOf(new JSONTokener(result.get()).nextValue());
    }
    private void until(String condition) throws Exception {
        long end=SystemClock.elapsedRealtime()+30000;
        do { if("true".equals(js("Boolean("+condition+")")))return;SystemClock.sleep(100); }while(SystemClock.elapsedRealtime()<end);
        fail("Timed out: "+condition);
    }
    private void shell(String command) throws Exception {
        try(ParcelFileDescriptor descriptor=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
            FileInputStream input=new FileInputStream(descriptor.getFileDescriptor())) { byte[] buffer=new byte[1024];while(input.read(buffer)!=-1){} }
    }
    @Before public void open() throws Exception {
        if(android.os.Build.VERSION.SDK_INT>=33) InstrumentationRegistry.getInstrumentation().getUiAutomation()
                .grantRuntimePermission(InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName(),"android.permission.POST_NOTIFICATIONS");
        scenario=ActivityScenario.launch(MainActivity.class);
        until("document.readyState==='complete'&&window.LunivoSuite&&window.LunivoSettings");
        js("document.querySelector('#launch-skip').click();true");
        savedAppearance=js("localStorage.getItem('lunivo-appearance-v1')||'system'");
    }
    @After public void close() throws Exception {
        if(scenario!=null){try{if(savedAppearance!=null)js("LunivoSettings.open('app');document.querySelector('#appearance-mode').value="+org.json.JSONObject.quote(savedAppearance)+";document.querySelector('#appearance-mode').dispatchEvent(new Event('change'));true");}finally{scenario.close();}}
    }
    private void untilSystemTheme(boolean dark) throws Exception {
        long end=SystemClock.elapsedRealtime()+10000;java.util.concurrent.atomic.AtomicBoolean ready=new java.util.concurrent.atomic.AtomicBoolean();
        do{scenario.onActivity(activity->ready.set(((activity.getWindow().getInsetsController().getSystemBarsAppearance()&WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS)==0)==dark));if(ready.get())return;SystemClock.sleep(100);}while(SystemClock.elapsedRealtime()<end);
        fail("System bar appearance did not update");
    }
    @Test public void androidBackClosesNestedHelpAndPickerWithoutNavigatingOrDroppingDraft() throws Exception {
        js("location.hash='#registro';document.querySelector('#form [name=client]').value='Borrador de revisión';true");
        until("location.hash==='#registro'");
        js("document.querySelector('#module-open').click();document.querySelector('[data-help=sales-space]').click();true");
        until("document.querySelector('#context-help-dialog').open");
        shell("input keyevent 4");until("!document.querySelector('#context-help-dialog').open");
        assertEquals("true",js("document.querySelector('#module-dialog').open"));
        assertEquals("#registro",js("location.hash"));
        shell("input keyevent 4");until("!document.querySelector('#module-dialog').open");
        assertEquals("#registro",js("location.hash"));
        assertEquals("Borrador de revisión",js("document.querySelector('#form [name=client]').value"));
    }
    @Test public void darkModeChangesActualSystemBarIconsAndRetainsSafeArea() throws Exception {
        js("LunivoSettings.open('app');true");until("document.querySelector('#settings-tab-app').getAttribute('aria-selected')==='true'");
        js("document.querySelector('#appearance-mode').value='dark';document.querySelector('#appearance-mode').dispatchEvent(new Event('change'));true");
        until("document.documentElement.dataset.theme==='dark'");
        untilSystemTheme(true);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        scenario.onActivity(activity->{
            View content=web(activity.getWindow().getDecorView());int[] position=new int[2];content.getLocationOnScreen(position);
            WindowInsets insets=activity.getWindow().getDecorView().getRootWindowInsets();assertNotNull(insets);
            assertTrue(position[1]>=insets.getInsets(WindowInsets.Type.statusBars()|WindowInsets.Type.displayCutout()).top);
            assertEquals(0,activity.getWindow().getInsetsController().getSystemBarsAppearance()&WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
        });
        assertEquals("true",js("document.querySelector('aside [data-theme-logo]').src.endsWith('lunivo-mark-dark.png')"));
        js("document.querySelector('#appearance-mode').value='light';document.querySelector('#appearance-mode').dispatchEvent(new Event('change'));true");
        until("document.documentElement.dataset.theme==='light'");untilSystemTheme(false);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        scenario.onActivity(activity->assertNotEquals(0,activity.getWindow().getInsetsController().getSystemBarsAppearance()&WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS));
    }
    @Test public void visibleNotificationTestButtonPostsThroughActualAndroidBridge() throws Exception {
        js("LunivoSettings.open('notifications');true");until("document.querySelector('#notification-test').getBoundingClientRect().height>0&&!document.querySelector('#notification-test').hidden");
        NotificationManager manager=InstrumentationRegistry.getInstrumentation().getTargetContext().getSystemService(NotificationManager.class);
        manager.cancel("test",1);
        try{
            js("document.querySelector('#notification-test').click();true");boolean found=false;long end=SystemClock.elapsedRealtime()+15000;
            do{for(android.service.notification.StatusBarNotification note:manager.getActiveNotifications())if("test".equals(note.getTag()))found=true;if(!found)SystemClock.sleep(100);}while(!found&&SystemClock.elapsedRealtime()<end);
            assertTrue("test notification actually posted",found);
        }finally{manager.cancel("test",1);}
    }
}
