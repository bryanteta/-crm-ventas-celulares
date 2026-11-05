package com.crmcelulares.app;

import android.app.Activity;
import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.provider.Settings;
import android.window.OnBackInvokedDispatcher;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    static final String HOME = "https://appassets.androidplatform.net/assets/www/index.html";
    private WebView webView;
    private boolean pageReady;
    private String pendingFollowup;
    private CloudSyncManager cloud;
    private SafeAreaLayout safeArea;
    private LaunchSound launchSound;
    private ReceiptPrinter receiptPrinter;
    private InventoryBridge inventoryBridge;
    private boolean startupSoundPending;

    @Override
    // Only packaged CRM assets run JavaScript; remote pages open outside the app.
    @SuppressLint("SetJavaScriptEnabled")
    public void onCreate(Bundle state) {
        super.onCreate(state);
        ReminderScheduler.createChannel(this);
        readFollowup(getIntent());
        launchSound = new LaunchSound(this);
        receiptPrinter = new ReceiptPrinter(this);
        inventoryBridge = new InventoryBridge(this);
        startupSoundPending = state == null && pendingFollowup == null;
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView = new WebView(this);
        cloud = new CloudSyncManager(this, event -> runOnUiThread(() -> {
            if (pageReady) webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('lunivo-cloud',{detail:" + event.toString() + "}))", null);
        }));
        webView.setBackgroundColor(Color.rgb(243, 246, 251));
        safeArea = new SafeAreaLayout(this, webView);
        boolean darkAppearance = getSharedPreferences("lunivo-appearance", MODE_PRIVATE).getBoolean("dark", false);
        safeArea.appearance(getWindow(), darkAppearance);
        webView.setBackgroundColor(darkAppearance ? Color.rgb(14, 23, 38) : Color.rgb(244, 246, 250));
        setContentView(safeArea);
        safeArea.post(() -> safeArea.refresh(getWindow()));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        // The bridge is injected only into our HTTPS asset origin, never external pages.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "CrmAndroid",
                    Collections.singleton("https://appassets.androidplatform.net"),
                    (view, message, origin, mainFrame, reply) -> {
                        if (!mainFrame || !"https://appassets.androidplatform.net".equals(origin.toString())) return;
                        try {
                            String payload = message.getData();
                            if (payload == null || payload.length() > 1024 * 1024) throw new JSONException("Mensaje demasiado grande");
                            JSONObject request = new JSONObject(payload);
                            if (request.optString("type").startsWith("cloud")) {
                                try { cloud.handle(request); }
                                catch (JSONException | RuntimeException invalid) { cloud.invalidRequest(); }
                                return;
                            }
                            switch (request.optString("type")) {
                                case "appearance":
                                    boolean dark = request.getBoolean("dark");
                                    getSharedPreferences("lunivo-appearance", MODE_PRIVATE).edit().putBoolean("dark", dark).apply();
                                    safeArea.appearance(getWindow(), dark);
                                    webView.setBackgroundColor(dark ? Color.rgb(14, 23, 38) : Color.rgb(244, 246, 250));
                                    return;
                                case "receiptPrint":
                                case "receiptExport":
                                    java.util.function.Consumer<String> documentStatus = status -> {
                                        try { reply.postMessage(new JSONObject().put("type", "documentStatus").put("message", status).toString()); }
                                        catch (JSONException | RuntimeException ignored) { /* The originating page may have closed. */ }
                                    };
                                    if ("receiptExport".equals(request.optString("type"))) {
                                        receiptPrinter.export(request.getJSONObject("document"), request.optString("name"), documentStatus);
                                        return;
                                    }
                                    receiptPrinter.print(request.optString("html"), request.optString("name"), documentStatus);
                                    return;
                                case "launchSoundState":
                                case "launchSoundPreference":
                                case "launchSoundPreview":
                                    if (request.optString("type").equals("launchSoundPreference")) launchSound.enabled(request.getBoolean("enabled"));
                                    if (request.optString("type").equals("launchSoundPreview")) launchSound.play();
                                    reply.postMessage(new JSONObject().put("type", "launchSoundStatus").put("enabled", launchSound.enabled()).put("available", launchSound.available()).toString());
                                    return;
                                case "sync":
                                    ReminderScheduler.sync(this, request.getJSONArray("records"));
                                    break;
                                case "permission":
                                    requestNotifications();
                                    break;
                                case "precision":
                                    if (Build.VERSION.SDK_INT >= 31 && !ReminderScheduler.exactEnabled(this)) {
                                        openSettings(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                                                Uri.parse("package:" + getPackageName())));
                                    }
                                    break;
                                case "settings":
                                    openNotificationSettings();
                                    break;
                                case "test":
                                    ReminderScheduler.sendTest(this);
                                    break;
                                case "deviceReminders":
                                    ReminderScheduler.prefs(this).edit().putBoolean("deviceRemindersEnabled",
                                            request.getBoolean("enabled")).apply();
                                    ReminderScheduler.reschedule(this);
                                    break;
                                case "status":
                                    break;
                                default:
                                    throw new JSONException("Acción desconocida");
                            }
                            reply.postMessage(ReminderScheduler.status(this)
                                    .put("request", request.optString("type")).toString());
                        } catch (JSONException | RuntimeException error) {
                            reply.postMessage("{\"type\":\"error\",\"message\":\"No se pudieron actualizar los avisos. Vuelve a abrir la app e inténtalo de nuevo.\"}");
                        }
                    });
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "LunivoInventoryAndroid",
                    Collections.singleton("https://appassets.androidplatform.net"),
                    (view, message, origin, mainFrame, reply) -> {
                        if (!mainFrame || !"https://appassets.androidplatform.net".equals(origin.toString())) return;
                        try {
                            String payload = message.getData();
                            if (payload == null || payload.length() > 4096) return;
                            inventoryBridge.handle(new JSONObject(payload), response -> runOnUiThread(() -> {
                                if (!isDestroyed()) {
                                    try { reply.postMessage(response.toString()); } catch (RuntimeException ignored) { /* Page closed. */ }
                                }
                            }));
                        } catch (JSONException | RuntimeException ignored) { /* Only packaged assets can use this listener. */ }
                    });
        }
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse asset = assets.shouldInterceptRequest(request.getUrl());
                return asset != null ? asset : new WebResourceResponse("text/plain", "UTF-8", 403,
                        "Forbidden", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                refreshNativeStatus();
                cloud.state();
                if (startupSoundPending) { startupSoundPending = false; if (pendingFollowup == null) launchSound.play(); }
                openPendingFollowup();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme())
                        && "appassets.androidplatform.net".equals(uri.getHost())
                        && "/assets/www/index.html".equals(uri.getPath())) {
                    return false;
                }
                if (request.isForMainFrame() && "https".equals(uri.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri)
                                .addCategory(Intent.CATEGORY_BROWSABLE));
                    } catch (ActivityNotFoundException error) {
                        Toast.makeText(MainActivity.this,
                                "Instala una app que permita abrir este enlace.", Toast.LENGTH_LONG).show();
                    }
                }
                return true;
            }
        });
        // Records persist in WebView localStorage across app restarts.
        webView.loadUrl(HOME);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::navigateBack);
        }
    }

    private void requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            boolean asked = ReminderScheduler.prefs(this).getBoolean("permissionAsked", false);
            if (asked && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                openNotificationSettings();
            } else {
                ReminderScheduler.prefs(this).edit().putBoolean("permissionAsked", true).apply();
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 20);
            }
        } else if (!ReminderScheduler.notificationsEnabled(this)) {
            openNotificationSettings();
        }
    }

    private void openNotificationSettings() {
        openSettings(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
    }

    private void openSettings(Intent intent) {
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException unavailable) {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getPackageName())));
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (receiptPrinter != null && receiptPrinter.handleExportResult(requestCode, resultCode, data)) return;
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        ReminderScheduler.reschedule(this);
        refreshNativeStatus();
        if (cloud != null && pageReady) cloud.state();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (safeArea != null) safeArea.refresh(getWindow());
        ReminderScheduler.reschedule(this);
        refreshNativeStatus();
        if (cloud != null && pageReady) cloud.state();
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        // Fold/unfold, rotation and density changes must refresh both geometry and icon contrast.
        if (safeArea != null) safeArea.refresh(getWindow());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && safeArea != null) safeArea.refresh(getWindow());
    }

    private void refreshNativeStatus() {
        if (pageReady && webView != null) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('crm-native-refresh'))", null);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readFollowup(intent);
        openPendingFollowup();
    }

    private void readFollowup(Intent intent) {
        Uri data = intent.getData();
        if (data != null && "crmcelulares".equals(data.getScheme()) && "followup".equals(data.getHost())) {
            pendingFollowup = data.getLastPathSegment();
        }
    }

    private void openPendingFollowup() {
        if (pageReady && pendingFollowup != null) {
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('crm-open-followup',{detail:"
                    + JSONObject.quote(pendingFollowup) + "}))", null);
            pendingFollowup = null;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        navigateBack();
    }

    private void navigateBack() {
        // Android Back must dismiss the topmost help/action dialog before changing routes.
        webView.evaluateJavascript("Boolean(window.LunivoDismissDialog && window.LunivoDismissDialog())", handled -> {
            if (isFinishing() || isDestroyed() || "true".equals(handled)) return;
            if (webView.canGoBack()) webView.goBack();
            else finish();
        });
    }

    @Override
    protected void onStop() {
        if (launchSound != null) launchSound.stop();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (inventoryBridge != null) inventoryBridge.close();
        pageReady = false;
        if (receiptPrinter != null) receiptPrinter.close();
        if (cloud != null) cloud.close();
        if (launchSound != null) launchSound.stop();
        webView.destroy();
        super.onDestroy();
    }
}
