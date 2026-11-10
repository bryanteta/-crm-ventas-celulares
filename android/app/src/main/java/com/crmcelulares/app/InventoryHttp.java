package com.crmcelulares.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

final class InventoryHttp {
    static final String SAMUEL = "https://script.google.com/macros/s/AKfycbweF6GVeLUBF6zIiUuPS6CsVSzKyabDV1kHrXgehpmQKnXVa40yqGPw6ltA3fjebQCLxw/exec?fn=getCatalogo&a=%5B%5D";
    static final String SPLIT = "https://split-crm.splitelsalvador.workers.dev/api/v1/inventario";
    static final int MAX_BYTES = 4 * 1024 * 1024;
    static final int MAX_REDIRECTS = 3;
    interface Connections { HttpURLConnection open(URL url) throws IOException; }
    private final Connections connections;
    InventoryHttp() { this(url -> (HttpURLConnection) url.openConnection()); }
    InventoryHttp(Connections connections) { this.connections = connections; }

    private static int remainingMillis(long deadline) throws IOException {
        long remaining = (deadline - System.nanoTime()) / 1_000_000;
        if (remaining <= 0) throw new IOException("El proveedor tardó demasiado. Se conserva la lista anterior.");
        return (int) Math.min(Integer.MAX_VALUE, remaining);
    }
    private static boolean trustedGoogleUrl(URL url) {
        return "https".equals(url.getProtocol()) && url.getUserInfo() == null
                && (url.getPort() == -1 || url.getPort() == 443)
                && ("script.google.com".equals(url.getHost()) || "script.googleusercontent.com".equals(url.getHost()));
    }
    String get(String provider, String key) throws IOException {
        boolean samuel = "samuel".equals(provider);
        if (!samuel && !"split".equals(provider)) throw new IOException("Proveedor inválido.");
        if (!samuel && (key == null || key.isEmpty())) throw new IOException("Configura la clave de Split en Ajustes.");
        URL url = new URL(samuel ? SAMUEL : SPLIT);
        long deadline = System.nanoTime() + 35_000_000_000L;
        for (int redirects = 0; ; redirects++) {
            HttpURLConnection connection = connections.open(url);
            try {
                connection.setConnectTimeout(Math.min(15000, remainingMillis(deadline)));
                connection.setReadTimeout(Math.min(20000, remainingMillis(deadline)));
                connection.setInstanceFollowRedirects(false);
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "Lunivo/1.7.15 Android");
                if (!samuel) connection.setRequestProperty("X-API-Key", key);
                int status = connection.getResponseCode();
                if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                    if (!samuel || redirects >= MAX_REDIRECTS) throw new IOException("El proveedor redirigió a una dirección no permitida. Se conserva la lista anterior.");
                    String location = connection.getHeaderField("Location");
                    if (location == null || location.trim().isEmpty()) throw new IOException("La API devolvió una redirección incompleta.");
                    URL next;
                    try { next = new URL(url, location); }
                    catch (IOException error) { throw new IOException("La API devolvió una dirección inválida."); }
                    if (!trustedGoogleUrl(next)) throw new IOException("La API redirigió a una dirección no permitida. Se conserva la lista anterior.");
                    url = next;
                    continue;
                }
                if (status == 401 || status == 403) throw new IOException(samuel ? "La API de Samuel no permite la lectura. Se conserva la lista anterior." : "Split rechazó la clave. Revísala en Ajustes.");
                if (status != 200) throw new IOException("El proveedor no respondió correctamente (HTTP " + status + "). Se conserva la lista anterior.");
                String type = connection.getContentType();
                if (type == null || !"application/json".equals(type.split(";", 2)[0].trim().toLowerCase(Locale.ROOT))) throw new IOException("El proveedor no devolvió el inventario JSON esperado.");
                if (connection.getContentLengthLong() > MAX_BYTES) throw new IOException("La respuesta del proveedor es demasiado grande.");
                try (InputStream stream = connection.getInputStream(); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    byte[] chunk = new byte[8192];int count;
                    while (true) {
                        connection.setReadTimeout(Math.min(20000, remainingMillis(deadline)));
                        count = stream.read(chunk);
                        if (count == -1) break;
                        if (buffer.size() + count > MAX_BYTES) throw new IOException("La respuesta del proveedor es demasiado grande.");
                        buffer.write(chunk, 0, count);
                    }
                    return buffer.toString(StandardCharsets.UTF_8.name());
                }
            } finally { connection.disconnect(); }
        }
    }
}
