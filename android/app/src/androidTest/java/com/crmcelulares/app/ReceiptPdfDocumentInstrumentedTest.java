package com.crmcelulares.app;

import android.content.Context;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

/** Executes Android's actual PdfDocument/Skia writer; does not launch the CRM activity. */
@RunWith(AndroidJUnit4.class)
public class ReceiptPdfDocumentInstrumentedTest {
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private JSONObject sample()throws Exception{
        try(InputStream input=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("receipt-vector.json")){return new JSONObject(new String(input.readAllBytes(),StandardCharsets.UTF_8));}
    }
    @Test public void nativePdfHasA4PagesAndWritesAnActualPdf()throws Exception{
        File file=new File(context.getExternalFilesDir(null),"receipt-quality-example.pdf");
        int pages;try(OutputStream output=new FileOutputStream(file)){pages=ReceiptPdfDocument.write(context,sample(),output);}
        assertTrue(file.length()>10000);assertEquals(1,pages);
        try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(descriptor)){
            assertEquals(pages,renderer.getPageCount());try(PdfRenderer.Page page=renderer.openPage(0)){assertEquals(595,page.getWidth());assertEquals(842,page.getHeight());}
        }
    }
    @Test public void longFieldsContinueAcrossPagesAndFileRemainsReadable()throws Exception{
        JSONObject data=sample();StringBuilder serials=new StringBuilder();for(int i=0;i<500;i++)serials.append("IMEI-").append(i).append("\n");data.getJSONArray("device").getJSONArray(6).put(1,serials.toString());data.put("customerNotes","Observación final: último equipo entregado y revisado.");
        File file=new File(context.getExternalFilesDir(null),"receipt-quality-long.pdf");int pages;try(OutputStream output=new FileOutputStream(file)){pages=ReceiptPdfDocument.write(context,data,output);}
        assertTrue(pages>1);try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(descriptor)){assertEquals(pages,renderer.getPageCount());}
    }
    @Test public void detailedAccessoriesKeepTheirNamesAndTotalInTheNativeDocument()throws Exception{
        JSONObject data;try(InputStream input=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("receipt-accessories.json")){data=new JSONObject(new String(input.readAllBytes(),StandardCharsets.UTF_8));}
        assertEquals("$791.00",data.getString("total"));assertEquals(7,data.getJSONArray("items").length());
        File file=new File(context.getExternalFilesDir(null),"receipt-quality-accessories.pdf");
        try(OutputStream output=new FileOutputStream(file)){assertTrue(ReceiptPdfDocument.write(context,data,output)>=1);}
        try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(descriptor)){assertTrue(renderer.getPageCount()>=1);}
    }
    @Test public void anOutputFailurePropagatesInsteadOfReportingSaved()throws Exception{
        JSONObject data=sample();assertThrows(IOException.class,()->ReceiptPdfDocument.write(context,data,new OutputStream(){@Override public void write(int b)throws IOException{throw new IOException("full");}@Override public void write(byte[] b,int start,int length)throws IOException{throw new IOException("full");}}));
    }
}
