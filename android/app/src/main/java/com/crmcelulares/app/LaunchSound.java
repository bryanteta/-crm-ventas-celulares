package com.crmcelulares.app;

import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;

/** Optional, short startup sound; never changes system volume or bypasses quiet modes. */
final class LaunchSound {
    private final Context context;
    private MediaPlayer player;
    LaunchSound(Context context) { this.context = context.getApplicationContext(); }
    static boolean allowed(boolean enabled, int ringer, int interruption, int volume) {
        return enabled && ringer == AudioManager.RINGER_MODE_NORMAL
                && interruption == NotificationManager.INTERRUPTION_FILTER_ALL && volume > 0;
    }
    boolean enabled() { return context.getSharedPreferences("lunivo-launch", Context.MODE_PRIVATE).getBoolean("enabled", true); }
    void enabled(boolean value) { context.getSharedPreferences("lunivo-launch", Context.MODE_PRIVATE).edit().putBoolean("enabled", value).apply(); if (!value) stop(); }
    boolean available() {
        try {
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return audio != null && notifications != null && allowed(enabled(), audio.getRingerMode(),
                notifications.getCurrentInterruptionFilter(), audio.getStreamVolume(AudioManager.STREAM_SYSTEM));
        } catch (RuntimeException ignored) { return false; }
    }
    void play() {
        stop();
        if (!available()) return;
        try {
            AudioAttributes attrs = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            player = MediaPlayer.create(context, R.raw.lunivo_startup, attrs, AudioManager.AUDIO_SESSION_ID_GENERATE);
            if (player == null) return;
            player.setVolume(.45f, .45f);
            player.setOnCompletionListener(ignored -> stop());
            player.setOnErrorListener((ignored, what, extra) -> { stop(); return true; });
            player.start();
        } catch (RuntimeException ignored) { stop(); }
    }
    void stop() { if (player != null) { MediaPlayer old = player; player = null; try { old.release(); } catch (RuntimeException ignored) { /* Already stopped by the system. */ } } }
}
