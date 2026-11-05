package com.crmcelulares.app;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/** Resizes the actual WebView viewport, rather than padding its HTML drawing area. */
final class SafeAreaLayout extends FrameLayout {
    private static final int BACKGROUND = Color.rgb(244, 246, 250);
    private static final int DARK_BACKGROUND = Color.rgb(14, 23, 38);
    private boolean dark;

    SafeAreaLayout(Context context) {
        super(context);
        setBackgroundColor(BACKGROUND);
        setClipToPadding(true);
        ViewCompat.setOnApplyWindowInsetsListener(this, (view, windowInsets) -> {
            Insets safe = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            // Union/max avoids adding the navigation bar twice when the keyboard is open.
            setPadding(safe.left, safe.top, safe.right, safe.bottom);
            // This parent owns the safe area; descendants must not apply it a second time.
            return WindowInsetsCompat.CONSUMED;
        });
    }

    SafeAreaLayout(Activity activity, View content) {
        this((Context) activity);
        addView(content, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
        configureWindow(activity.getWindow());
    }

    @SuppressWarnings("deprecation")
    void configureWindow(Window window) {
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                | WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
                | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        int background = dark ? DARK_BACKGROUND : BACKGROUND;
        setBackgroundColor(background);
        window.setStatusBarColor(background);
        window.setNavigationBarColor(dark || Build.VERSION.SDK_INT >= 27 ? background : Color.rgb(24, 40, 66));
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, this);
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark && Build.VERSION.SDK_INT >= 27);
        controller.show(WindowInsetsCompat.Type.statusBars());
    }

    void appearance(Window window, boolean value) {
        dark = value;
        configureWindow(window);
    }

    void refresh(Window window) {
        configureWindow(window);
        ViewCompat.requestApplyInsets(this);
    }
}
