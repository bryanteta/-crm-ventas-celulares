package com.crmcelulares.app;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Application;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlarmManager;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class ReminderSchedulerTest {
    private Application app;
    private AlarmManager alarms;
    private NotificationManager notifications;

    @Before
    public void prepare() {
        app = RuntimeEnvironment.getApplication();
        ReminderScheduler.prefs(app).edit().clear().commit();
        alarms = app.getSystemService(AlarmManager.class);
        notifications = app.getSystemService(NotificationManager.class);
        ReminderScheduler.createChannel(app);
    }

    private JSONObject row(String id, long at, String state) throws JSONException {
        return new JSONObject().put("id", id).put("client", "Ana")
                .put("model", "Galaxy Note").put("event", "Seguimiento")
                .put("state", state).put("at", at);
    }

    @Test
    public void createsAndReschedulesAnAlarmAtTheSavedTime() throws Exception {
        long time = System.currentTimeMillis() + 60000;
        ReminderScheduler.sync(app, new JSONArray().put(row("a", time, "Pendiente")));
        assertEquals(1, shadowOf(alarms).getScheduledAlarms().size());
        assertEquals(time, shadowOf(alarms).getScheduledAlarms().get(0).triggerAtTime);
        ReminderScheduler.sync(app, new JSONArray().put(row("a", time + 60000, "Pendiente")));
        assertEquals(1, shadowOf(alarms).getScheduledAlarms().size());
        assertEquals(time + 60000, shadowOf(alarms).getScheduledAlarms().get(0).triggerAtTime);
    }

    @Test
    public void completingOrDeletingCancelsAlarms() throws Exception {
        long time = System.currentTimeMillis() + 60000;
        ReminderScheduler.sync(app, new JSONArray().put(row("a", time, "Pendiente")));
        ReminderScheduler.sync(app, new JSONArray().put(row("a", time, "Completado")));
        assertTrue(shadowOf(alarms).getScheduledAlarms().isEmpty());
        ReminderScheduler.sync(app, new JSONArray().put(row("a", time, "En proceso")));
        ReminderScheduler.sync(app, new JSONArray());
        assertTrue(shadowOf(alarms).getScheduledAlarms().isEmpty());
    }

    @Test
    public void devicePreferencePausesOnlyThisPhonesAlarms() throws Exception {
        long time = System.currentTimeMillis() + 60000;
        ReminderScheduler.sync(app, new JSONArray().put(row("a", time, "Pendiente")));
        assertEquals(1, shadowOf(alarms).getScheduledAlarms().size());
        ReminderScheduler.prefs(app).edit().putBoolean("deviceRemindersEnabled", false).commit();
        ReminderScheduler.reschedule(app);
        assertTrue(shadowOf(alarms).getScheduledAlarms().isEmpty());
        assertTrue(ReminderScheduler.notificationsEnabled(app));
        assertFalse(ReminderScheduler.status(app).getBoolean("deviceEnabled"));
        assertEquals(0, ReminderScheduler.status(app).getInt("scheduled"));
        ReminderScheduler.sendTest(app);
        assertTrue(shadowOf(notifications).getAllNotifications().isEmpty());
        ReminderScheduler.prefs(app).edit().putBoolean("deviceRemindersEnabled", true).commit();
        ReminderScheduler.reschedule(app);
        assertEquals(1, shadowOf(alarms).getScheduledAlarms().size());
    }

    @Test
    public void reminderSurvivesRebootFromItsDurableMirror() throws Exception {
        long time = System.currentTimeMillis() + 60000;
        ReminderScheduler.sync(app, new JSONArray().put(row("a", time, "Pendiente")));
        alarms.cancel(shadowOf(alarms).getScheduledAlarms().get(0).operation);
        assertTrue(shadowOf(alarms).getScheduledAlarms().isEmpty());
        new RestoreRemindersReceiver().onReceive(app, new Intent(Intent.ACTION_BOOT_COMPLETED));
        assertEquals(time, shadowOf(alarms).getScheduledAlarms().get(0).triggerAtTime);
    }

    @Test
    public void deliveryPostsOnceAndOpensTheCorrectFollowup() throws Exception {
        long time = System.currentTimeMillis() - 1000;
        ReminderScheduler.sync(app, new JSONArray().put(row("id / con espacios", time, "Pendiente")));
        Intent trigger = ReminderScheduler.alarmIntent(app, "id / con espacios").putExtra("at", time);
        new ReminderReceiver().onReceive(app, trigger);
        Notification first = shadowOf(notifications).getAllNotifications().get(0);
        assertEquals("Seguimiento: Ana", first.extras.getString(Notification.EXTRA_TITLE));
        Intent open = shadowOf(first.contentIntent).getSavedIntent();
        assertEquals("id / con espacios", open.getData().getLastPathSegment());
        assertEquals("followup", open.getData().getHost());
        ReminderScheduler.deliver(app, trigger);
        assertEquals(1, shadowOf(notifications).getAllNotifications().size());
        ReminderScheduler.sync(app, new JSONArray().put(row("id / con espacios", time, "Pendiente")));
        assertTrue(shadowOf(alarms).getScheduledAlarms().isEmpty());
    }

    @Test
    public void staleBroadcastCannotNotifyAfterEditOrDeletion() throws Exception {
        long time = System.currentTimeMillis() - 1000;
        Intent stale = ReminderScheduler.alarmIntent(app, "a").putExtra("at", time);
        ReminderScheduler.sync(app, new JSONArray().put(row("a", time + 60000, "Pendiente")));
        ReminderScheduler.deliver(app, stale);
        assertTrue(shadowOf(notifications).getAllNotifications().isEmpty());
        ReminderScheduler.sync(app, new JSONArray());
        ReminderScheduler.deliver(app, stale);
        assertTrue(shadowOf(notifications).getAllNotifications().isEmpty());
    }

    @Test
    public void idsWithTheSameHashHaveIndependentAlarmsAndNotifications() throws Exception {
        assertEquals("Aa".hashCode(), "BB".hashCode());
        long time = System.currentTimeMillis() - 1000;
        ReminderScheduler.sync(app, new JSONArray().put(row("Aa", time, "Pendiente"))
                .put(row("BB", time, "Pendiente")));
        assertEquals(2, shadowOf(alarms).getScheduledAlarms().size());
        ReminderScheduler.deliver(app, ReminderScheduler.alarmIntent(app, "Aa").putExtra("at", time));
        ReminderScheduler.deliver(app, ReminderScheduler.alarmIntent(app, "BB").putExtra("at", time));
        assertEquals(2, shadowOf(notifications).getAllNotifications().size());
        ReminderScheduler.sync(app, new JSONArray().put(row("BB", time, "Pendiente")));
        assertEquals(1, shadowOf(notifications).getAllNotifications().size());
    }

    @Test
    public void invalidBatchPreservesExistingAlarm() throws Exception {
        long time = System.currentTimeMillis() + 60000;
        ReminderScheduler.sync(app, new JSONArray().put(row("a", time, "Pendiente")));
        assertThrows(JSONException.class, () -> ReminderScheduler.sync(app,
                new JSONArray().put(row("b", time, "Pendiente")).put(new JSONObject().put("id", "bad"))));
        assertEquals("a", ReminderScheduler.records(app).getJSONObject(0).getString("id"));
        assertEquals(1, shadowOf(alarms).getScheduledAlarms().size());
    }

    @Test
    public void ignoresOldOverdueContactsAndRecoversRecentMissedReminders() throws Exception {
        long now = System.currentTimeMillis();
        ReminderScheduler.sync(app, new JSONArray().put(row("old", now - ReminderScheduler.CATCH_UP - 1000, "Pendiente"))
                .put(row("recent", now - 60000, "Pendiente")));
        assertEquals(1, shadowOf(alarms).getScheduledAlarms().size());
    }

    @Test
    @Config(sdk = 31)
    public void fallsBackToInexactWithoutSpecialAccess() throws Exception {
        shadowOf(alarms).setCanScheduleExactAlarms(false);
        ReminderScheduler.sync(app, new JSONArray().put(row("a", System.currentTimeMillis() + 60000, "Pendiente")));
        ShadowAlarmManager.ScheduledAlarm alarm = shadowOf(alarms).getScheduledAlarms().get(0);
        assertTrue(alarm.allowWhileIdle);
        assertEquals(ShadowAlarmManager.WINDOW_HEURISTIC, alarm.getWindowLengthMs());
        assertFalse(ReminderScheduler.status(app).getBoolean("exact"));
        assertEquals(1, ReminderScheduler.status(app).getInt("scheduled"));
        shadowOf(alarms).setCanScheduleExactAlarms(true);
        ReminderScheduler.reschedule(app);
        assertTrue(ReminderScheduler.status(app).getBoolean("exact"));
        assertEquals(ShadowAlarmManager.WINDOW_EXACT,
                shadowOf(alarms).getScheduledAlarms().get(0).getWindowLengthMs());
    }

    @Test
    @Config(sdk = 33)
    public void requiresNotificationPermissionAndRecoversAfterGrant() throws Exception {
        shadowOf(app).denyPermissions(Manifest.permission.POST_NOTIFICATIONS);
        ReminderScheduler.sync(app, new JSONArray().put(row("a", System.currentTimeMillis() + 60000, "Pendiente")));
        assertTrue(shadowOf(alarms).getScheduledAlarms().isEmpty());
        assertFalse(ReminderScheduler.notificationsEnabled(app));
        ReminderScheduler.sendTest(app);
        assertTrue(shadowOf(notifications).getAllNotifications().isEmpty());
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        ReminderScheduler.reschedule(app);
        assertEquals(1, shadowOf(alarms).getScheduledAlarms().size());
        ReminderScheduler.sendTest(app);
        assertEquals(1, shadowOf(notifications).getAllNotifications().size());
    }
}
