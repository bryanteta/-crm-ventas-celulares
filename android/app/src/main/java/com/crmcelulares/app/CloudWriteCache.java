package com.crmcelulares.app;

import org.json.JSONObject;
import java.util.LinkedHashMap;
import java.util.Map;

/** Replayed bridge messages return the previous acknowledgement instead of another billed write.
 * Session-only: never acknowledge an unconfirmed SDK write after process death.
 */
final class CloudWriteCache {
    private final Map<String, JSONObject> completed = new LinkedHashMap<>();
    private final int capacity;
    CloudWriteCache(int capacity) { this.capacity = capacity; }
    JSONObject get(String token) { return completed.get(token); }
    void put(String token, JSONObject ack) {
        completed.put(token, ack);
        while (completed.size() > capacity) completed.remove(completed.keySet().iterator().next());
    }
}
