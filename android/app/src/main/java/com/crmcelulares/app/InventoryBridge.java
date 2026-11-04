package com.crmcelulares.app;

import android.content.Context;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

final class InventoryBridge {
    private final InventoryCredentials credentials;
    private final InventoryHttp http;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    InventoryBridge(Context context) { credentials = new InventoryCredentials(context);http = new InventoryHttp(); }
    void handle(JSONObject request, Consumer<JSONObject> reply) {
        executor.execute(() -> {
            JSONObject result = new JSONObject();
            try {
                String id = request.getString("id"), scope = request.getString("scope"), type = request.getString("type");
                if (!id.matches("[A-Za-z0-9_-]{1,100}")) throw new IllegalArgumentException();InventoryCredentials.scope(scope);
                result.put("id", id).put("scope", scope).put("ok", true);
                switch (type) {
                    case "state": result.put("configured", credentials.configured(scope));break;
                    case "saveKey": credentials.save(scope, request.getString("key").trim());result.put("configured", true);break;
                    case "clearKey": credentials.clear(scope);result.put("configured", false);break;
                    case "refresh":
                        String provider = request.getString("provider");
                        String key = "split".equals(provider) ? credentials.read(scope) : "";
                        result.put("provider", provider).put("body", http.get(provider, key));break;
                    default: throw new IllegalArgumentException();
                }
            } catch (Exception error) {
                try {
                    result.remove("body");result.put("ok", false);
                    String message = error instanceof java.io.IOException ? error.getMessage() : "No se pudo acceder a la conexión. Vuelve a guardar la clave en Ajustes.";
                    result.put("message", message == null ? "No se pudo actualizar. Se conserva el inventario anterior." : message);
                } catch (org.json.JSONException ignored) { /* Fixed data only. */ }
            }
            reply.accept(result);
        });
    }
    void close() { executor.shutdownNow(); }
}
