package com.crmcelulares.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.text.Layout;
import android.text.SpannableString;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.style.AbsoluteSizeSpan;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/** A4 vector PDF. Text and rules are drawn as PDF primitives, never a screenshot. */
final class ReceiptPdfDocument {
    static final int WIDTH = 595, HEIGHT = 842;
    private static final int NAVY = Color.rgb(25, 47, 78), BLUE = Color.rgb(39, 91, 158);
    private static final int MUTED = Color.rgb(63, 81, 105), LIGHT = Color.rgb(244, 247, 251);
    private static final float MARGIN = 32, BOTTOM = 807, CONTENT = WIDTH - 2 * MARGIN;
    private final PdfDocument pdf = new PdfDocument();
    private final Paint shape = new Paint(Paint.ANTI_ALIAS_FLAG);
    private PdfDocument.Page page;
    private Canvas canvas;
    private float y;
    private int pageCount;

    static void validate(JSONObject d) throws JSONException {
        if (d == null || d.optInt("version") != 1 || d.toString().length() > 200000) throw new JSONException("Invalid document");
        for (String key : new String[]{"client","model","deliveryDate","expires","payment","total","channel"}) text(d,key,500,true);
        if(d.has("warrantyMonths")){
            Object months=d.get("warrantyMonths");
            if(!(months instanceof Number)||((Number)months).doubleValue()!=((Number)months).intValue()||((Number)months).intValue()<1||((Number)months).intValue()>36)throw new JSONException("Invalid warranty duration");
        }
        text(d,"phone",40,false);text(d,"customerNotes",2000,false);d.getBoolean("cancelled");
        JSONArray fields=d.getJSONArray("device");if(fields.length()!=8)throw new JSONException("Invalid device");
        for(int i=0;i<fields.length();i++){JSONArray cell=fields.getJSONArray(i);if(cell.length()!=2||!(cell.get(0) instanceof String)||!(cell.get(1) instanceof String)||cell.getString(0).length()>100||cell.getString(1).length()>110000)throw new JSONException("Invalid field");}
        JSONArray items=d.getJSONArray("items");if(items.length()<1||items.length()>41)throw new JSONException("Invalid items");
        for(int i=0;i<items.length();i++){JSONObject item=items.getJSONObject(i);for(String key:new String[]{"concept","quantity","amount","application"})text(item,key,500,true);}
        JSONArray terms=d.getJSONArray("terms");if(terms.length()!=3)throw new JSONException("Invalid terms");
        for(int i=0;i<terms.length();i++)if(!(terms.get(i) instanceof String)||terms.getString(i).length()>4000)throw new JSONException("Invalid terms");
        JSONObject company=d.getJSONObject("company");for(String key:new String[]{"name","phone","facebook","instagram","tiktok"})text(company,key,200,true);
    }
    private static void text(JSONObject d,String key,int max,boolean required)throws JSONException {
        Object value=d.opt(key);if(!(value instanceof String)||((String)value).length()>max||(required&&((String)value).isEmpty()))throw new JSONException("Invalid "+key);
    }
    static int write(Context context, JSONObject data, OutputStream output) throws IOException, JSONException {
        validate(data);ReceiptPdfDocument writer=new ReceiptPdfDocument();
        byte[] bytes;int pages;
        try {
            writer.render(context,data);
            java.io.ByteArrayOutputStream buffer=new java.io.ByteArrayOutputStream();
            writer.pdf.writeTo(buffer);
            bytes=buffer.toByteArray();pages=writer.pageCount;
        } finally {if(writer.page!=null){writer.pdf.finishPage(writer.page);writer.page=null;}writer.pdf.close();}
        // File-provider errors stay in Java, after the native PDF writer is closed.
        output.write(bytes);output.flush();return pages;
    }
    private TextPaint paint(float size, boolean bold, int color) {
        TextPaint p=new TextPaint(Paint.ANTI_ALIAS_FLAG|Paint.SUBPIXEL_TEXT_FLAG);p.setTextSize(size);p.setColor(color);p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));return p;
    }
    private StaticLayout layout(CharSequence text,float width,TextPaint paint,Layout.Alignment alignment) {
        return StaticLayout.Builder.obtain(text,0,text.length(),paint,Math.max(1,(int)width)).setAlignment(alignment)
                .setIncludePad(false).setLineSpacing(1.5f,1f).build();
    }
    private void rectangle(float x,float top,float width,float height,int color){shape.setColor(color);shape.setStyle(Paint.Style.FILL);canvas.drawRect(x,top,x+width,top+height,shape);}
    private void rule(float top,int color){shape.setColor(color);shape.setStrokeWidth(.6f);canvas.drawLine(MARGIN,top,WIDTH-MARGIN,top,shape);}
    private void finishPage(){
        if(page==null)return;
        TextPaint footer=paint(7.5f,false,MUTED);String label="LUNIVO · Página "+pageCount;
        canvas.drawText(label,WIDTH-MARGIN-footer.measureText(label),HEIGHT-15,footer);pdf.finishPage(page);page=null;
    }
    private void newPage(){
        if(Thread.currentThread().isInterrupted())throw new java.util.concurrent.CancellationException();
        finishPage();page=pdf.startPage(new PdfDocument.PageInfo.Builder(WIDTH,HEIGHT,++pageCount).create());canvas=page.getCanvas();y=MARGIN;
        if(pageCount>1){TextPaint p=paint(9,true,BLUE);canvas.drawText("LUNIVO · COMPROBANTE",MARGIN,y+10,p);rule(y+20,Color.rgb(220,228,238));y+=32;}
    }
    private void ensure(float height){if(y+height>BOTTOM)newPage();}
    private void section(String text){ensure(46);y+=6;StaticLayout title=layout(text,CONTENT,paint(10,true,BLUE),Layout.Alignment.ALIGN_NORMAL);draw(title,MARGIN,y);y+=title.getHeight()+7;}
    private void draw(StaticLayout text,float x,float top){canvas.save();canvas.translate(x,top);text.draw(canvas);canvas.restore();}
    private void paragraph(String text,float size,boolean bold,int color){
        StaticLayout lines=layout(text,CONTENT,paint(size,bold,color),Layout.Alignment.ALIGN_NORMAL);
        int first=0;
        while(first<lines.getLineCount()){
            ensure(lines.getLineBottom(first)-lines.getLineTop(first));
            int last=first;float offset=lines.getLineTop(first),available=BOTTOM-y;
            while(last+1<lines.getLineCount()&&lines.getLineBottom(last+1)-offset<=available)last++;
            float height=lines.getLineBottom(last)-offset;
            canvas.save();canvas.clipRect(MARGIN,y,WIDTH-MARGIN,y+height);draw(lines,MARGIN,y-offset);canvas.restore();y+=height;
            first=last+1;if(first<lines.getLineCount())newPage();
        }
        y+=5;
    }
    private CharSequence field(String label,String value){
        String title=label.toUpperCase(Locale.ROOT);SpannableString text=new SpannableString(title+"\n"+value);
        text.setSpan(new AbsoluteSizeSpan(8),0,title.length(),0);text.setSpan(new ForegroundColorSpan(MUTED),0,title.length(),0);text.setSpan(new StyleSpan(Typeface.BOLD),title.length()+1,text.length(),0);return text;
    }
    // Large text cells continue on subsequent pages instead of shrinking or truncating the document.
    private void row(CharSequence[] text,float[] weights,int background,boolean bold,int color,int rightColumn){
        StaticLayout[] layouts=new StaticLayout[text.length];float[] widths=new float[text.length];float height=0;
        for(int i=0;i<text.length;i++){widths[i]=CONTENT*weights[i];layouts[i]=layout(text[i],widths[i]-14,paint(9.5f,bold,color),i==rightColumn?Layout.Alignment.ALIGN_OPPOSITE:Layout.Alignment.ALIGN_NORMAL);height=Math.max(height,layouts[i].getHeight()+10);}
        if(height<=BOTTOM-64)ensure(height);
        float offset=0;
        while(offset<height){
            ensure(26);float chunk=Math.min(height-offset,BOTTOM-y);
            // Do not split a line at a page boundary; backgrounds may extend beyond the final text line.
            if(chunk<height-offset){float boundary=Float.MAX_VALUE;for(StaticLayout cell:layouts)for(int line=0;line<cell.getLineCount();line++){float top=5+cell.getLineTop(line),bottom=5+cell.getLineBottom(line);if(top<offset+chunk&&bottom>offset+chunk)boundary=Math.min(boundary,top-offset);}if(boundary!=Float.MAX_VALUE&&boundary>0)chunk=boundary;}
            float x=MARGIN;
            for(int i=0;i<text.length;i++){rectangle(x,y,widths[i]-.7f,chunk,background);canvas.save();canvas.clipRect(x+7,y,x+widths[i]-7,y+chunk);draw(layouts[i],x+7,y+5-offset);canvas.restore();x+=widths[i];}
            y+=chunk;offset+=chunk;if(offset<height)newPage();
        }
        y+=1;
    }
    private void fields(String[] labels,String[] values,float[] weights){CharSequence[] text=new CharSequence[labels.length];for(int i=0;i<labels.length;i++)text[i]=field(labels[i],values[i]);row(text,weights,LIGHT,false,NAVY,-1);}
    private void render(Context context,JSONObject d)throws IOException,JSONException {
        newPage();
        if(d.getBoolean("cancelled")){row(new String[]{"COMPROBANTE ANULADO"},new float[]{1},Color.rgb(255,239,235),true,Color.rgb(160,52,40),-1);y+=8;}
        float headerY=y;
        Bitmap logo;
        try(InputStream source=context.getAssets().open("www/assets/lunivo-mark.png")){BitmapFactory.Options options=new BitmapFactory.Options();options.inScaled=false;logo=BitmapFactory.decodeStream(source,null,options);}
        if(logo==null)throw new IOException("Logo unavailable");
        Paint image=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);canvas.drawBitmap(logo,null,new RectF(MARGIN,headerY,MARGIN+56,headerY+56),image);
        canvas.drawText("LUNIVO",MARGIN,headerY+77,paint(18,true,NAVY));
        StaticLayout heading=layout("COMPROBANTE DE COMPRA\nY GARANTÍA",CONTENT-150,paint(15,true,NAVY),Layout.Alignment.ALIGN_OPPOSITE);draw(heading,MARGIN+150,headerY+3);
        StaticLayout sub=layout("Teléfonos de gama alta",CONTENT-150,paint(9,false,MUTED),Layout.Alignment.ALIGN_OPPOSITE);draw(sub,MARGIN+150,headerY+heading.getHeight()+12);
        y=headerY+85;rule(y,BLUE);y+=10;
        paragraph("Documento emitido por LUNIVO como comprobante de compra, entrega y respaldo de garantía. No requiere firma del cliente; registra la información comercial y técnica del equipo entregado.",8.5f,false,MUTED);
        fields(new String[]{"Fecha de venta","Cliente","Método de pago"},new String[]{d.getString("deliveryDate"),d.getString("client")+(d.getString("phone").isEmpty()?"":"\n"+d.getString("phone")),d.getString("payment")},new float[]{.23f,.37f,.40f});
        section("01  DATOS DEL DISPOSITIVO ENTREGADO");JSONArray device=d.getJSONArray("device");
        for(int i=0;i<device.length();i+=2)fields(new String[]{device.getJSONArray(i).getString(0),device.getJSONArray(i+1).getString(0)},new String[]{device.getJSONArray(i).getString(1),device.getJSONArray(i+1).getString(1)},new float[]{.5f,.5f});
        section("02  PRECIO COBRADO Y BENEFICIOS ENTREGADOS");float[] columns={.39f,.10f,.18f,.33f};
        row(new String[]{"Concepto","Cant.","Valor","Aplicación"},columns,NAVY,true,Color.WHITE,2);
        JSONArray items=d.getJSONArray("items");for(int i=0;i<items.length();i++){JSONObject item=items.getJSONObject(i);row(new String[]{item.getString("concept"),item.getString("quantity"),item.getString("amount"),item.getString("application")},columns,i%2==0?Color.WHITE:LIGHT,false,NAVY,2);}
        row(new String[]{"TOTAL PAGADO POR EL CLIENTE",d.getString("total"),d.getString("payment")},new float[]{.49f,.18f,.33f},Color.rgb(232,240,251),true,NAVY,1);
        y+=4;paragraph("Los artículos indicados como cortesía o regalía se entregaron sin costo adicional. Sus valores son referenciales y no son canjeables por efectivo, descuento posterior ni devolución independiente.",8,false,MUTED);
        section("03  CONDICIONES DE GARANTÍA LUNIVO");int months=d.optInt("warrantyMonths",3);paragraph(months+(months==1?" MES":" MESES")+" CALENDARIO DE GARANTÍA desde "+d.getString("deliveryDate")+". Válida hasta "+d.getString("expires")+".",10,true,BLUE);
        JSONArray terms=d.getJSONArray("terms");for(int i=0;i<terms.length();i++)paragraph(terms.getString(i),9.5f,false,NAVY);
        section("04  CONTROL Y VALIDEZ DEL COMPROBANTE");paragraph(d.getString("customerNotes"),9.5f,false,NAVY);paragraph("Canal: "+d.getString("channel"),8.5f,false,MUTED);
        JSONObject company=d.getJSONObject("company");ensure(50);y+=6;rule(y,Color.rgb(220,228,238));y+=9;
        paragraph(company.getString("name")+" · WhatsApp "+company.getString("phone")+"\nFacebook "+company.getString("facebook")+" · Instagram "+company.getString("instagram")+" · TikTok "+company.getString("tiktok"),8.5f,false,MUTED);
        finishPage();
    }
}
