package com.crmcelulares.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Talks only to Lunivo's public catalog Worker. The web administration and the
 * app share this single source of truth, so a price edited in either place is
 * the one both show. Paths and methods are fixed here; the Worker validates and
 * authorizes every edit again.
 */
final class CatalogHttp {
    static final String ORIGIN = "https://lunivo-inventory.bra0307h.workers.dev";
    static final int MAX_BYTES = 2 * 1024 * 1024;
    static final int MAX_BODY = 32 * 1024;

    static final class Result {
        final int status;
        final String body;
        Result(int status, String body) { this.status = status; this.body = body; }
    }

    interface Connections { HttpURLConnection open(URL url) throws IOException; }
    private final Connections connections;
    CatalogHttp() { this(url -> (HttpURLConnection) url.openConnection()); }
    CatalogHttp(Connections connections) { this.connections = connections; }

    /** Public, credential-free snapshot of web prices and photos. */
    String customizations() throws IOException {
        Result result = request("GET", "/customizations.json", null, null);
        if (result.status != 200) throw new IOException("El catálogo web no respondió correctamente. Se conservan los precios guardados.");
        return result.body;
    }

    /** Returns true only when the Worker accepts the administration key. */
    boolean session(String key) throws IOException {
        Result result = request("GET", "/admin/session", key, null);
        if (result.status == 200) return true;
        if (result.status == 401) return false;
        throw failure(result.status);
    }

    /** Saves (PUT) or removes (DELETE) one web price. Conflicts are returned, not thrown. */
    Result edit(String method, String key, String body) throws IOException {
        if (!"PUT".equals(method) && !"DELETE".equals(method)) throw new IOException("Operación no permitida.");
        if (body == null || body.isEmpty() || body.length() > MAX_BODY) throw new IOException("La edición no es válida.");
        return request(method, "/admin/customizations", key, body);
    }

    static IOException failure(int status) {
        if (status == 429) return new IOException("Demasiados intentos con una clave incorrecta. Espera cinco minutos e intenta nuevamente.");
        if (status == 503) return new IOException("El catálogo web no está disponible en este momento. Intenta nuevamente.");
        return new IOException("El catálogo web no respondió correctamente (HTTP " + status + ").");
    }

    private Result request(String method, String path, String key, String body) throws IOException {
        if (key != null && key.isEmpty()) throw new IOException("Guarda la clave del catálogo web en Ajustes.");
        HttpURLConnection connection = connections.open(new URL(ORIGIN + path));
        try {
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setRequestMethod(method);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "Lunivo Android");
            if (key != null) connection.setRequestProperty("Authorization", "Bearer " + key);
            if (body != null) {
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
            }
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) throw new IOException("El catálogo web redirigió a una dirección no permitida.");
            String type = connection.getContentType();
            boolean json = type != null && "application/json".equals(type.split(";", 2)[0].trim().toLowerCase(Locale.ROOT));
            if (!json) {
                if (status == 200) throw new IOException("El catálogo web no devolvió los datos esperados.");
                throw failure(status);
            }
            if (connection.getContentLengthLong() > MAX_BYTES) throw new IOException("La respuesta del catálogo web es demasiado grande.");
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) throw failure(status);
            try (InputStream input = stream; ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                byte[] chunk = new byte[8192];int count;
                while ((count = input.read(chunk)) != -1) {
                    if (buffer.size() + count > MAX_BYTES) throw new IOException("La respuesta del catálogo web es demasiado grande.");
                    buffer.write(chunk, 0, count);
                }
                return new Result(status, buffer.toString(StandardCharsets.UTF_8.name()));
            }
        } finally { connection.disconnect(); }
    }
}
