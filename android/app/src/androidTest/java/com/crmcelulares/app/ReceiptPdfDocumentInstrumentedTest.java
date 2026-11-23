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
    @Test
    public void splitPaymentPdfStaysCenteredWhenFittedToOnePage() throws Exception {
        for(int extraItems:new int[]{0,20}){
            JSONObject data=sample().put("paymentSummary","Pago dividido");
            data.put("paymentLines",new org.json.JSONArray()
                .put(new JSONObject().put("method","Transferencia").put("amount","$250.00").put("bank","Banco Agrícola").put("terms","—"))
                .put(new JSONObject().put("method","Tasa cero").put("amount","$490.00").put("bank","Banco Cuscatlán").put("terms","36 cuotas")));
            for(int i=0;i<extraItems;i++)data.getJSONArray("items").put(new JSONObject().put("concept","Accesorio "+i).put("quantity","1").put("amount","$2.00").put("application","Accesorio"));
            File file=new File(context.getExternalFilesDir(null),"garantia-dividida-"+extraItems+".pdf");
            try{
                try(OutputStream output=new FileOutputStream(file)){assertEquals(1,ReceiptPdfDocument.write(context,data,output));}
                try(android.os.ParcelFileDescriptor descriptor=android.os.ParcelFileDescriptor.open(file,android.os.ParcelFileDescriptor.MODE_READ_ONLY);
                    android.graphics.pdf.PdfRenderer renderer=new android.graphics.pdf.PdfRenderer(descriptor);
                    android.graphics.pdf.PdfRenderer.Page page=renderer.openPage(0)){
                    assertEquals(1,renderer.getPageCount());
                    android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(595,842,android.graphics.Bitmap.Config.ARGB_8888);
                    bitmap.eraseColor(android.graphics.Color.WHITE);page.render(bitmap,null,null,android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
                    int widest=0,left=0,right=0;
                    for(int y=30;y<790;y++){
                        int first=-1,last=-1;
                        for(int x=0;x<595;x++){
                            int pixel=bitmap.getPixel(x,y);
                            if(android.graphics.Color.blue(pixel)>android.graphics.Color.red(pixel)+30&&android.graphics.Color.red(pixel)<100){if(first<0)first=x;last=x;}
                        }
                        if(first>=0&&last-first>widest){widest=last-first;left=first;right=594-last;}
                    }
                    bitmap.recycle();assertTrue("Printed rules and tables must be present",widest>200);
                    assertTrue("Equal page margins after fitting: left="+left+", right="+right,Math.abs(left-right)<=2);
                    if(extraItems>0)assertTrue("The long split-payment document was scaled",widest<500);
                }
            }finally{/* Keep the generated sample for visual review. */}
        }
    }
    @Test public void nativePdfHasA4PagesAndWritesAnActualPdf()throws Exception{
        File file=new File(context.getExternalFilesDir(null),"receipt-quality-example.pdf");
        int pages;try(OutputStream output=new FileOutputStream(file)){pages=ReceiptPdfDocument.write(context,sample(),output);}
        assertTrue(file.length()>10000);assertEquals(1,pages);
        try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(descriptor)){
            assertEquals(pages,renderer.getPageCount());try(PdfRenderer.Page page=renderer.openPage(0)){assertEquals(595,page.getWidth());assertEquals(842,page.getHeight());}
        }
    }
    @Test public void longFieldsFitOnePageAndFileRemainsReadable()throws Exception{
        JSONObject data=sample();StringBuilder serials=new StringBuilder();for(int i=0;i<500;i++)serials.append("IMEI-").append(i).append("\n");data.getJSONArray("device").getJSONArray(6).put(1,serials.toString());data.put("customerNotes","Observación final: último equipo entregado y revisado.");
        File file=new File(context.getExternalFilesDir(null),"receipt-quality-long.pdf");int pages;try(OutputStream output=new FileOutputStream(file)){pages=ReceiptPdfDocument.write(context,data,output);}
        assertEquals(1,pages);try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(descriptor)){assertEquals(pages,renderer.getPageCount());}
    }
    @Test public void detailedAccessoriesKeepTheirNamesAndTotalInTheNativeDocument()throws Exception{
        JSONObject data;try(InputStream input=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("receipt-accessories.json")){data=new JSONObject(new String(input.readAllBytes(),StandardCharsets.UTF_8));}
        assertEquals("$791.00",data.getString("total"));assertEquals(7,data.getJSONArray("items").length());
        File file=new File(context.getExternalFilesDir(null),"receipt-quality-accessories.pdf");
        try(OutputStream output=new FileOutputStream(file)){assertEquals(1,ReceiptPdfDocument.write(context,data,output));}
        try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(descriptor)){assertEquals(1,renderer.getPageCount());}
    }
    @Test public void maximumChargedLinesShippingAndTenReferenceGiftsRemainOnePage()throws Exception{
        JSONObject data=sample();org.json.JSONArray items=new org.json.JSONArray();items.put(data.getJSONArray("items").getJSONObject(0));
        for(int i=1;i<=29;i++)items.put(new JSONObject().put("concept","Accesorio cobrado "+i).put("quantity","1").put("amount","$2.00").put("application","Accesorio"));
        items.put(new JSONObject().put("concept","Envío").put("quantity","1").put("amount","$7.25").put("application","Envío"));
        for(int i=1;i<=10;i++)items.put(new JSONObject().put("concept","Regalo de cortesía "+i).put("quantity","1").put("amount","$0.00").put("reference","$10.00").put("application","Cortesía LUNIVO"));
        data.put("items",items).put("total","$805.25").put("customerNotes","Observaciones del cliente: comprobante completo de entrega. FIN DE OBSERVACIONES");
        File file=new File(context.getExternalFilesDir(null),"receipt-quality-shipping-gifts.pdf");
        try(OutputStream output=new FileOutputStream(file)){assertEquals(1,ReceiptPdfDocument.write(context,data,output));}
        try(ParcelFileDescriptor descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(descriptor)){assertEquals(1,renderer.getPageCount());}
    }
    @Test public void anOutputFailurePropagatesInsteadOfReportingSaved()throws Exception{
        JSONObject data=sample();assertThrows(IOException.class,()->ReceiptPdfDocument.write(context,data,new OutputStream(){@Override public void write(int b)throws IOException{throw new IOException("full");}@Override public void write(byte[] b,int start,int length)throws IOException{throw new IOException("full");}}));
    }
}
