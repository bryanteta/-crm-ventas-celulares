package com.crmcelulares.app;

import android.app.Activity;
import android.content.Intent;
import android.widget.Toast;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.function.Consumer;
import java.io.IOException;
import org.json.JSONObject;
import org.json.JSONException;
import android.os.Handler;
import android.os.Looper;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** A document served from memory at a local HTTPS URL; never navigate to a data/srcdoc page. */
final class ReceiptPrinter {
    static final String DOCUMENT_URL = "https://appassets.androidplatform.net/lunivo/receipt.html";
    static final String LOGO_URL = "https://appassets.androidplatform.net/assets/www/assets/lunivo-mark.png";
    static final int EXPORT_REQUEST = 6301;
    private final Activity activity;
    private PendingExport pendingExport;
    private boolean exporting;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService exportWorker = Executors.newSingleThreadExecutor();
    private boolean closed;
    private final ReceiptActionGate gate = new ReceiptActionGate();
    private final ArrayList<WebView> preparingDocuments = new ArrayList<>();
    private static final class PendingExport {
        final JSONObject document;
        final Consumer<String> status;
        PendingExport(JSONObject document, Consumer<String> status) { this.document = document; this.status = status; }
    }
    static PrintAttributes highQualityAttributes() {
        return new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setResolution(new PrintAttributes.Resolution("lunivo-600", "Alta calidad", 600, 600))
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR).build();
    }
    static Intent exportIntent(String name) {
        return new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/pdf").putExtra(Intent.EXTRA_TITLE, name + ".pdf");
    }

    private final ArrayList<WebView> documents = new ArrayList<>();
    ReceiptPrinter(Activity activity) { this.activity = activity; }
    static boolean validRequest(String html, String name) {
        return html != null && html.startsWith("<!doctype html>") && html.length() <= 200000
                && name != null && (name.matches("Lunivo-[0-9]{4}-[0-9]{3,20}") || name.matches("Lunivo - [\\p{L}\\p{M}\\p{N} ()-]{1,160}"));
    }

    // Separately testable routing and readiness: an error page must never become a receipt.
    static final class DocumentClient extends WebViewClient {
        private final byte[] document;
        private final WebViewAssetLoader assets;
        private final Runnable ready;
        private final Runnable error;
        private volatile boolean served;
        private boolean finished;
        DocumentClient(String html, WebViewAssetLoader assets, Runnable ready, Runnable error) {
            document = html.getBytes(StandardCharsets.UTF_8);
            this.assets = assets; this.ready = ready; this.error = error;
        }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            if (DOCUMENT_URL.equals(url)) {
                served = true;
                return new WebResourceResponse("text/html", "UTF-8", 200, "OK",
                        Collections.singletonMap("Content-Security-Policy", "default-src 'none'; img-src https://appassets.androidplatform.net; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"),
                        new ByteArrayInputStream(document));
            }
            if (LOGO_URL.equals(url) && assets != null) {
                WebResourceResponse image = assets.shouldInterceptRequest(request.getUrl());
                if (image != null) return image;
            }
            return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !DOCUMENT_URL.equals(request.getUrl().toString());
        }
        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError problem) {
            if (request.isForMainFrame()) fail();
        }
        @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 400) fail();
        }
        private void fail() { if (!finished) { finished = true; error.run(); } }
        @Override public void onPageFinished(WebView view, String url) {
            if (finished) return;
            if (!DOCUMENT_URL.equals(url) || !served) { fail(); return; }
            finished = true;
            ready.run();
        }
    }

    private boolean accept(String html, String name, Consumer<String> status) {
        if (closed || !validRequest(html, name)) { status.accept("El comprobante no es válido para imprimir."); return false; }
        if (!documents.isEmpty() || pendingExport != null || exporting) { status.accept("Ya hay un comprobante en preparación. Termina o cancela la operación actual."); return false; }
        return true;
    }
    void context(String value) { if (gate.update(value)) cancelPreparing(); }
    void pause() { gate.clear(); cancelPreparing(); }
    private void cancelPreparing() { for (WebView view : new ArrayList<>(preparingDocuments)) { view.stopLoading(); release(view); } }
    private long authorize(String context, Consumer<String> status) {
        long ticket=gate.capture(context);
        if(ticket<0)status.accept("Abre la garantía y pulsa Imprimir o Guardar PDF en este teléfono.");
        return ticket;
    }
    private void loadDocument(String html, long ticket, Consumer<WebView> ready, Consumer<String> status) {
        WebView view = new WebView(activity);
        documents.add(view);
        preparingDocuments.add(view);
        view.getSettings().setJavaScriptEnabled(false);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(false);
        view.getSettings().setTextZoom(100);
        view.getSettings().setDefaultTextEncodingName("UTF-8");
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(activity)).build();
        view.setWebViewClient(new DocumentClient(html, assets, () -> {
            if (!preparingDocuments.remove(view)) return;
            if (closed || !gate.current(ticket) || !activity.hasWindowFocus() || activity.isFinishing() || activity.isDestroyed()) { release(view); return; }
            ready.accept(view);
        }, () -> { release(view); status.accept("No se pudo preparar el comprobante. Vuelve a abrirlo e inténtalo de nuevo."); }));
        view.loadUrl(DOCUMENT_URL);
    }
    void print(String html, String name, String context, Consumer<String> status) {
        long ticket=authorize(context,status);
        if (ticket<0 || !accept(html, name, status)) return;
        loadDocument(html, ticket, view -> {
            try {
                PrintManager manager = (PrintManager) activity.getSystemService(Activity.PRINT_SERVICE);
                if (manager == null) throw new IllegalStateException();
                PrintDocumentAdapter delegate = view.createPrintDocumentAdapter(name);
                PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                    @Override public void onStart() { delegate.onStart(); }
                    @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal signal, LayoutResultCallback callback, Bundle extras) { delegate.onLayout(oldAttributes, newAttributes, signal, callback, extras); }
                    @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal signal, WriteResultCallback callback) { delegate.onWrite(pages, destination, signal, callback); }
                    @Override public void onFinish() { delegate.onFinish(); release(view); }
                };
                manager.print(name, adapter, highQualityAttributes());
                status.accept("Elige tu impresora en el menú de Android. Para guardar el archivo usa Guardar PDF en Lunivo.");
            } catch (RuntimeException problem) { release(view); status.accept("No se pudo abrir la impresión. Vuelve a intentarlo."); }
        }, status);
    }
    @SuppressWarnings("deprecation") // Activity owns the system file picker result.
    void export(JSONObject document, String name, String context, Consumer<String> status) {
        if (authorize(context,status)<0 || !accept("<!doctype html>", name, status)) return;
        try { ReceiptPdfDocument.validate(document); }
        catch (JSONException problem) { status.accept("No se pudo leer el comprobante para guardar el PDF."); return; }
        pendingExport = new PendingExport(document, status);
        try {
            activity.startActivityForResult(exportIntent(name), EXPORT_REQUEST);
        } catch (RuntimeException problem) {
            pendingExport = null;
            status.accept("No se pudo abrir el selector de archivos. Vuelve a intentarlo.");
        }
    }
    boolean handleExportResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != EXPORT_REQUEST) return false;
        PendingExport pending = pendingExport;
        pendingExport = null;
        if (pending == null) {
            if (resultCode == Activity.RESULT_OK) Toast.makeText(activity, "La exportación se interrumpió. Vuelve a guardar el PDF desde la garantía.", Toast.LENGTH_LONG).show();
            return true;
        }
        Uri uri = data == null ? null : data.getData();
        if (resultCode != Activity.RESULT_OK || uri == null) { pending.status.accept("Exportación cancelada."); return true; }
        if (!"content".equals(uri.getScheme())) { pending.status.accept("La ubicación elegida no permite guardar el PDF."); return true; }
        pending.status.accept("Generando el PDF…");
        exporting = true;
        exportWorker.execute(() -> {
            String result;
            try (ParcelFileDescriptor destination = activity.getContentResolver().openFileDescriptor(uri, "wt")) {
                if (destination == null) throw new IOException("No destination");
                try (java.io.OutputStream output = new ParcelFileDescriptor.AutoCloseOutputStream(destination)) {
                    ReceiptPdfDocument.write(activity.getApplicationContext(), pending.document, output);
                }
                result = "PDF guardado. Puedes abrirlo desde la ubicación que elegiste.";
            } catch (IOException | JSONException | RuntimeException problem) {
                result = "No se completó el PDF. Elige otra ubicación y vuelve a guardarlo.";
            }
            String message = result;
            main.post(() -> { exporting = false; if (!closed) pending.status.accept(message); });
        });
        return true;
    }
    private void release(WebView view) { preparingDocuments.remove(view); if (documents.remove(view)) view.destroy(); }
    void close() {
        closed = true;
        gate.clear();
        pendingExport = null;
        exportWorker.shutdownNow();
        for (WebView view : new ArrayList<>(documents)) release(view);
    }
}
