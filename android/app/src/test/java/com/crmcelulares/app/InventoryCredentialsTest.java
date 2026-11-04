package com.crmcelulares.app;
import android.content.Context;
import android.content.SharedPreferences;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class InventoryCredentialsTest {
    @Test public void credentialsEncryptedAndBoundToAccount() throws Exception {
        SharedPreferences prefs=RuntimeEnvironment.getApplication().getSharedPreferences("credential-test",Context.MODE_PRIVATE);prefs.edit().clear().commit();SecretKey key=KeyGenerator.getInstance("AES").generateKey();InventoryCredentials store=new InventoryCredentials(prefs,()->key);
        store.save("one","private-test-key");assertEquals("private-test-key",store.read("one"));assertFalse(prefs.getString("one","").contains("private-test-key"));assertEquals("",store.read("two"));prefs.edit().putString("two",prefs.getString("one","")).commit();try{store.read("two");fail();}catch(java.security.GeneralSecurityException expected){}
    }
    @Test public void forgettingAndInvalidInputsDoNotChangeOtherAccount() throws Exception {
        SharedPreferences prefs=RuntimeEnvironment.getApplication().getSharedPreferences("credential-test2",Context.MODE_PRIVATE);prefs.edit().clear().commit();SecretKey key=KeyGenerator.getInstance("AES").generateKey();InventoryCredentials store=new InventoryCredentials(prefs,()->key);store.save("one","private-test-key");store.save("two","other-test-key");store.clear("one");assertFalse(store.configured("one"));assertEquals("other-test-key",store.read("two"));try{store.save("two","bad\nheader");fail();}catch(IllegalArgumentException expected){}assertEquals("other-test-key",store.read("two"));try{store.read("../bad");fail();}catch(IllegalArgumentException expected){}
    }
}
