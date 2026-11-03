package com.crmcelulares.app;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.util.Map;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class CloudRecordCodecTest {
    private JSONObject record() throws JSONException {
        JSONObject row = new JSONObject();
        for (String field : new String[]{"id","client","phone","model","channel","payment","event","when","state","contactProfile","notes"}) row.put(field, "value");
        return row;
    }
    @Test public void legacyRecordsRetainTheirSchemaWithoutInventedCreators() throws Exception {
        Map<String, Object> values = CloudRecordCodec.decode(record(), false);
        assertEquals(11, values.size()); assertFalse(values.containsKey("createdById"));
    }
    @Test public void creatorSnapshotCrossesTheNativeBridgeUnchanged() throws Exception {
        JSONObject row = record().put("createdById", "ana").put("createdByName", "Ana María").put("createdAt", "2030-01-01T00:00:00Z");
        Map<String, Object> values = CloudRecordCodec.decode(row, false);
        assertEquals("Ana María", values.get("createdByName")); assertEquals(14, values.size());
    }
    @Test public void partialCreatorMetadataIsRejectedRatherThanSilentlyDiscarded() throws Exception {
        assertThrows(JSONException.class, () -> CloudRecordCodec.decode(record().put("createdById", "ana"), false));
    }
    @Test public void profileBooleanAndNameTypesArePreserved() throws Exception {
        JSONObject profile = new JSONObject().put("id", "ana").put("name", "Ana").put("active", false);
        assertEquals(Boolean.FALSE, CloudRecordCodec.decode(profile, true).get("active"));
        assertThrows(JSONException.class, () -> CloudRecordCodec.decode(profile.put("active", "false"), true));
        assertThrows(JSONException.class, () -> CloudRecordCodec.decode(profile.put("active", true).put("name", "a".repeat(81)), true));
    }
    @Test public void brandCrossesTheNativeBridgeWithoutChangingLegacyRecords() throws Exception {
        assertEquals("Split", CloudRecordCodec.decode(record().put("brand", "Split"), false).get("brand"));
        assertEquals("Lunivo", CloudRecordCodec.decode(record().put("brand", "Lunivo"), false).get("brand"));
        assertFalse(CloudRecordCodec.decode(record(), false).containsKey("brand"));
    }
    @Test public void invalidBrandCannotBeSilentlySavedAsAnotherBrand() throws Exception {
        assertThrows(JSONException.class, () -> CloudRecordCodec.decode(record().put("brand", "Other"), false));
        assertThrows(JSONException.class, () -> CloudRecordCodec.decode(record().put("brand", true), false));
    }
}
