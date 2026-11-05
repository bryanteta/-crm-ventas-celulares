package com.crmcelulares.app;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.MetadataChanges;
import com.google.firebase.firestore.Transaction;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/** Account-scoped shared sales/stock. Provider lists and local drafts never enter Firestore. */
final class BusinessCloudManager {
    private final FirebaseAuth auth;
    private final FirebaseFirestore database;
    private final Consumer<JSONObject> sink;
    private final List<ListenerRegistration> listeners=new ArrayList<>();
    private final Map<String,Map<String,JSONObject>> books=new HashMap<>();
    private final Map<String,Boolean> server=new HashMap<>();
    private String uid;
    private boolean closed;
    BusinessCloudManager(FirebaseAuth auth,FirebaseFirestore database,Consumer<JSONObject> sink){this.auth=auth;this.database=database;this.sink=sink;}
    private boolean current(String id){return !closed&&id!=null&&id.equals(uid)&&auth.getCurrentUser()!=null&&id.equals(auth.getCurrentUser().getUid());}
    private void emit(JSONObject event){if(!closed)sink.accept(event);}
    void account(String next){
        if(java.util.Objects.equals(uid,next))return;for(ListenerRegistration l:listeners)l.remove();listeners.clear();books.clear();server.clear();uid=next;
        if(next==null){replay();return;}
        for(String collection:new String[]{"sales","inventory"}){
            books.put(collection,new LinkedHashMap<>());server.put(collection,false);
            listeners.add(database.collection(BusinessEngine.collection(next,collection)).addSnapshotListener(MetadataChanges.INCLUDE,(snapshot,error)->{
                if(!current(next))return;
                try{
                    if(error!=null){server.put(collection,false);emit(new JSONObject().put("type","cloudSuiteError").put("uid",next).put("message","No se pudo abrir Ventas compartidas. Revisa tu conexión o la configuración de la cuenta."));replayState();return;}
                    if(snapshot==null)return;
                    boolean cache=snapshot.getMetadata().isFromCache(),reset=!Boolean.TRUE.equals(server.get(collection));
                    JSONArray changes=new JSONArray();Map<String,JSONObject> book=books.get(collection);
                    if(reset){book.clear();for(DocumentSnapshot doc:snapshot.getDocuments()){if(doc.getData()==null)continue;JSONObject value=new JSONObject(doc.getData());book.put(doc.getId(),value);changes.put(value);}}
                    else for(com.google.firebase.firestore.DocumentChange change:snapshot.getDocumentChanges()){
                        DocumentSnapshot doc=change.getDocument();if(change.getType()==com.google.firebase.firestore.DocumentChange.Type.REMOVED){book.remove(doc.getId());changes.put(new JSONObject().put("removed",true).put("id",doc.getString("id")));}
                        else if(doc.getData()!=null){JSONObject value=new JSONObject(doc.getData());book.put(doc.getId(),value);changes.put(value);}
                    }
                    server.put(collection,!cache);
                    emit(new JSONObject().put("type","cloudSuiteSnapshot").put("uid",next).put("collection",collection).put("reset",reset).put("fromCache",cache).put("documents",changes));
                    replayState();
                }catch(Exception invalid){server.put(collection,false);try{emit(new JSONObject().put("type","cloudSuiteError").put("uid",next).put("message","No se pudieron leer los registros compartidos. Se conserva la copia del teléfono."));}catch(Exception ignored){}}
            }));
        }
    }
    private void replayState(){try{emit(new JSONObject().put("type","cloudSuiteState").put("uid",uid==null?JSONObject.NULL:uid).put("ready",Boolean.TRUE.equals(server.get("sales"))&&Boolean.TRUE.equals(server.get("inventory"))));}catch(Exception ignored){}}
    void replay(){
        try{if(uid!=null)for(String name:new String[]{"sales","inventory"}){JSONArray rows=new JSONArray();for(JSONObject value:books.getOrDefault(name,new HashMap<>()).values())rows.put(value);emit(new JSONObject().put("type","cloudSuiteSnapshot").put("uid",uid).put("collection",name).put("reset",true).put("fromCache",!Boolean.TRUE.equals(server.get(name))).put("documents",rows));}replayState();}catch(Exception ignored){}
    }
    private static Object decode(Object value)throws Exception{
        if(value==JSONObject.NULL)return null;
        if(value instanceof JSONObject){Map<String,Object> map=new HashMap<>();JSONObject o=(JSONObject)value;java.util.Iterator<String> keys=o.keys();while(keys.hasNext()){String key=keys.next();map.put(key,decode(o.get(key)));}return map;}
        if(value instanceof JSONArray){List<Object> list=new ArrayList<>();JSONArray a=(JSONArray)value;for(int n=0;n<a.length();n++)list.add(decode(a.get(n)));return list;}
        return value;
    }
    @SuppressWarnings("unchecked")
    private BusinessEngine.Tx adapter(Transaction transaction){return new BusinessEngine.Tx(){
        @Override public JSONObject get(String path)throws Exception{DocumentSnapshot document=transaction.get(database.document(path));return document.exists()&&document.getData()!=null?new JSONObject(document.getData()):null;}
        @Override public void put(String path,JSONObject value)throws Exception{Map<String,Object> data=(Map<String,Object>)decode(value);if(value.has("updatedAt"))data.put("updatedAt",FieldValue.serverTimestamp());if(path.contains("/suiteOperations/"))data.put("createdAt",FieldValue.serverTimestamp());transaction.set(database.document(path),data);}
    };}
    void handle(JSONObject request)throws Exception{
        String type=request.getString("type"),requestId=request.optString("requestId"),requested=request.optString("uid");
        if(type.equals("cloudSuiteState")){replay();return;}
        if(!current(requested)){failure(requestId,requested,new BusinessEngine.Problem("account","Vuelve a iniciar sesión en la cuenta correcta."));return;}
        if(type.equals("cloudSuiteCommit")){
            JSONObject operation=request.getJSONObject("operation");if(operation.toString().length()>80000)throw new IllegalArgumentException("Operación demasiado grande");
            commit(requestId,requested,operation,0);
        }else if(type.equals("cloudSuiteImport")){
            String collection=request.getString("collection");JSONArray rows=request.getJSONArray("records");if(rows.length()>30)throw new IllegalArgumentException("Demasiados registros");
            importNext(requestId,requested,collection,rows,0,new JSONArray());
        }else throw new IllegalArgumentException("Acción desconocida");
    }
    // Rules can reject a stale counter before Firestore reports its transaction conflict.
    // Retry the same durable operation against fresh reads; the ledger prevents duplicate sales.
    private void commit(String requestId,String requested,JSONObject operation,int attempt){
        if(!current(requested))return;
        database.runTransaction(transaction->{try{return BusinessEngine.execute(adapter(transaction),requested,operation,Instant.now().toString());}catch(FirebaseFirestoreException error){throw error;}catch(Exception error){throw new FirebaseFirestoreException("Revisa los datos de la operación.",FirebaseFirestoreException.Code.INVALID_ARGUMENT,error);}})
            .addOnSuccessListener(result->{if(current(requested))try{emit(result.put("type","cloudSuiteResult").put("uid",requested).put("requestId",requestId).put("operationId",operation.optString("id")));}catch(Exception ignored){}})
            .addOnFailureListener(error->{
                if(error instanceof FirebaseFirestoreException && ((FirebaseFirestoreException)error).getCode()==FirebaseFirestoreException.Code.PERMISSION_DENIED && attempt<4){
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(()->commit(requestId,requested,operation,attempt+1),150L*(attempt+1));
                }else failure(requestId,requested,error);
            });
    }
    private void importNext(String requestId,String requested,String collection,JSONArray rows,int n,JSONArray imported){
        if(!current(requested))return;
        try{
            if(n>=rows.length()){emit(new JSONObject().put("type","cloudSuiteImportResult").put("uid",requested).put("requestId",requestId).put("collection",collection).put("documents",imported));return;}
            JSONObject record=rows.getJSONObject(n);
            database.runTransaction(transaction->{try{return BusinessEngine.importRecord(adapter(transaction),requested,collection,record,Instant.now().toString());}catch(FirebaseFirestoreException error){throw error;}catch(Exception error){throw new FirebaseFirestoreException("Revisa los registros anteriores.",FirebaseFirestoreException.Code.INVALID_ARGUMENT,error);}})
                    .addOnSuccessListener(result->{imported.put(result);importNext(requestId,requested,collection,rows,n+1,imported);})
                    .addOnFailureListener(error->failure(requestId,requested,error));
        }catch(Exception error){failure(requestId,requested,error);}
    }
    void failure(String requestId,String requested,Throwable error){
        if(closed)return;String message="No se pudo confirmar con la nube. La solicitud se conserva para reintentar sin duplicarla.";boolean definitive=false;String code="connection";
        Throwable cause=error;while(cause!=null){if(cause instanceof BusinessEngine.Problem){code=((BusinessEngine.Problem)cause).code;definitive=!code.equals("account");message=cause.getMessage();break;}cause=cause.getCause();}
        if(error instanceof FirebaseFirestoreException&&((FirebaseFirestoreException)error).getCode()==FirebaseFirestoreException.Code.INVALID_ARGUMENT){definitive=true;if(code.equals("connection")){code="validation";message="Revisa los datos de la operación.";}}
        if(error instanceof FirebaseFirestoreException&&((FirebaseFirestoreException)error).getCode()==FirebaseFirestoreException.Code.PERMISSION_DENIED){code="permission";message="Ventas compartidas no está habilitada para esta cuenta. Solicita al administrador actualizar la configuración y reintenta. La solicitud se conserva.";}
        try{emit(new JSONObject().put("type","cloudSuiteError").put("uid",requested).put("requestId",requestId).put("definitive",definitive).put("code",code).put("message",message));}catch(Exception ignored){}
    }
    void close(){closed=true;for(ListenerRegistration listener:listeners)listener.remove();listeners.clear();books.clear();}
}
