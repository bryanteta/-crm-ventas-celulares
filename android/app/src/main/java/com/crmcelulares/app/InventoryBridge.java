package com.crmcelulares.app;

import android.content.Context;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

final class InventoryBridge {
    private final InventoryCredentials credentials;
    private final InventoryHttp http;
    private final InventoryCredentials catalogCredentials;
    private final CatalogHttp catalog;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);
    InventoryBridge(Context context) { this(new InventoryCredentials(context), new InventoryHttp(), InventoryCredentials.catalog(context), new CatalogHttp()); }
    InventoryBridge(InventoryCredentials credentials, InventoryHttp http, InventoryCredentials catalogCredentials, CatalogHttp catalog) {
        this.credentials = credentials;this.http = http;this.catalogCredentials = catalogCredentials;this.catalog = catalog;
    }
    void handle(JSONObject request, Consumer<JSONObject> reply) {
        executor.execute(() -> reply.accept(process(request)));
    }
    JSONObject process(JSONObject request) {
        JSONObject result = new JSONObject();
        String type = request.optString("type");
        boolean catalogRequest = type.startsWith("catalog");
        try {
            String id = request.getString("id"), scope = request.getString("scope");
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
                // Web catalog prices: the Worker is the single source shared with the web panel.
                case "catalogState": result.put("configured", catalogCredentials.configured(scope));break;
                case "catalogSaveKey": {
                    String value = request.getString("key").trim();
                    if (!value.matches(InventoryCredentials.CATALOG_PATTERN)) throw new CatalogError("Revisa la clave del catálogo web: usa la misma clave de administración de la web.");
                    if (!catalog.session(value)) throw new CatalogError("La clave del catálogo web no es válida. No se guardó.");
                    catalogCredentials.save(scope, value);result.put("configured", true);break;
                }
                case "catalogClearKey": catalogCredentials.clear(scope);result.put("configured", false);break;
                case "catalogRead": result.put("body", catalog.customizations());break;
                case "catalogEdit": {
                    String value = catalogCredentials.read(scope);
                    if (value.isEmpty()) throw new CatalogError("Guarda la clave del catálogo web en Ajustes para cambiar precios.");
                    CatalogHttp.Result response = catalog.edit(request.getString("method"), value, request.getString("body"));
                    result.put("status", response.status).put("body", response.body);break;
                }
                default: throw new IllegalArgumentException();
            }
        } catch (Exception error) {
            try {
                result.remove("body");result.remove("status");result.put("ok", false);
                String message;
                if (error instanceof java.io.IOException || error instanceof CatalogError) message = error.getMessage();
                else if (catalogRequest) message = "No se pudo acceder al catálogo web. Vuelve a guardar su clave en Ajustes.";
                else message = "No se pudo acceder a la conexión. Vuelve a guardar la clave en Ajustes.";
                result.put("message", message == null ? (catalogRequest ? "No se pudo completar la operación del catálogo web." : "No se pudo actualizar. Se conserva el inventario anterior.") : message);
            } catch (org.json.JSONException ignored) { /* Fixed data only. */ }
        }
        return result;
    }
    void close() { executor.shutdownNow(); }
    static final class CatalogError extends Exception { CatalogError(String message) { super(message); } }
}
