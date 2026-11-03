package com.crmcelulares.app;
import android.app.NotificationManager;
import android.media.AudioManager;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class LaunchSoundTest {
 @Test public void quietModesAndVolumeAreAlwaysRespected(){
  assertTrue(LaunchSound.allowed(true,AudioManager.RINGER_MODE_NORMAL,NotificationManager.INTERRUPTION_FILTER_ALL,5));
  assertFalse(LaunchSound.allowed(false,AudioManager.RINGER_MODE_NORMAL,NotificationManager.INTERRUPTION_FILTER_ALL,5));
  assertFalse(LaunchSound.allowed(true,AudioManager.RINGER_MODE_SILENT,NotificationManager.INTERRUPTION_FILTER_ALL,5));
  assertFalse(LaunchSound.allowed(true,AudioManager.RINGER_MODE_VIBRATE,NotificationManager.INTERRUPTION_FILTER_ALL,5));
  for(int mode:new int[]{NotificationManager.INTERRUPTION_FILTER_NONE,NotificationManager.INTERRUPTION_FILTER_PRIORITY,NotificationManager.INTERRUPTION_FILTER_ALARMS})assertFalse(LaunchSound.allowed(true,AudioManager.RINGER_MODE_NORMAL,mode,5));
  assertFalse(LaunchSound.allowed(true,AudioManager.RINGER_MODE_NORMAL,NotificationManager.INTERRUPTION_FILTER_ALL,0));
 }
 @Test public void preferenceSurvivesAnewPlayerInstance(){
  LaunchSound first=new LaunchSound(RuntimeEnvironment.getApplication());assertTrue(first.enabled());first.enabled(false);
  assertFalse(new LaunchSound(RuntimeEnvironment.getApplication()).enabled());first.enabled(true);assertTrue(new LaunchSound(RuntimeEnvironment.getApplication()).enabled());
 }
}
