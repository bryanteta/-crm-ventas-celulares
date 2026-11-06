package com.crmcelulares.app;

import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.util.HashMap;
import java.util.Map;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class BusinessEngineTest {
    static final String UID="account",NOW="2026-11-05T12:00:00Z";
    static class Memory implements BusinessEngine.Tx {
        final Map<String,JSONObject> rows=new HashMap<>(),writes=new HashMap<>();boolean writing;
        Memory()throws Exception{rows.put("users/"+UID+"/profiles/"+BusinessEngine.encoded("ana"),new JSONObject("{\"record\":{\"id\":\"ana\",\"name\":\"Ana\",\"active\":true},\"deleted\":false}"));}
        public JSONObject get(String path)throws Exception{assertFalse("Firestore requires all reads before writes",writing);return rows.containsKey(path)?new JSONObject(rows.get(path).toString()):null;}
        public void put(String path,JSONObject value)throws Exception{writing=true;writes.put(path,new JSONObject(value.toString()));}
        JSONObject run(JSONObject op)throws Exception{writing=false;writes.clear();try{JSONObject result=BusinessEngine.execute(this,UID,op,NOW);rows.putAll(writes);return result;}finally{writing=false;writes.clear();}}
    }
    static JSONObject command(String id,String kind,String target,JSONObject values)throws Exception{return new JSONObject().put("id",id).put("kind",kind).put("targetId",target).put("actor",new JSONObject("{\"id\":\"ana\",\"name\":\"Ana\"}")).put("values",values);}
    static JSONObject stock(String id,long quantity)throws Exception{return new JSONObject().put("id",id).put("model","iPhone 14").put("brand","Apple").put("ownerId","lunivo").put("quantity",quantity).put("cost",35000);}
    static JSONObject receipt(boolean complete)throws Exception{return new JSONObject().put("version",1).put("number","").put("deliveryDate","2026-11-05").put("brand",complete?"Apple":"").put("capacity",complete?"128 GB":"").put("color",complete?"Negro":"").put("condition",complete?"Seminuevo":"").put("battery",complete?"100%":"").put("physical",complete?"Sin daños visibles":"").put("serials",new JSONArray()).put("phone","").put("paymentMethod","Efectivo").put("bank","").put("months",JSONObject.NULL).put("warrantyMonths",3).put("terms",new JSONArray().put("Uno").put("Dos").put("Tres")).put("gifts",new JSONArray());}
    static JSONObject sale(String id,String stockId)throws Exception{return new JSONObject().put("id",id).put("client","Cliente").put("model","iPhone 14").put("date","2026-11-05").put("quantity",1).put("price",45000).put("cost",35000).put("expenses",0).put("accessories",0).put("accessoryCost",0).put("revenue",45000).put("purchase",35000).put("commission",0).put("profit",10000).put("commissionEnabled",false).put("status","Confirmada").put("stockId",stockId).put("offerId","").put("paidAt",JSONObject.NULL).put("sellerId","draft-user").put("sellerName","Borrador anterior").put("createdAt",NOW).put("receipt",receipt(false));}
    static JSONObject add(Memory db,String id,long quantity)throws Exception{return db.run(command("add-"+id,"addStock",id,new JSONObject().put("stock",stock(id,quantity))));}
    @Test public void confirmationStampsActorAllocatesGlobalNumberAndDeductsTogether()throws Exception{
        Memory db=new Memory();add(db,"one",2);JSONObject result=db.run(command("sell","confirmSale","sale",new JSONObject().put("sale",sale("sale","one"))));JSONObject r=result.getJSONObject("documents").getJSONArray("sales").getJSONObject(0).getJSONObject("record");assertEquals("1101",r.getString("saleNumber"));assertEquals("Ana",r.getString("sellerName"));assertEquals("draft-user",r.getString("draftSellerId"));assertEquals(1,db.rows.get(BusinessEngine.path(UID,"inventory","one")).getJSONObject("record").getLong("quantity"));assertEquals(1,db.rows.get("users/"+UID+"/suiteCounters/2026-11").getLong("sequence"));
    }
    @Test public void retryWithSameOperationCannotDuplicateSaleStockOrNumber()throws Exception{
        Memory db=new Memory();add(db,"one",2);JSONObject op=command("sell","confirmSale","sale",new JSONObject().put("sale",sale("sale","one")));db.run(op);assertTrue(db.run(op).getBoolean("replayed"));assertEquals(1,db.rows.get(BusinessEngine.path(UID,"inventory","one")).getJSONObject("record").getLong("quantity"));assertEquals(1,db.rows.get("users/"+UID+"/suiteCounters/2026-11").getLong("sequence"));
    }
    @Test public void sameOperationCannotBeReusedForDifferentAmounts()throws Exception{
        Memory db=new Memory();add(db,"one",2);JSONObject op=command("restock","restock","one",new JSONObject().put("quantity",1));db.run(op);op.getJSONObject("values").put("quantity",5);assertThrows(BusinessEngine.Problem.class,()->db.run(op));assertEquals(3,db.rows.get(BusinessEngine.path(UID,"inventory","one")).getJSONObject("record").getLong("quantity"));
    }
    @Test public void stockConflictDoesNotWriteSaleCounterOrLedger()throws Exception{
        Memory db=new Memory();add(db,"one",0);int before=db.rows.size();assertThrows(BusinessEngine.Problem.class,()->db.run(command("sell","confirmSale","sale",new JSONObject().put("sale",sale("sale","one")))));assertEquals(before,db.rows.size());assertFalse(db.rows.containsKey("users/"+UID+"/suiteCounters/2026-11"));
    }
    @Test public void cancellationReturnsStockOnlyOnceAndPreservesSeller()throws Exception{
        Memory db=new Memory();add(db,"one",2);db.run(command("sell","confirmSale","sale",new JSONObject().put("sale",sale("sale","one"))));JSONObject op=command("cancel","cancelSale","sale",new JSONObject().put("reason","Cliente canceló")).put("expectedRevision","sell");db.run(op);db.run(op);JSONObject r=db.rows.get(BusinessEngine.path(UID,"sales","sale")).getJSONObject("record");assertEquals("Anulada",r.getString("status"));assertEquals("Ana",r.getString("sellerName"));assertEquals(2,db.rows.get(BusinessEngine.path(UID,"inventory","one")).getJSONObject("record").getLong("quantity"));
    }
    @Test public void staleWarrantyCannotOverwriteAnotherPhone()throws Exception{
        Memory db=new Memory();db.run(command("sell","confirmSale","sale",new JSONObject().put("sale",sale("sale",""))));JSONObject update=command("warranty","saveWarranty","sale",new JSONObject().put("receipt",receipt(true))).put("expectedRevision","sell");db.run(update);JSONObject stale=command("stale","saveWarranty","sale",new JSONObject().put("receipt",receipt(true))).put("expectedRevision","sell");assertThrows(BusinessEngine.Problem.class,()->db.run(stale));assertEquals("warranty",db.rows.get(BusinessEngine.path(UID,"sales","sale")).getString("revision"));assertEquals("Ana",db.rows.get(BusinessEngine.path(UID,"sales","sale")).getJSONObject("record").getString("sellerName"));
    }
    @Test public void inactiveActorCannotConfirmButCanRecoverAnAlreadyCommittedRequest()throws Exception{
        Memory db=new Memory();JSONObject op=command("sell","confirmSale","sale",new JSONObject().put("sale",sale("sale","")));db.run(op);db.rows.get("users/"+UID+"/profiles/"+BusinessEngine.encoded("ana")).getJSONObject("record").put("active",false);assertTrue(db.run(op).getBoolean("replayed"));assertThrows(BusinessEngine.Problem.class,()->db.run(command("second","confirmSale","second",new JSONObject().put("sale",sale("second","")))));
    }
    @Test public void importsNeverOverwriteExistingRemoteRecordsAndPreserveHistoricalCounter()throws Exception{
        Memory db=new Memory();JSONObject legacy=sale("old","").put("saleNumber","1142").put("saleSequence",42);db.writing=false;JSONObject imported=BusinessEngine.importRecord(db,UID,"sales",legacy,NOW);db.rows.putAll(db.writes);db.writes.clear();db.writing=false;assertEquals("1142",imported.getJSONObject("record").getString("saleNumber"));legacy.put("client","Otra copia");BusinessEngine.importRecord(db,UID,"sales",legacy,NOW);assertTrue(db.writes.isEmpty());db.writing=false;JSONObject current=db.run(command("next","confirmSale","next",new JSONObject().put("sale",sale("next",""))));assertEquals("1143",current.getJSONObject("documents").getJSONArray("sales").getJSONObject(0).getJSONObject("record").getString("saleNumber"));
    }
    @Test public void tamperedTotalsAndFractionalUnitsAreRejected()throws Exception{
        Memory db=new Memory();JSONObject bad=sale("bad","").put("profit",1);assertThrows(BusinessEngine.Problem.class,()->db.run(command("bad","confirmSale","bad",new JSONObject().put("sale",bad))));JSONObject fraction=sale("fraction","").put("quantity",1.5);JSONObject op=command("fraction","confirmSale","fraction",new JSONObject().put("sale",fraction));assertThrows(BusinessEngine.Problem.class,()->db.run(op));
    }
    @Test public void saleEditIsAtomicIdempotentAndKeepsOriginalAttributionAndNumber()throws Exception{
        Memory db=new Memory();add(db,"one",3);db.run(command("sell","confirmSale","sale",new JSONObject().put("sale",sale("sale","one"))));
        JSONObject patch=new JSONObject().put("client","Cliente corregido").put("quantity",3).put("price",60000).put("date","2026-10-24").put("receipt",receipt(false));JSONObject op=command("edit","editSale","sale",new JSONObject().put("patch",patch)).put("expectedRevision","sell");db.run(op);assertTrue(db.run(op).getBoolean("replayed"));
        JSONObject r=db.rows.get(BusinessEngine.path(UID,"sales","sale")).getJSONObject("record");assertEquals("Ana",r.getString("sellerName"));assertEquals("1101",r.getString("saleNumber"));assertEquals("2026-11",r.getString("saleMonth"));assertEquals("2026-10-24",r.getJSONObject("receipt").getString("deliveryDate"));assertEquals(180000,r.getLong("revenue"));assertEquals(0,db.rows.get(BusinessEngine.path(UID,"inventory","one")).getJSONObject("record").getLong("quantity"));assertEquals(1,db.rows.get("users/"+UID+"/suiteCounters/2026-11").getLong("sequence"));
    }
    @Test public void staleOrImpossibleSaleEditsCannotPartiallyChangeStock()throws Exception{
        Memory db=new Memory();add(db,"one",1);db.run(command("sell","confirmSale","sale",new JSONObject().put("sale",sale("sale","one"))));int before=db.rows.size();JSONObject values=new JSONObject().put("patch",new JSONObject().put("quantity",2).put("receipt",receipt(false)));
        assertThrows(BusinessEngine.Problem.class,()->db.run(command("no-stock","editSale","sale",values).put("expectedRevision","sell")));assertEquals(before,db.rows.size());
        assertThrows(BusinessEngine.Problem.class,()->db.run(command("stale","editSale","sale",values).put("expectedRevision","old")));assertEquals(0,db.rows.get(BusinessEngine.path(UID,"inventory","one")).getJSONObject("record").getLong("quantity"));
        JSONObject tampered=new JSONObject().put("patch",new JSONObject().put("sellerName","Otro autor").put("receipt",receipt(false)));assertThrows(BusinessEngine.Problem.class,()->db.run(command("author","editSale","sale",tampered).put("expectedRevision","sell")));
    }
    @Test public void cancellingAnEditedQuantityReturnsTheRevisedUnitsExactlyOnce()throws Exception{
        Memory db=new Memory();add(db,"one",4);db.run(command("sell","confirmSale","sale",new JSONObject().put("sale",sale("sale","one"))));db.run(command("edit","editSale","sale",new JSONObject().put("patch",new JSONObject().put("quantity",3).put("receipt",receipt(false)))).put("expectedRevision","sell"));JSONObject cancel=command("cancel","cancelSale","sale",new JSONObject().put("reason","Cancelada")).put("expectedRevision","edit");db.run(cancel);db.run(cancel);assertEquals(4,db.rows.get(BusinessEngine.path(UID,"inventory","one")).getJSONObject("record").getLong("quantity"));
    }
    @Test public void confirmationAndWarrantyAlwaysTakeTheSaleDateRatherThanIssueDate()throws Exception{
        Memory db=new Memory();JSONObject draft=sale("sale","").put("date","2026-10-24");draft.getJSONObject("receipt").put("deliveryDate","2026-11-06");db.run(command("sell","confirmSale","sale",new JSONObject().put("sale",draft)));assertEquals("2026-10-24",db.rows.get(BusinessEngine.path(UID,"sales","sale")).getJSONObject("record").getJSONObject("receipt").getString("deliveryDate"));JSONObject receipt=receipt(true).put("deliveryDate","2026-11-06");db.run(command("warranty","saveWarranty","sale",new JSONObject().put("receipt",receipt)).put("expectedRevision","sell"));assertEquals("2026-10-24",db.rows.get(BusinessEngine.path(UID,"sales","sale")).getJSONObject("record").getJSONObject("receipt").getString("deliveryDate"));
    }
}
