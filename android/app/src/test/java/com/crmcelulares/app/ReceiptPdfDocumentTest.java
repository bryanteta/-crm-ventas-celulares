package com.crmcelulares.app;

import android.app.Activity;
import android.content.Intent;
import android.print.PrintAttributes;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class ReceiptPdfDocumentTest {
    private JSONObject sample() throws Exception {
        try(InputStream input=getClass().getResourceAsStream("/receipt-vector.json")){assertNotNull(input);return new JSONObject(new String(input.readAllBytes(),StandardCharsets.UTF_8));}
    }
    @Test public void malformedPayloadIsRejectedBeforeAnyBytesAreWritten() throws Exception {
        JSONObject d=sample();d.remove("total");ByteArrayOutputStream output=new ByteArrayOutputStream();assertThrows(JSONException.class,()->ReceiptPdfDocument.write(RuntimeEnvironment.getApplication(),d,output));assertEquals(0,output.size());
        JSONObject invalid=sample();invalid.put("terms",new org.json.JSONArray());assertThrows(JSONException.class,()->ReceiptPdfDocument.validate(invalid));
    }
    @Test public void printerGetsExplicitA4And600DpiAndExportUsesTheFilePicker() {
        PrintAttributes attrs=ReceiptPrinter.highQualityAttributes();assertEquals(PrintAttributes.MediaSize.ISO_A4,attrs.getMediaSize());assertEquals(600,attrs.getResolution().getHorizontalDpi());assertEquals(600,attrs.getResolution().getVerticalDpi());assertEquals(PrintAttributes.Margins.NO_MARGINS,attrs.getMinMargins());
        Intent intent=ReceiptPrinter.exportIntent("Lunivo-2026-1101");assertEquals(Intent.ACTION_CREATE_DOCUMENT,intent.getAction());assertEquals("application/pdf",intent.getType());assertEquals("Lunivo-2026-1101.pdf",intent.getStringExtra(Intent.EXTRA_TITLE));assertTrue(intent.hasCategory(Intent.CATEGORY_OPENABLE));
    }
    @Test public void filePickerCancellationAndDuplicatesNeverGenerateAFile() throws Exception {
        Activity activity=Robolectric.buildActivity(Activity.class).setup().get();ReceiptPrinter printer=new ReceiptPrinter(activity);List<String> messages=new ArrayList<>();
        printer.export(sample(),"Lunivo-2026-1101",messages::add);assertEquals(ReceiptPrinter.EXPORT_REQUEST,shadowOf(activity).getNextStartedActivityForResult().requestCode);
        printer.export(sample(),"Lunivo-2026-1101",messages::add);assertTrue(messages.get(0).contains("operación actual"));
        assertTrue(printer.handleExportResult(ReceiptPrinter.EXPORT_REQUEST,Activity.RESULT_CANCELED,null));assertTrue(messages.get(1).contains("cancelada"));assertFalse(printer.handleExportResult(1,Activity.RESULT_OK,null));printer.close();
    }
}
