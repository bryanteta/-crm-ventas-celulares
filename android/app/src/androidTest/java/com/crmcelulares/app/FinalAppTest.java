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
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.filters.SdkSuppress;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.After;
import org.junit.Before;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.MethodSorters;

import java.io.FileInputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Run on the installed RELEASE APK, after seeding the original 0.4.0 APK. */
@RunWith(AndroidJUnit4.class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
@SdkSuppress(minSdkVersion = 30)
public class FinalAppTest {
    private ActivityScenario<MainActivity> scenario;

    @Before
    public void open() throws Exception {
        scenario = ActivityScenario.launch(MainActivity.class);
        until("document.readyState==='complete' && !!window.LunivoApp", 60000);
    }

    @After
    public void close() {
        if (scenario != null) scenario.close();
    }

    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int n = 0; n < group.getChildCount(); n++) {
                WebView result = findWeb(group.getChildAt(n));
                if (result != null) return result;
            }
        }
        return null;
    }

    private String js(String script) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch ready = new CountDownLatch(1);
        scenario.onActivity(activity -> findWeb(activity.getWindow().getDecorView())
                .evaluateJavascript(script, value -> { result.set(value); ready.countDown(); }));
        assertTrue("WebView callback", ready.await(30, TimeUnit.SECONDS));
        Object decoded = new JSONTokener(result.get()).nextValue();
        return String.valueOf(decoded);
    }

    private void until(String condition, long timeout) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + timeout;
        do {
            if ("true".equals(js("Boolean(" + condition + ")"))) return;
            SystemClock.sleep(200);
        } while (SystemClock.elapsedRealtime() < deadline);
        fail("Timed out: " + condition);
    }

    private void safeViewport() {
        scenario.onActivity(activity -> {
            WebView web = findWeb(activity.getWindow().getDecorView());
            int[] position = new int[2]; web.getLocationOnScreen(position);
            WindowInsets insets = activity.getWindow().getDecorView().getRootWindowInsets();
            assertNotNull(insets);
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout());
            assertTrue("WebView is below the clock/camera", position[1] >= bars.top);
            assertTrue("WebView avoids the side cutout", position[0] >= bars.left);
            assertTrue("status bar remains visible", insets.isVisible(WindowInsets.Type.statusBars()));
            int appearance = activity.getWindow().getInsetsController().getSystemBarsAppearance();
            assertNotEquals("dark clock icons over the light safe area", 0,
                    appearance & WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
        });
    }

    private void shell(String command) throws Exception {
        try (ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation()
                .getUiAutomation().executeShellCommand(command);
             FileInputStream input = new FileInputStream(descriptor.getFileDescriptor())) {
            byte[] buffer = new byte[4096];
            while (input.read(buffer) != -1) { /* Wait for the command to complete. */ }
        }
    }

    @Test
    public void a_upgradePreservesEveryFixtureField() throws Exception {
        JSONArray rows = new JSONArray(js("JSON.stringify(LunivoApp.records().filter(r=>r.id.startsWith('upgrade-')).sort((a,b)=>a.id.localeCompare(b.id)))"));
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext()
                .getAssets().open("upgrade-records.json")) {
            byte[] buffer = new byte[4096]; int read;
            while ((read = input.read(buffer)) != -1) bytes.write(buffer, 0, read);
        }
        JSONArray expected = new JSONArray(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        assertEquals("all records survive the APK update", expected.length(), rows.length());
        for (int n = 0; n < expected.length(); n++) {
            JSONObject original = expected.getJSONObject(n), actual = rows.getJSONObject(n);
            assertEquals(original.length(), actual.length());
            Iterator<String> fields = original.keys();
            while (fields.hasNext()) {
                String field = fields.next();
                assertEquals(original.getString("id") + ": " + field, original.get(field), actual.get(field));
            }
        }
    }

    @Test
    public void b_statusBarAndSettingsOnTheReleaseApp() throws Exception {
        safeViewport();
        assertEquals("false", js("Boolean(document.querySelector('#cloud-panel').offsetParent)"));
        js("location.hash='#ajustes';'ok'");
        until("!document.querySelector('#ajustes').hidden", 10000);
        assertEquals("true", js("Boolean(document.querySelector('#cloud-open').offsetParent)"));
        assertEquals("false", js("Boolean(document.querySelector('#overview').offsetParent)"));
        assertFalse(BuildConfig.DEBUG);
    }

    @Test
    public void c_foldingKeepsDraftAndNativeSafeArea() throws Exception {
        AtomicReference<WebView> original = new AtomicReference<>();
        scenario.onActivity(activity -> original.set(findWeb(activity.getWindow().getDecorView())));
        js("location.hash='#registro';document.querySelector('#form [name=client]').value='Borrador Fold';'ok'");
        try {
            shell("wm size 1080x2520");
            until("innerWidth<600", 30000);
            assertEquals("Borrador Fold", js("document.querySelector('#form [name=client]').value"));
            safeViewport();
            shell("wm size 2184x1968");
            until("innerWidth>700", 30000);
            assertEquals("Borrador Fold", js("document.querySelector('#form [name=client]').value"));
            safeViewport();
            scenario.onActivity(activity -> assertSame(original.get(), findWeb(activity.getWindow().getDecorView())));
        } finally { shell("wm size reset"); }
    }

    @Test
    public void d_saveNoticeExpiresAndDataPersistsOnReopening() throws Exception {
        js("LunivoProfiles.save([{id:'instrumentation-user',name:'Usuario de pruebas',active:true}]);"
                + "localStorage.setItem('lunivo-selected-profile-v1:local','instrumentation-user');"
                + "location.hash='#registro';const f=document.querySelector('#form');f.reset();"
                + "for(const [k,v] of Object.entries({client:'Prueba final Android',phone:'71234567',model:'Galaxy',when:'2030-12-04T10:00'}))f.elements[k].value=v;"
                + "f.requestSubmit();'ok'");
        until("!document.querySelector('#notice').classList.contains('hidden')", 10000);
        until("document.querySelector('#notice').classList.contains('hidden')", 15000);
        scenario.close();
        scenario = ActivityScenario.launch(MainActivity.class);
        until("!!window.LunivoApp && LunivoApp.records().some(r=>r.client==='Prueba final Android')", 60000);
        assertEquals("3", js("String(LunivoApp.records().filter(r=>r.id.startsWith('upgrade-')).length)"));
    }

    @Test
    public void e_notificationButtonPostsAnActualAndroidNotification() throws Exception {
        js("location.hash='#ajustes';'ok'");
        until("!document.querySelector('#notification-test').hidden", 15000);
        js("document.querySelector('#notification-test').click();'ok'");
        NotificationManager manager = InstrumentationRegistry.getInstrumentation().getTargetContext()
                .getSystemService(NotificationManager.class);
        long deadline = SystemClock.elapsedRealtime() + 15000;
        boolean found = false;
        while (!found && SystemClock.elapsedRealtime() < deadline) {
            for (android.service.notification.StatusBarNotification note : manager.getActiveNotifications()) {
                if ("test".equals(note.getTag())) found = true;
            }
            if (!found) SystemClock.sleep(200);
        }
        assertTrue("the native notification is posted", found);
        manager.cancel("test", 1);
    }

    @Test
    public void f_alarmDeliversWithTheActivityClosed() throws Exception {
        android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("test device has exact-alarm permission", ReminderScheduler.exactEnabled(context));
        JSONArray previous = ReminderScheduler.records(context);
        long at = System.currentTimeMillis() + 15000;
        JSONObject reminder = new JSONObject().put("id", "instrumented-alarm").put("client", "Prueba final")
                .put("model", "Galaxy").put("event", "Seguimiento").put("state", "Pendiente").put("at", at);
        try {
            ReminderScheduler.sync(context, new JSONArray().put(reminder));
            scenario.close(); scenario = null;
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            long deadline = SystemClock.elapsedRealtime() + 35000;
            boolean found = false;
            while (!found && SystemClock.elapsedRealtime() < deadline) {
                for (android.service.notification.StatusBarNotification note : manager.getActiveNotifications()) {
                    if ("instrumented-alarm".equals(note.getTag())) found = true;
                }
                if (!found) SystemClock.sleep(250);
            }
            assertTrue("AlarmManager/BroadcastReceiver deliver without an open Activity", found);
            manager.cancel("instrumented-alarm", 1);
        } finally { ReminderScheduler.sync(context, previous); }
    }
}
