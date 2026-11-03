package com.crmcelulares.app;

import android.content.Context;
import android.util.Base64;

import com.google.android.gms.tasks.Task;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseNetworkException;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.MetadataChanges;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Firebase's native SDK owns authentication, durable offline writes and reconnects. */
public final class CloudSyncManager {
    public interface Sink { void send(JSONObject event); }
    private Sink sink;
    private FirebaseAuth auth;
    private FirebaseFirestore database;
    private FirebaseAuth.AuthStateListener authListener;
    private final Map<String, ListenerRegistration> listeners = new HashMap<>();
    private final Map<String, JSONObject> snapshots = new HashMap<>();
    private String listeningUid;
    private final Set<String> inFlight = ConcurrentHashMap.newKeySet();
    private final CloudWriteCache completedWrites = new CloudWriteCache(512);

    public CloudSyncManager(Context context, Sink sink) {
        this.sink = sink;
        if (BuildConfig.FIREBASE_PROJECT_ID.isEmpty() || BuildConfig.FIREBASE_API_KEY.isEmpty()
                || BuildConfig.FIREBASE_APP_ID.isEmpty()) return;
        FirebaseApp app = null;
        for (FirebaseApp candidate : FirebaseApp.getApps(context)) {
            if (candidate.getName().equals("LunivoCloud")) app = candidate;
        }
        if (app == null) app = FirebaseApp.initializeApp(context, new FirebaseOptions.Builder()
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setApplicationId(BuildConfig.FIREBASE_APP_ID).build(), "LunivoCloud");
        auth = FirebaseAuth.getInstance(app);
        database = FirebaseFirestore.getInstance(app);
        // Disk persistence is enabled by default on Android; do not clear queued writes on logout.
        authListener = currentAuth -> {
            listenToAccount(currentAuth.getCurrentUser());
            state();
        };
        auth.addAuthStateListener(authListener);
    }

    public void handle(JSONObject message) throws JSONException {
        String type = message.getString("type");
        if (type.equals("cloudState")) { state(); return; }
        if (auth == null) {
            error("La sincronización todavía no está disponible en esta versión. Tus datos siguen en este teléfono.");
            return;
        }
        switch (type) {
            case "cloudSignIn":
            case "cloudRegister": {
                String email = message.getString("email").trim();
                String password = message.getString("password");
                if (email.length() > 254 || password.length() < 8 || password.length() > 128) {
                    error("Usa un correo válido y una contraseña de al menos 8 caracteres.");
                    return;
                }
                Task<?> task = type.equals("cloudRegister")
                        ? auth.createUserWithEmailAndPassword(email, password)
                        : auth.signInWithEmailAndPassword(email, password);
                task.addOnFailureListener(this::authError);
                break;
            }
            case "cloudResetPassword":
                auth.sendPasswordResetEmail(message.getString("email").trim())
                        .addOnSuccessListener(ignored -> send("cloudMessage", "Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar el acceso."))
                        .addOnFailureListener(this::authError);
                break;
            case "cloudSignOut":
                auth.signOut();
                break;
            case "cloudFlush":
                flush(message.getString("uid"), message.getJSONArray("operations"), false);
                break;
            case "cloudProfilesFlush":
                flush(message.getString("uid"), message.getJSONArray("operations"), true);
                break;
            default:
                error("Acción de sincronización desconocida.");
        }
    }

    public void state() {
        try {
            FirebaseUser user = auth == null ? null : auth.getCurrentUser();
            sink.send(new JSONObject().put("type", "cloudState").put("configured", auth != null)
                    .put("uid", user == null ? JSONObject.NULL : user.getUid())
                    .put("email", user == null ? "" : user.getEmail()));
            if (user != null) for (JSONObject snapshot : snapshots.values()) {
                if (user.getUid().equals(snapshot.optString("uid"))) sink.send(snapshot);
            }
        } catch (JSONException error) {
            error("No se pudo consultar el estado de la cuenta.");
        }
    }

    private void listenToAccount(FirebaseUser user) {
        String uid = user == null ? null : user.getUid();
        if (uid != null && uid.equals(listeningUid)) return;
        for (ListenerRegistration listener : listeners.values()) listener.remove();
        listeners.clear();
        listeningUid = uid;
        snapshots.clear();
        if (uid == null) return;
        listen(uid, "followups", "cloudSnapshot");
        listen(uid, "profiles", "cloudProfilesSnapshot");
    }

