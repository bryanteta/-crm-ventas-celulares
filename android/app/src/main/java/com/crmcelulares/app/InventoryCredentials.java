package com.crmcelulares.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class InventoryCredentials {
    interface Keys { SecretKey get() throws GeneralSecurityException; }
    private final SharedPreferences prefs;
    private final Keys keys;
    InventoryCredentials(Context context) {
        this(context.getSharedPreferences("lunivo-inventory-credentials", Context.MODE_PRIVATE), InventoryCredentials::platformKey);
    }
    private static synchronized SecretKey platformKey() throws GeneralSecurityException {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        try { store.load(null); } catch (java.io.IOException error) { throw new GeneralSecurityException(error); }
        String alias = "lunivo-inventory-key";
        if (!store.containsAlias(alias)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(alias, null);
    }
    InventoryCredentials(SharedPreferences prefs, Keys keys) { this.prefs = prefs; this.keys = keys; }
    static void scope(String scope) {
        if (scope == null || scope.isEmpty() || scope.length() > 200 || !scope.matches("[A-Za-z0-9:_-]+")) throw new IllegalArgumentException("Cuenta inválida");
    }
    void save(String scope, String value) throws GeneralSecurityException {
        scope(scope);
        if (value == null || !value.matches("[A-Za-z0-9_-]{8,256}")) throw new IllegalArgumentException("Revisa la clave de Split.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE, keys.get());
        cipher.updateAAD(scope.getBytes(StandardCharsets.UTF_8));
        String encrypted = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!prefs.edit().putString(scope, encrypted).commit()) throw new GeneralSecurityException("No se pudo guardar la clave.");
    }
    String read(String scope) throws GeneralSecurityException {
        scope(scope);String value = prefs.getString(scope, "");if (value.isEmpty()) return "";
        try {
            String[] parts = value.split(":", -1);if (parts.length != 2) throw new GeneralSecurityException();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE, keys.get(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            cipher.updateAAD(scope.getBytes(StandardCharsets.UTF_8));
            return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException error) { throw new GeneralSecurityException(error); }
    }
    boolean configured(String scope) throws GeneralSecurityException { return !read(scope).isEmpty(); }
    void clear(String scope) { scope(scope);if (!prefs.edit().remove(scope).commit()) throw new IllegalStateException("No se pudo quitar la clave."); }
}
