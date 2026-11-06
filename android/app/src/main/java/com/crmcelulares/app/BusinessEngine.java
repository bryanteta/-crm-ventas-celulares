package com.crmcelulares.app;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/** Financial mutations shared by Firestore transactions and the local transaction tests. */
final class BusinessEngine {
    static final String SERVER_TIME="__LUNIVO_SERVER_TIME__";
    static final long MAX=9007199254740991L;
    interface Tx { JSONObject get(String path) throws Exception; void put(String path,JSONObject value) throws Exception; }
    static final class Problem extends Exception {
        final String code;
        Problem(String code,String message){super(message);this.code=code;}
    }
    static String encoded(String id){return Base64.getUrlEncoder().withoutPadding().encodeToString(id.getBytes(StandardCharsets.UTF_8));}
    static String collection(String uid,String name){return "users/"+uid+"/"+(name.equals("sales")?"suiteSales":"suiteInventory");}
    static String path(String uid,String name,String id){return collection(uid,name)+"/"+encoded(id);}
    private static void require(boolean value,String message)throws Problem{if(!value)throw new Problem("validation",message);}
    private static JSONObject copy(JSONObject o)throws JSONException{return new JSONObject(o.toString());}
    private static String text(JSONObject o,String key,int max,boolean required)throws Exception{
        Object value=o.opt(key);require(value==null||value==JSONObject.NULL||value instanceof String,"Revisa "+key+".");
        String s=value instanceof String?(String)value:"";require(s.length()<=max&&(!required||!s.trim().isEmpty()),"Completa o revisa "+key+".");return s;
    }
    private static long integer(JSONObject o,String key,long min,long max)throws Exception{
        Object value=o.opt(key);require(value instanceof Number,"Revisa "+key+".");double d=((Number)value).doubleValue();
        require(Double.isFinite(d)&&Math.rint(d)==d&&d>=min&&d<=max,"Revisa "+key+".");return((Number)value).longValue();
    }
    private static long safe(long value)throws Problem{require(value>=-MAX&&value<=MAX,"El importe es demasiado grande.");return value;}
    private static String date(String value)throws Problem{try{require(value.matches("\\d{4}-\\d{2}-\\d{2}")&&LocalDate.parse(value).toString().equals(value),"Revisa la fecha de venta o entrega.");return value;}catch(RuntimeException invalid){throw new Problem("validation","Revisa la fecha de venta o entrega.");}}
    private static void identity(String uid)throws Problem{require(uid!=null&&uid.matches("[A-Za-z0-9_-]{1,128}"),"Vuelve a iniciar sesión.");}
    private static String owner(String id){return id.equals("lunivo")?"Lunivo":id.equals("samuel")?"Samuel":id.equals("saul")?"Saúl":id.equals("javier")?"Javier":"Sin asignar";}
    private static void stock(JSONObject r)throws Exception{
        text(r,"id",200,true);text(r,"model",200,true);String id=text(r,"ownerId",128,false);require(id.isEmpty()||java.util.Arrays.asList("lunivo","samuel","saul","javier").contains(id),"Revisa el dueño del equipo.");
        text(r,"brand",60,false);long q=integer(r,"quantity",0,MAX),cost=integer(r,"cost",0,MAX);safe(Math.multiplyExact(q,cost));
        text(r,"createdBy",128,false);text(r,"createdByName",80,false);text(r,"createdAt",40,false);
    }
    private static void sale(JSONObject r,boolean legacy)throws Exception{
        text(r,"id",200,true);text(r,"client",100,true);text(r,"model",2000,true);date(text(r,"date",10,true));text(r,"supplier",100,false);text(r,"notes",1000,false);
        long quantity=integer(r,"quantity",1,1000),price=integer(r,"price",0,MAX),cost=integer(r,"cost",0,MAX),expenses=integer(r,"expenses",0,MAX);
        long accessories=r.has("accessories")?integer(r,"accessories",0,MAX):0,accessoryCost=r.has("accessoryCost")?integer(r,"accessoryCost",0,MAX):0;
        long revenue=safe(Math.addExact(Math.multiplyExact(quantity,price),accessories)),purchase=safe(Math.addExact(Math.multiplyExact(quantity,cost),accessoryCost));
        String state=text(r,"status",20,true);require(java.util.Arrays.asList("Confirmada","Anulada").contains(state),"Confirma la venta antes de compartirla.");
        long commission=legacy&&(!r.has("commissionEnabled")||r.optBoolean("commissionEnabled"))?1500:0;
        require(integer(r,"revenue",0,MAX)==revenue&&integer(r,"purchase",0,MAX)==purchase&&integer(r,"commission",0,MAX)==commission&&integer(r,"profit",-MAX,MAX)==safe(revenue-purchase-expenses-commission),"Los importes no coinciden. Revisa la venta sin borrar los datos.");
        if(!legacy)require(r.has("commissionEnabled")&&!r.getBoolean("commissionEnabled"),"No se descuentan comisiones en ventas nuevas.");
        JSONArray items=r.optJSONArray("accessoryItems");if(items!=null){require(items.length()<=30,"Revisa los accesorios.");long total=0;Set<String> ids=new HashSet<>();for(int n=0;n<items.length();n++){JSONObject item=items.getJSONObject(n);require(ids.add(text(item,"id",200,true)),"Hay un accesorio repetido.");text(item,"name",150,true);text(item,"catalogId",60,true);total=safe(total+integer(item,"price",0,MAX));}require(total==accessories,"El detalle de accesorios no coincide con su total.");}else require(legacy||accessories==0,"Completa el detalle de accesorios.");
        for(String key:new String[]{"stockId","offerId","followupId"})text(r,key,200,false);text(r,"offerDate",40,false);text(r,"sellerId",128,true);text(r,"sellerName",80,true);text(r,"createdAt",40,!legacy);
        require(r.isNull("paidAt")||r.opt("paidAt") instanceof String,"Revisa el estado histórico del pago.");
    }
    private static void receipt(JSONObject r,long quantity,boolean complete)throws Exception{
        require(integer(r,"version",1,1)==1,"Revisa la garantía.");date(text(r,"deliveryDate",10,true));
        for(String key:new String[]{"brand","capacity","color","condition","battery","physical"})text(r,key,120,complete);
        String phone=text(r,"phone",30,false);require(phone.isEmpty()||phone.matches("[+\\d\\s().-]{7,30}"),"Revisa el número de contacto.");
        String payment=text(r,"paymentMethod",30,true);require(java.util.Arrays.asList("Efectivo","Transferencia","Tasa cero","Tarjeta","Otro").contains(payment),"Revisa el método de pago.");
        if(payment.equals("Tasa cero")){text(r,"bank",80,true);integer(r,"months",1,60);}text(r,"customerNotes",1000,false);text(r,"channel",40,false);
        JSONArray serials=r.optJSONArray("serials");require(serials!=null&&serials.length()<=quantity,"Registra como máximo un IMEI por unidad; puedes dejarlo vacío.");Set<String> seen=new HashSet<>();for(int n=0;n<serials.length();n++){String s=serials.getString(n);require(!s.trim().isEmpty()&&s.length()<=100&&seen.add(s.replaceAll("\\s","").toUpperCase(java.util.Locale.ROOT)),"Revisa los IMEI; no deben repetirse.");}
        require(integer(r,"warrantyMonths",3,3)==3&&r.optJSONArray("terms")!=null&&r.getJSONArray("terms").length()==3,"Revisa las condiciones de garantía.");
        for(int n=0;n<3;n++)require(r.getJSONArray("terms").getString(n).length()<=4000,"Revisa las condiciones de garantía.");
        JSONArray gifts=r.optJSONArray("gifts");require(gifts!=null&&gifts.length()<=10,"Revisa las cortesías.");for(int n=0;n<gifts.length();n++){text(gifts.getJSONObject(n),"name",150,true);integer(gifts.getJSONObject(n),"reference",0,MAX);}
    }
    private static String canonical(Object value)throws Exception{
        if(value==null||value==JSONObject.NULL)return"null";
        if(value instanceof JSONObject){JSONObject o=(JSONObject)value;TreeSet<String> keys=new TreeSet<>();o.keys().forEachRemaining(keys::add);StringBuilder b=new StringBuilder("{");for(String key:keys){if(b.length()>1)b.append(',');b.append(JSONObject.quote(key)).append(':').append(canonical(o.get(key)));}return b.append('}').toString();}
        if(value instanceof JSONArray){JSONArray a=(JSONArray)value;StringBuilder b=new StringBuilder("[");for(int n=0;n<a.length();n++){if(n>0)b.append(',');b.append(canonical(a.get(n)));}return b.append(']').toString();}
        if(value instanceof Number){double d=((Number)value).doubleValue();return Math.rint(d)==d?Long.toString(((Number)value).longValue()):value.toString();}
        return value instanceof String?JSONObject.quote((String)value):value.toString();
    }
    static String fingerprint(JSONObject value)throws Exception{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(canonical(value).getBytes(StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();for(byte v:bytes)b.append(String.format(java.util.Locale.ROOT,"%02x",v&255));return b.toString();}
    private static JSONObject wrap(JSONObject record,String revision,boolean legacy)throws Exception{return new JSONObject().put("id",record.getString("id")).put("record",record).put("revision",revision).put("legacy",legacy).put("updatedAt",SERVER_TIME);}
    private static JSONObject record(JSONObject document)throws Exception{require(document!=null&&document.optJSONObject("record")!=null,"El registro ya no está disponible. Actualiza la cuenta.");return copy(document.getJSONObject("record"));}
    private static void revision(JSONObject document,JSONObject command)throws Exception{if(document==null||!document.optString("revision").equals(command.optString("expectedRevision")))throw new Problem("conflict","El registro cambió en otro teléfono. Carga la actualización y revisa antes de guardar.");}
    private static void actor(Tx tx,String uid,JSONObject actor)throws Exception{
        String id=text(actor,"id",128,true),name=text(actor,"name",80,true);JSONObject profile=tx.get("users/"+uid+"/profiles/"+encoded(id));
        require(profile!=null&&!profile.optBoolean("deleted")&&profile.optJSONObject("record")!=null,"Selecciona un usuario válido en Ajustes.");JSONObject r=profile.getJSONObject("record");
        require(r.optBoolean("active")&&id.equals(r.optString("id"))&&name.equals(r.optString("name")),"Tu usuario cambió o está inactivo. Revisa Ajustes antes de confirmar.");
    }
    private static JSONObject result(JSONObject sale,JSONObject stock,boolean replayed)throws Exception{
        return new JSONObject().put("documents",new JSONObject().put("sales",sale==null?new JSONArray():new JSONArray().put(sale)).put("inventory",stock==null?new JSONArray():new JSONArray().put(stock))).put("replayed",replayed);
    }
    static JSONObject execute(Tx tx,String uid,JSONObject command,String now)throws Exception{
        identity(uid);String id=text(command,"id",100,true),kind=text(command,"kind",30,true),target=text(command,"targetId",200,true);
        require(id.matches("[A-Za-z0-9_-]+"),"Revisa la solicitud.");require(java.util.Arrays.asList("confirmSale","editSale","saveWarranty","cancelSale","addStock","restock","organizeStock").contains(kind),"Operación no válida.");
        String ledgerPath="users/"+uid+"/suiteOperations/"+id,digest=fingerprint(command);JSONObject ledger=tx.get(ledgerPath);
        boolean isSale=kind.equals("confirmSale")||kind.equals("editSale")||kind.equals("saveWarranty")||kind.equals("cancelSale");String targetPath=path(uid,isSale?"sales":"inventory",target);JSONObject current=tx.get(targetPath);
        if(ledger!=null){require(digest.equals(ledger.optString("fingerprint")),"Esta solicitud ya corresponde a otra operación.");JSONObject stockDoc=null;if(isSale&&current!=null&&!current.getJSONObject("record").optString("stockId").isEmpty())stockDoc=tx.get(path(uid,"inventory",current.getJSONObject("record").getString("stockId")));return result(isSale?current:null,isSale?stockDoc:current,true);}
        JSONObject who=command.getJSONObject("actor");actor(tx,uid,who);JSONObject values=command.getJSONObject("values"),saleDoc=null,stockDoc=null,counter=null;String stockPath=null,counterPath=null;long stockDelta=0;
        Map<String,JSONObject> writes=new LinkedHashMap<>();
        if(kind.equals("confirmSale")){
            require(current==null,"Esta venta ya fue registrada. Abre su resumen.");JSONObject r=copy(values.getJSONObject("sale"));require(target.equals(r.optString("id")),"Revisa el identificador de la venta.");
            String draftSeller=r.optString("sellerId"),draftName=r.optString("sellerName"),draftAt=r.optString("createdAt");r.put("sellerId",who.getString("id")).put("sellerName",who.getString("name")).put("createdAt",now).put("status","Confirmada").put("paidAt",JSONObject.NULL).put("stockDeducted",false);
            if(!draftSeller.isEmpty()&&!draftSeller.equals(who.getString("id")))r.put("draftSellerId",draftSeller).put("draftSellerName",draftName).put("draftCreatedAt",draftAt);
            sale(r,false);require(r.optString("stockId").isEmpty()||r.optString("offerId").isEmpty(),"Elige un único origen del equipo.");
            JSONObject receipt=copy(r.getJSONObject("receipt"));receipt.put("deliveryDate",r.getString("date"));receipt(receipt,r.getLong("quantity"),false);
            if(!r.optString("stockId").isEmpty()){
                stockPath=path(uid,"inventory",r.getString("stockId"));JSONObject before=tx.get(stockPath),item=record(before);stock(item);
                require(item.getString("model").equals(r.getString("model"))&&item.getLong("cost")==r.getLong("cost"),"El equipo cambió. Selecciónalo otra vez.");
                long q=item.getLong("quantity")-r.getLong("quantity");require(q>=0,"No hay suficientes unidades disponibles. La venta queda como borrador.");item.put("quantity",q);r.put("stockDeducted",true).put("stockOwnerId",item.optString("ownerId")).put("stockOwnerName",owner(item.optString("ownerId")));stockDoc=wrap(item,id,before.optBoolean("legacy"));stockDelta=-r.getLong("quantity");
            }
            String month=r.getString("date").substring(0,7);counterPath="users/"+uid+"/suiteCounters/"+month;JSONObject previous=tx.get(counterPath);long sequence=previous==null?1:integer(previous,"sequence",0,MAX-1)+1;
            String number=month.substring(5)+String.format(java.util.Locale.ROOT,"%02d",sequence);r.put("saleMonth",month).put("saleSequence",sequence).put("saleNumber",number);receipt.put("number",number);r.put("receipt",receipt);counter=new JSONObject().put("month",month).put("sequence",sequence).put("legacy",false).put("lastOperationId",id).put("updatedAt",SERVER_TIME);saleDoc=wrap(r,id,false);
        }else if(kind.equals("editSale")){
            revision(current,command);JSONObject before=record(current),r=copy(before),patch=values.getJSONObject("patch");require(r.optString("status").equals("Confirmada"),"Solo puedes editar una venta confirmada.");
            java.util.List<String> allowed=java.util.Arrays.asList("client","model","date","quantity","price","cost","expenses","accessoryCost","notes","supplier","accessoryItems","accessories","receipt");
            java.util.Iterator<String> keys=patch.keys();while(keys.hasNext()){String key=keys.next();require(allowed.contains(key),"Hay campos de la venta que no se pueden cambiar.");if(!key.equals("receipt"))r.put(key,patch.get(key));}
            long quantity=integer(r,"quantity",1,1000),price=integer(r,"price",0,MAX),cost=integer(r,"cost",0,MAX),expenses=integer(r,"expenses",0,MAX),accessoryCost=r.has("accessoryCost")?integer(r,"accessoryCost",0,MAX):0;
            require(before.optString("stockId").isEmpty()||(before.getString("model").equals(r.getString("model"))&&before.getLong("cost")==cost),"El modelo y costo del equipo propio se conservan. Para cambiar de equipo, anula la venta y registra otra.");
            long accessories=r.has("accessories")?integer(r,"accessories",0,MAX):0;if(r.has("accessoryItems")){accessories=0;JSONArray items=r.getJSONArray("accessoryItems");for(int n=0;n<items.length();n++)accessories=safe(Math.addExact(accessories,integer(items.getJSONObject(n),"price",0,MAX)));r.put("accessories",accessories);}
            long revenue=safe(Math.addExact(Math.multiplyExact(quantity,price),accessories)),purchase=safe(Math.addExact(Math.multiplyExact(quantity,cost),accessoryCost));r.put("revenue",revenue).put("purchase",purchase).put("profit",safe(revenue-purchase-expenses-r.getLong("commission")));sale(r,true);
            JSONObject contact=patch.getJSONObject("receipt"),receipt=before.optJSONObject("receipt")==null?copy(contact):copy(before.getJSONObject("receipt"));for(String key:new String[]{"phone","paymentMethod","bank","months","channel"})if(contact.has(key))receipt.put(key,contact.get(key));
            receipt.put("deliveryDate",r.getString("date")).put("number",r.getString("saleNumber"));receipt(receipt,quantity,false);r.put("receipt",receipt).put("saleEditedById",who.getString("id")).put("saleEditedByName",who.getString("name")).put("saleEditedAt",now);
            long delta=before.getLong("quantity")-quantity;
            if(before.optBoolean("stockDeducted")&&!before.optString("stockId").isEmpty()&&delta!=0){stockPath=path(uid,"inventory",before.getString("stockId"));JSONObject stockBefore=tx.get(stockPath),item=record(stockBefore);long next=safe(Math.addExact(item.getLong("quantity"),delta));require(next>=0,"No hay suficientes unidades disponibles para este cambio.");item.put("quantity",next);stock(item);stockDoc=wrap(item,id,stockBefore.optBoolean("legacy"));stockDelta=delta;}
            saleDoc=wrap(r,id,current.optBoolean("legacy"));
        }else if(kind.equals("saveWarranty")){
            revision(current,command);JSONObject r=record(current);require(r.optString("status").equals("Confirmada"),"La venta cambió o está anulada.");JSONObject receipt=copy(values.getJSONObject("receipt"));receipt.put("number",r.getString("saleNumber")).put("deliveryDate",r.getString("date")).put("savedAt",now);receipt(receipt,r.getLong("quantity"),true);r.put("receipt",receipt).put("lastEditedById",who.getString("id")).put("lastEditedByName",who.getString("name")).put("lastEditedAt",now);saleDoc=wrap(r,id,current.optBoolean("legacy"));
        }else if(kind.equals("cancelSale")){
            revision(current,command);JSONObject r=record(current);require(r.optString("status").equals("Confirmada")&&r.isNull("paidAt"),"La venta ya cambió o mantiene un pago histórico.");String reason=text(values,"reason",500,true);
            if(r.optBoolean("stockDeducted")&&!r.optString("stockId").isEmpty()){stockPath=path(uid,"inventory",r.getString("stockId"));JSONObject before=tx.get(stockPath),item=record(before);item.put("quantity",safe(Math.addExact(item.getLong("quantity"),r.getLong("quantity"))));stock(item);stockDoc=wrap(item,id,before.optBoolean("legacy"));stockDelta=r.getLong("quantity");}
            r.put("status","Anulada").put("stockDeducted",false).put("cancelReason",reason).put("cancelledBy",who.getString("name")).put("cancelledById",who.getString("id")).put("cancelledAt",now);saleDoc=wrap(r,id,current.optBoolean("legacy"));
        }else if(kind.equals("addStock")){
            require(current==null,"Este equipo ya se guardó.");JSONObject item=copy(values.getJSONObject("stock"));require(target.equals(item.optString("id")),"Revisa el equipo.");item.put("createdBy",who.getString("id")).put("createdByName",who.getString("name")).put("createdAt",now);stock(item);stockPath=targetPath;stockDoc=wrap(item,id,false);stockDelta=item.getLong("quantity");
        }else{
            JSONObject item=record(current);if(kind.equals("restock")){stockDelta=integer(values,"quantity",1,100000);item.put("quantity",safe(Math.addExact(item.getLong("quantity"),stockDelta)));}
            else{revision(current,command);item.put("ownerId",text(values,"ownerId",128,false)).put("brand",text(values,"brand",60,false));}
            stock(item);stockPath=targetPath;stockDoc=wrap(item,id,current.optBoolean("legacy"));
        }
        if(saleDoc!=null)writes.put(targetPath,saleDoc);if(stockDoc!=null)writes.put(stockPath,stockDoc);if(counter!=null)writes.put(counterPath,counter);
        writes.put(ledgerPath,new JSONObject().put("id",id).put("kind",kind).put("targetId",target).put("targetKey",encoded(target)).put("actorId",who.getString("id")).put("actorName",who.getString("name")).put("actorKey",encoded(who.getString("id"))).put("fingerprint",digest).put("stockId",stockDoc==null?"":stockDoc.getString("id")).put("stockKey",stockDoc==null?"":encoded(stockDoc.getString("id"))).put("stockDelta",stockDelta).put("counterKey",counter==null?"":counter.getString("month")).put("sequence",counter==null?0:counter.getLong("sequence")).put("createdAt",SERVER_TIME));
        JSONObject result=result(saleDoc,stockDoc,false);if(counter!=null)result.put("counter",counter);for(Map.Entry<String,JSONObject> entry:writes.entrySet())tx.put(entry.getKey(),entry.getValue());return result;
    }
    static JSONObject importRecord(Tx tx,String uid,String collection,JSONObject original,String now)throws Exception{
        identity(uid);
        if(collection.equals("counters")){String month=text(original,"month",7,true);date(month+"-01");long sequence=integer(original,"sequence",0,MAX-1);String counterPath="users/"+uid+"/suiteCounters/"+month;JSONObject current=tx.get(counterPath);if(current==null||current.getLong("sequence")<sequence)tx.put(counterPath,new JSONObject().put("month",month).put("sequence",sequence).put("legacy",true).put("updatedAt",SERVER_TIME));return new JSONObject().put("id",month);}
        require(java.util.Arrays.asList("sales","inventory").contains(collection),"Colección no válida.");JSONObject r=copy(original);String id=text(r,"id",200,true),path=path(uid,collection,id);JSONObject existing=tx.get(path);if(existing!=null)return existing;
        JSONObject counter=null;String counterPath=null;
        if(collection.equals("inventory"))stock(r);else{
            sale(r,true);String month=r.getString("date").substring(0,7);counterPath="users/"+uid+"/suiteCounters/"+month;JSONObject before=tx.get(counterPath);long last=before==null?0:integer(before,"sequence",0,MAX-1),sequence=r.optLong("saleSequence",0);String number=r.optString("saleNumber");if(number.isEmpty()&&r.optJSONObject("receipt")!=null)number=r.getJSONObject("receipt").optString("number");
            if(sequence<=0&&number.matches(month.substring(5)+"[0-9]{1,16}"))try{sequence=Long.parseLong(number.substring(2));}catch(NumberFormatException ignored){}
            if(sequence<=0)sequence=last+1;require(sequence<=MAX,"Revisa el correlativo histórico.");if(number.isEmpty())number=month.substring(5)+String.format(java.util.Locale.ROOT,"%02d",sequence);
            r.put("saleSequence",sequence).put("saleMonth",month).put("saleNumber",number);if(r.optJSONObject("receipt")!=null)r.getJSONObject("receipt").put("number",number);
            if(sequence>last)counter=new JSONObject().put("month",month).put("sequence",sequence).put("legacy",true).put("updatedAt",SERVER_TIME);
        }
        JSONObject result=wrap(r,"import-"+fingerprint(r).substring(0,64),true);if(counter!=null)tx.put(counterPath,counter);tx.put(path,result);return result;
    }
}
