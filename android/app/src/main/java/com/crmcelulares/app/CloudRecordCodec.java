package com.crmcelulares.app;

import org.json.JSONException;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

/** Explicit schema keeps optional creator fields across the web/native/cloud boundary. */
final class CloudRecordCodec {
    private CloudRecordCodec() {}

    static Map<String, Object> decode(JSONObject record, boolean profile) throws JSONException {
        Map<String, Object> values = new HashMap<>();
        if (profile) {
            text(record, values, "id", 128);
            text(record, values, "name", 80);
            Object active = record.opt("active");
            if (!(active instanceof Boolean)) throw new JSONException("Estado de usuario inválido");
            values.put("active", active);
        } else {
            for (String field : new String[]{"id", "client", "phone", "model", "channel", "payment", "event", "when", "state", "contactProfile", "notes"}) {
                text(record, values, field, 1000);
            }
            if (record.has("brand")) {
                text(record, values, "brand", 10);
                if (!"Lunivo".equals(values.get("brand")) && !"Split".equals(values.get("brand"))) throw new JSONException("Marca inválida");
            }
            if (record.has("createdById") || record.has("createdByName") || record.has("createdAt")) {
                text(record, values, "createdById", 128);
                text(record, values, "createdByName", 80);
                text(record, values, "createdAt", 40);
            }
        }
        return values;
    }

    private static void text(JSONObject record, Map<String, Object> values, String field, int max) throws JSONException {
        Object value = record.opt(field);
        if (!(value instanceof String) || ((String) value).length() > max) throw new JSONException("Campo inválido: " + field);
        values.put(field, value);
    }
}
