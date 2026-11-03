package com.crmcelulares.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/** Durable local alarm mirror. The WebView remains the source of CRM records. */
public final class ReminderScheduler {
    static final String PREFS = "crm_reminders_v1";
    static final String CHANNEL = "client_followups";
    static final String ACTION = "com.crmcelulares.app.REMIND";
    static final long CATCH_UP = 24 * 60 * 60 * 1000L;

    private ReminderScheduler() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void createChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(CHANNEL,
                "Seguimientos de clientes", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Avisos de tus contactos y citas programadas.");
        channel.enableVibration(true);
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    public static boolean notificationsEnabled(Context context) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(
                Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
        return manager.areNotificationsEnabled()
                && (channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE);
    }

    public static boolean exactEnabled(Context context) {
        return Build.VERSION.SDK_INT < 31
                || context.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    public static boolean deviceEnabled(Context context) {
        return prefs(context).getBoolean("deviceRemindersEnabled", true);
    }

    static JSONArray records(Context context) {
        try {
            return new JSONArray(prefs(context).getString("records", "[]"));
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    /** Reject an invalid batch atomically, preserving the previous alarms and mirror. */
    public static synchronized void sync(Context context, JSONArray incoming) throws JSONException {
        if (incoming.length() > 10000) throw new JSONException("Demasiados recordatorios");
        JSONArray normalized = new JSONArray();
        Set<String> ids = new HashSet<>();
        for (int n = 0; n < incoming.length(); n++) {
            JSONObject row = incoming.getJSONObject(n);
            String id = text(row, "id", 200);
            String client = text(row, "client", 100);
            String model = text(row, "model", 100);
            String event = text(row, "event", 100);
            String state = text(row, "state", 30);
            Object value = row.get("at");
            if (!(value instanceof Number) || row.getDouble("at") != row.getLong("at")
                    || row.getLong("at") <= 0 || !ids.add(id)) {
                throw new JSONException("Fecha o identificador inválido");
            }
            if (!state.equals("Completado")) {
                normalized.put(new JSONObject().put("id", id).put("client", client)
                        .put("model", model).put("event", event).put("at", row.getLong("at")));
            }
        }
        JSONArray previous = records(context);
        SharedPreferences.Editor editor = prefs(context).edit().putString("records", normalized.toString());
        // A changed time is a new reminder; unchanged reminders are never delivered twice.
        for (int n = 0; n < previous.length(); n++) {
            JSONObject old = previous.getJSONObject(n);
            JSONObject next = find(normalized, old.getString("id"));
            if (next == null || next.getLong("at") != old.getLong("at")) {
                editor.remove("delivered:" + old.getString("id"));
            }
        }
        if (!editor.commit()) throw new JSONException("No se pudo guardar la programación");
        for (int n = 0; n < previous.length(); n++) {
            JSONObject old = previous.getJSONObject(n);
            String id = old.getString("id");
            cancelAlarm(context, id);
            JSONObject next = find(normalized, id);
            if (next == null || next.getLong("at") != old.getLong("at")) {
                context.getSystemService(NotificationManager.class).cancel(id, 1);
            }
        }
        reschedule(context);
    }

    private static String text(JSONObject object, String name, int limit) throws JSONException {
        Object value = object.get(name);
        if (!(value instanceof String) || ((String) value).trim().isEmpty()
                || ((String) value).length() > limit) throw new JSONException("Campo inválido: " + name);
        return (String) value;
    }

    static JSONObject find(JSONArray array, String id) {
        for (int n = 0; n < array.length(); n++) {
            JSONObject record = array.optJSONObject(n);
            if (record != null && id.equals(record.optString("id"))) return record;
        }
        return null;
    }

    static Intent alarmIntent(Context context, String id) {
        return new Intent(context, ReminderReceiver.class).setAction(ACTION)
                .setData(new Uri.Builder().scheme("crmcelulares").authority("reminder")
                        .appendPath(id).build());
    }

    private static void cancelAlarm(Context context, String id) {
        PendingIntent pending = PendingIntent.getBroadcast(context, 0, alarmIntent(context, id),
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pending != null) {
            context.getSystemService(AlarmManager.class).cancel(pending);
            pending.cancel();
        }
    }

    static boolean eligible(Context context, JSONObject record, long now) {
        String id = record.optString("id");
        long at = record.optLong("at");
        return at >= now - CATCH_UP && prefs(context).getLong("delivered:" + id, -1) != at;
    }

    public static synchronized int reschedule(Context context) {
        createChannel(context);
        JSONArray records = records(context);
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        int scheduled = 0;
        long now = System.currentTimeMillis();
        for (int n = 0; n < records.length(); n++) {
            JSONObject record = records.optJSONObject(n);
            if (record == null) continue;
            String id = record.optString("id");
            cancelAlarm(context, id);
            if (!deviceEnabled(context) || !notificationsEnabled(context) || !eligible(context, record, now)) continue;
            long at = record.optLong("at");
            PendingIntent pending = PendingIntent.getBroadcast(context, 0,
                    alarmIntent(context, id).putExtra("at", at),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            long trigger = Math.max(at, now + 1000);
            try {
                if (exactEnabled(context)) {
                    manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending);
                } else {
                    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending);
                }
            } catch (SecurityException revoked) {
                // Permission may be revoked between the check and the scheduling call.
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending);
            }
            scheduled++;
        }
        return scheduled;
    }

    public static JSONObject status(Context context) throws JSONException {
        int count = 0;
        long now = System.currentTimeMillis();
        JSONArray records = records(context);
        for (int n = 0; n < records.length(); n++) {
            JSONObject row = records.optJSONObject(n);
            if (row != null && eligible(context, row, now)) count++;
        }
        return new JSONObject().put("type", "status")
                .put("enabled", notificationsEnabled(context)).put("exact", exactEnabled(context))
                .put("deviceEnabled", deviceEnabled(context))
                .put("scheduled", notificationsEnabled(context) && deviceEnabled(context) ? count : 0);
    }

    // Flush the delivery marker before the receiver ends, including on process death.
    @SuppressLint("ApplySharedPref")
    public static synchronized void deliver(Context context, Intent intent) {
        if (!ACTION.equals(intent.getAction()) || intent.getData() == null) return;
        String id = intent.getData().getLastPathSegment();
        JSONObject record = find(records(context), id);
        if (record == null || record.optLong("at") != intent.getLongExtra("at", -1)
                || !deviceEnabled(context) || !notificationsEnabled(context) || !eligible(context, record, System.currentTimeMillis())) return;
        if (record.optLong("at") > System.currentTimeMillis()) {
            reschedule(context);
            return;
        }
        Notification notification = notification(context, id, "Seguimiento: " + record.optString("client"),
                record.optString("event") + " · " + record.optString("model"), record.optLong("at"));
        try {
            context.getSystemService(NotificationManager.class).notify(id, 1, notification);
            prefs(context).edit().putLong("delivered:" + id, record.optLong("at")).commit();
        } catch (SecurityException revoked) {
            // Keep it undelivered; enabling notifications can recover it within 24 hours.
        }
    }

    public static void sendTest(Context context) {
        if (!deviceEnabled(context) || !notificationsEnabled(context)) return;
        context.getSystemService(NotificationManager.class).notify("test", 1,
                notification(context, "", "Tus recordatorios están listos",
                        "Recibirás aquí los avisos de tus seguimientos.", System.currentTimeMillis()));
    }

    private static Notification notification(Context context, String id, String title, String text, long at) {
        createChannel(context);
        Intent open = new Intent(context, MainActivity.class)
                .setData(new Uri.Builder().scheme("crmcelulares").authority("followup").appendPath(id).build())
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification).setColor(0xFF275FE5)
                .setContentTitle(title).setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE)
                .setWhen(at).setShowWhen(true).setAutoCancel(true).setContentIntent(content).build();
    }
}
