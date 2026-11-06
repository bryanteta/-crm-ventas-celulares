package com.crmcelulares.app;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class AppUpdaterTest {
 private JSONObject manifest()throws Exception{return new JSONObject().put("versionCode",36).put("versionName","1.7.1").put("sha256","a".repeat(64)).put("apkUrl",AppUpdater.REPO+"v1.7.1/lunivo.apk");}
 @Test public void officialManifestIsAccepted()throws Exception{AppUpdater.validate(manifest());}
 @Test public void foreignAndInsecureDownloadsAreRejected()throws Exception{for(String url:new String[]{"http://github.com/file.apk","https://example.com/app.apk",AppUpdater.REPO+"v1.7.1/app.apk?redirect=x",AppUpdater.REPO+"../app.apk"}){JSONObject m=manifest().put("apkUrl",url);assertThrows(Exception.class,()->AppUpdater.validate(m));}}
 @Test public void malformedDigestAndVersionAreRejected()throws Exception{JSONObject m=manifest().put("sha256","bad");assertThrows(Exception.class,()->AppUpdater.validate(m));JSONObject v=manifest().put("versionName","<script>");assertThrows(Exception.class,()->AppUpdater.validate(v));}
 @Test public void redirectsCannotLeaveTrustedHttpsHosts()throws Exception{assertTrue(AppUpdater.allowed(new java.net.URL("https://release-assets.githubusercontent.com/x")));assertFalse(AppUpdater.allowed(new java.net.URL("http://github.com/x")));assertFalse(AppUpdater.allowed(new java.net.URL("https://github.com.evil.test/x")));assertFalse(AppUpdater.allowed(new java.net.URL("https://127.0.0.1/x")));}
}