    private void listen(String uid, String collection, String eventType) {
        ListenerRegistration listener = database.collection("users").document(uid).collection(collection)
                .addSnapshotListener(MetadataChanges.INCLUDE, (snapshot, failure) -> {
                    if (auth.getCurrentUser() == null || !uid.equals(auth.getCurrentUser().getUid())) return;
                    if (failure != null) {
                        error("No se pudo acceder a la nube. Revisa la conexión y la configuración del servicio.");
                        return;
                    }
                    if (snapshot == null) return;
                    JSONArray documents = new JSONArray();
                    try {
                        for (DocumentSnapshot doc : snapshot.getDocuments()) {
                            Map<String, Object> data = doc.getData();
                            if (data == null) continue;
                            JSONObject item = new JSONObject(data);
                            // Never interpret a disk-cache snapshot as server acknowledgement.
                            item.put("committed", !snapshot.getMetadata().isFromCache() && !doc.getMetadata().hasPendingWrites());
                            documents.put(item);
                        }
                        JSONObject event = new JSONObject().put("type", eventType).put("uid", uid)
                                .put("fromCache", snapshot.getMetadata().isFromCache())
                                .put("documents", documents);
                        snapshots.put(collection, event);
                        sink.send(event);
                    } catch (JSONException invalid) {
                        error("No se pudieron leer los seguimientos de la nube.");
                    }
                });
        listeners.put(collection, listener);
    }

    private void flush(String uid, JSONArray operations, boolean profiles) throws JSONException {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null || !user.getUid().equals(uid)) {
            error("Vuelve a iniciar sesión para sincronizar esta cuenta.");
            return;
        }
        if (operations.length() > 10000) throw new JSONException("Demasiadas operaciones");
        for (int n = 0; n < operations.length(); n++) {
            JSONObject operation = operations.getJSONObject(n);
            String id = checkedText(operation, "id", 200);
            String revision = checkedText(operation, "revision", 100);
            boolean deleted = operation.getBoolean("deleted");
            Map<String, Object> data = new HashMap<>();
            data.put("id", id);
            data.put("revision", revision);
            data.put("deleted", deleted);
            data.put("updatedAt", FieldValue.serverTimestamp());
            if (!deleted) {
                JSONObject record = operation.getJSONObject("record");
                if (!id.equals(record.optString("id"))) throw new JSONException("Identificador no coincide");
                Map<String, Object> values = CloudRecordCodec.decode(record, profiles);
                data.put("record", values);
            }
            String token = uid + ":" + (profiles ? "profiles" : "followups") + ":" + id + ":" + revision;
            JSONObject completed = completedWrites.get(token);
            if (completed != null) { sink.send(completed); continue; }
            if (!inFlight.add(token)) continue;
            // Base64 URL IDs preserve even legacy identifiers containing slashes.
            String documentId = Base64.encodeToString(id.getBytes(StandardCharsets.UTF_8),
                    Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            DocumentReference doc = database.collection("users").document(uid).collection(profiles ? "profiles" : "followups").document(documentId);
            Task<?> write;
            if (!deleted && operation.optBoolean("importing")) {
                // Importing legacy data must not overwrite an existing copy on another phone.
                write = database.runTransaction(transaction -> {
                    DocumentSnapshot existing = transaction.get(doc);
                    if (!existing.exists()) {
                        transaction.set(doc, data);
                        return null;
                    }
                    return existing.getData();
                });
            } else {
                write = doc.set(data);
            }
            write.addOnSuccessListener(ignored -> {
                inFlight.remove(token);
                try {
                    JSONObject ack = new JSONObject().put("type", profiles ? "cloudProfilesAck" : "cloudAck").put("uid", uid)
                            .put("id", id).put("revision", revision);
                    if (ignored instanceof Map) ack.put("existing", new JSONObject((Map<?, ?>) ignored).put("committed", true));
                    completedWrites.put(token, ack);
                    if (auth.getCurrentUser() != null && uid.equals(auth.getCurrentUser().getUid())) sink.send(ack);
                } catch (JSONException invalid) {
                    error("El cambio se guardó en la nube; vuelve a abrir la app para confirmar su estado.");
                }
            }).addOnFailureListener(failure -> {
                inFlight.remove(token);
                if (auth.getCurrentUser() != null && uid.equals(auth.getCurrentUser().getUid())) {
                    error("El cambio sigue guardado en este teléfono. Reintenta la sincronización cuando tengas conexión.");
                }
            });
        }
    }

    private static String checkedText(JSONObject object, String field, int max) throws JSONException {
        Object value = object.get(field);
        if (!(value instanceof String) || ((String) value).isEmpty() || ((String) value).length() > max) {
            throw new JSONException("Campo inválido: " + field);
        }
        return (String) value;
    }

    private void authError(Exception failure) {
        error(failure instanceof FirebaseNetworkException
                ? "No hay conexión. Puedes seguir trabajando en el teléfono y volver a intentarlo después."
                : "No se pudo acceder a la cuenta. Revisa el correo y la contraseña o recupera el acceso.");
    }

    private void send(String type, String message) {
        try { sink.send(new JSONObject().put("type", type).put("message", message)); }
        catch (JSONException ignored) { /* Both keys and strings are controlled by this class. */ }
    }

    private void error(String message) { send("cloudError", message); }

    public void invalidRequest() { error("No se pudo procesar la sincronización. Los cambios locales se conservan."); }

    public void close() {
        if (auth != null && authListener != null) auth.removeAuthStateListener(authListener);
        for (ListenerRegistration listener : listeners.values()) listener.remove();
        listeners.clear();
        sink = ignored -> {};
    }
}
