package com.crmcelulares.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Looper;
import android.util.Base64;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SalesBackupExporterTest {
    private JSONObject waitFor(List<JSONObject> events,String status)throws Exception{
        long end=System.currentTimeMillis()+5000;
        while(System.currentTimeMillis()<end){Shadows.shadowOf(Looper.getMainLooper()).idle();for(JSONObject event:events)if(event.optString("status").equals(status))return event;Thread.sleep(10);}
        throw new AssertionError("No event "+status+": "+events);
    }
    private JSONObject request(String type)throws Exception{return new JSONObject().put("type",type).put("requestId","test-export");}
    private String hash(byte[] bytes)throws Exception{StringBuilder h=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))h.append(String.format("%02x",b&255));return h.toString();}
    @Test public void streamsLargerThanBridgeLimitThroughDocumentPicker()throws Exception{
        Activity activity=Robolectric.buildActivity(Activity.class).setup().get();List<JSONObject> events=new ArrayList<>();SalesBackupExporter exporter=new SalesBackupExporter(activity,events::add);
        try{byte[] bytes=("{\"datos\":\""+"á😀".repeat(240000)+"\"}").getBytes(StandardCharsets.UTF_8);
            exporter.handle(request("backupExportBegin").put("bytes",bytes.length).put("sha256",hash(bytes)));waitFor(events,"ready");
            for(int offset=0,index=0;offset<bytes.length;offset+=49152,index++){events.clear();int size=Math.min(49152,bytes.length-offset);exporter.handle(request("backupExportChunk").put("index",index).put("chunk",Base64.encodeToString(bytes,offset,size,Base64.NO_WRAP)));waitFor(events,"chunk");}
            exporter.handle(request("backupExportEnd"));long end=System.currentTimeMillis()+5000;org.robolectric.shadows.ShadowActivity.IntentForResult started=null;while(started==null&&System.currentTimeMillis()<end){Shadows.shadowOf(Looper.getMainLooper()).idle();started=Shadows.shadowOf(activity).getNextStartedActivityForResult();Thread.sleep(10);}assertNotNull(started);assertEquals(Intent.ACTION_CREATE_DOCUMENT,started.intent.getAction());assertEquals("application/json",started.intent.getType());
            Uri uri=Uri.parse("content://test/backup.json");ByteArrayOutputStream out=new ByteArrayOutputStream();Shadows.shadowOf(activity.getContentResolver()).registerOutputStream(uri,out);
            assertTrue(exporter.result(SalesBackupExporter.REQUEST,Activity.RESULT_OK,new Intent().setData(uri)));waitFor(events,"saved");assertArrayEquals(bytes,out.toByteArray());
        }finally{exporter.close();activity.finish();}
    }
    @Test public void rejectsOutOfOrderChunkAndNeverOpensPicker()throws Exception{
        Activity activity=Robolectric.buildActivity(Activity.class).setup().get();List<JSONObject> events=new ArrayList<>();SalesBackupExporter exporter=new SalesBackupExporter(activity,events::add);
        try{byte[] bytes="{}".getBytes(StandardCharsets.UTF_8);exporter.handle(request("backupExportBegin").put("bytes",bytes.length).put("sha256",hash(bytes)));waitFor(events,"ready");exporter.handle(request("backupExportChunk").put("index",1).put("chunk",Base64.encodeToString(bytes,Base64.NO_WRAP)));waitFor(events,"error");assertNull(Shadows.shadowOf(activity).getNextStartedActivityForResult());}finally{exporter.close();activity.finish();}
    }
    @Test public void cancelledPickerDoesNotReportSaved()throws Exception{
        Activity activity=Robolectric.buildActivity(Activity.class).setup().get();List<JSONObject> events=new ArrayList<>();SalesBackupExporter exporter=new SalesBackupExporter(activity,events::add);
        try{byte[] bytes="{}".getBytes(StandardCharsets.UTF_8);exporter.handle(request("backupExportBegin").put("bytes",bytes.length).put("sha256",hash(bytes)));waitFor(events,"ready");exporter.handle(request("backupExportChunk").put("index",0).put("chunk",Base64.encodeToString(bytes,Base64.NO_WRAP)));waitFor(events,"chunk");exporter.handle(request("backupExportEnd"));Thread.sleep(40);Shadows.shadowOf(Looper.getMainLooper()).idle();exporter.result(SalesBackupExporter.REQUEST,Activity.RESULT_CANCELED,null);waitFor(events,"cancelled");assertTrue(events.stream().noneMatch(e->e.optString("status").equals("saved")));}finally{exporter.close();activity.finish();}
    }
    @Test public void importsLargeDocumentInOrderedChunks()throws Exception{
        Activity activity=Robolectric.buildActivity(Activity.class).setup().get();List<JSONObject> events=new ArrayList<>();SalesBackupExporter exporter=new SalesBackupExporter(activity,events::add);
        try{byte[] bytes=("á😀".repeat(240000)).getBytes(StandardCharsets.UTF_8);Uri uri=Uri.parse("content://test/import.json");Shadows.shadowOf(activity.getContentResolver()).registerInputStream(uri,new java.io.ByteArrayInputStream(bytes));
            exporter.handle(request("backupImport"));long end=System.currentTimeMillis()+5000;org.robolectric.shadows.ShadowActivity.IntentForResult started=null;while(started==null&&System.currentTimeMillis()<end){Shadows.shadowOf(Looper.getMainLooper()).idle();started=Shadows.shadowOf(activity).getNextStartedActivityForResult();Thread.sleep(10);}assertNotNull(started);assertEquals(Intent.ACTION_OPEN_DOCUMENT,started.intent.getAction());exporter.result(SalesBackupExporter.IMPORT_REQUEST,Activity.RESULT_OK,new Intent().setData(uri));
            JSONObject complete=null;end=System.currentTimeMillis()+5000;while(complete==null&&System.currentTimeMillis()<end){Shadows.shadowOf(Looper.getMainLooper()).idle();for(JSONObject event:events)if(event.optString("type").equals("backupImportComplete"))complete=event;Thread.sleep(10);}assertNotNull(complete);ByteArrayOutputStream out=new ByteArrayOutputStream();int index=0;for(JSONObject event:events)if(event.optString("type").equals("backupImportPart")){assertEquals(index++,event.getInt("index"));out.write(Base64.decode(event.getString("chunk"),Base64.NO_WRAP));}assertArrayEquals(bytes,out.toByteArray());assertEquals(hash(bytes),complete.getString("sha256"));assertEquals(bytes.length,complete.getLong("bytes"));
        }finally{exporter.close();activity.finish();}
    }

}
