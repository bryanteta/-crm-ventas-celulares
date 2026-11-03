package com.crmcelulares.app;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class CloudWriteCacheTest {
    @Test public void repeatedRevisionReturnsOriginalAcknowledgementIncludingImportConflict() throws Exception {
        CloudWriteCache cache = new CloudWriteCache(512);
        JSONObject ack = new JSONObject().put("uid", "alice").put("existing", new JSONObject().put("id", "one"));
        cache.put("alice:followups:one:rev-1", ack);
        assertSame(ack, cache.get("alice:followups:one:rev-1"));
        assertNull(cache.get("alice:followups:one:rev-2"));
        assertNull(cache.get("alice:profiles:one:rev-1"));
        assertNull(cache.get("bob:followups:one:rev-1"));
    }
    @Test public void cacheIsBoundedAndAnewSessionHasNoUnverifiedAcknowledgements() {
        CloudWriteCache cache = new CloudWriteCache(2);
        cache.put("one", new JSONObject()); cache.put("two", new JSONObject()); cache.put("three", new JSONObject());
        assertNull(cache.get("one")); assertNotNull(cache.get("two")); assertNotNull(cache.get("three"));
        assertNull(new CloudWriteCache(2).get("two"));
    }
}
