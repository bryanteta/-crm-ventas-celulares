package com.crmcelulares.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class InventoryHttp {
    static final String SAMUEL = "https://docs.google.com/spreadsheets/d/1DRiuHV7tNbjCL0VH2ml_RuWSWwtJCYXoSJ7VsVK2ccg/gviz/tq?tqx=out:csv";
    static final String SPLIT = "https://split-crm.splitelsalvador.workers.dev/api/v1/inventario";
    static final int MAX_BYTES = 4 * 1024 * 1024;
    interface Connections { HttpURLConnection open(URL url) throws IOException; }
    private final Connections connections;
    InventoryHttp() { this(url -> (HttpURLConnection) url.openConnection()); }
    InventoryHttp(Connections connections) { this.connections = connections; }
    String get(String provider, String key) throws IOException {
        if (!"samuel".equals(provider) && !"split".equals(provider)) throw new IOException("Proveedor inválido.");
        if ("split".equals(provider) && (key == null || key.isEmpty())) throw new IOException("Configura la clave de Split en Ajustes.");
        HttpURLConnection connection = connections.open(new URL("split".equals(provider) ? SPLIT : SAMUEL));
        try {
            connection.setConnectTimeout(15000);connection.setReadTimeout(20000);connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod("GET");connection.setRequestProperty("Accept", "split".equals(provider) ? "application/json" : "text/csv");
            connection.setRequestProperty("User-Agent", "Lunivo/1.5.5 Android");
            if ("split".equals(provider)) connection.setRequestProperty("X-API-Key", key);
            int status = connection.getResponseCode();
            if (status == 401 || status == 403) throw new IOException("split".equals(provider) ? "Split rechazó la clave. Revísala en Ajustes." : "La hoja de Samuel no permite la lectura. Revisa sus permisos.");
            if (status != 200) throw new IOException("El proveedor no respondió correctamente (HTTP " + status + "). Se conserva la lista anterior.");
            String type = connection.getContentType();
            if (type == null || !("split".equals(provider) ? type.startsWith("application/json") : type.startsWith("text/csv"))) throw new IOException("El proveedor no devolvió el inventario esperado.");
            if (connection.getContentLengthLong() > MAX_BYTES) throw new IOException("La respuesta del proveedor es demasiado grande.");
            try (InputStream stream = connection.getInputStream(); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                byte[] chunk = new byte[8192];int count;
                while ((count = stream.read(chunk)) != -1) { if (buffer.size() + count > MAX_BYTES) throw new IOException("La respuesta del proveedor es demasiado grande.");buffer.write(chunk, 0, count); }
                return buffer.toString(StandardCharsets.UTF_8.name());
            }
        } finally { connection.disconnect(); }
    }
}
