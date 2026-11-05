package com.crmcelulares.app;

import static org.junit.Assert.*;

import android.app.Activity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;

/** Verify actual native child bounds, not WebView/CSS padding or static style declarations. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class SafeAreaLayoutTest {
    private ActivityController<Activity> activityController;
    private Activity activity;
    private View viewport;
    private SafeAreaLayout root;

    @Before
    public void create() {
        activityController = Robolectric.buildActivity(Activity.class).setup();
        activity = activityController.get();
        // Robolectric does not lay out Chromium; a native View exercises the real parent geometry.
        viewport = new View(activity);
        root = new SafeAreaLayout(activity, viewport);
        activity.setContentView(root);
    }

    @After
    public void close() {
        activityController.pause().stop().destroy();
    }

    private void layout(int width, int height, int top, int bottom, int left, int right, int keyboard) {
        WindowInsets nativeInsets = new WindowInsets.Builder()
                .setInsets(WindowInsets.Type.statusBars(), android.graphics.Insets.of(0, top, 0, 0))
                .setInsets(WindowInsets.Type.navigationBars(), android.graphics.Insets.of(0, 0, right, bottom))
                .setInsets(WindowInsets.Type.displayCutout(), android.graphics.Insets.of(left, top, 0, 0))
                .setInsets(WindowInsets.Type.ime(), android.graphics.Insets.of(0, 0, 0, keyboard))
                .setVisible(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars(), true)
                .setVisible(WindowInsets.Type.ime(), keyboard > 0)
                .build();
        ViewCompat.dispatchApplyWindowInsets(root, WindowInsetsCompat.toWindowInsetsCompat(nativeInsets, root));
        root.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        root.layout(0, 0, width, height);
    }

    @Test
    public void darkAppearanceKeepsClockReadableAndSurvivesInsetsRefresh() {
        root.appearance(activity.getWindow(), true);
        root.refresh(activity.getWindow());
        assertFalse(WindowCompat.getInsetsController(activity.getWindow(), root).isAppearanceLightStatusBars());
        assertFalse(WindowCompat.getInsetsController(activity.getWindow(), root).isAppearanceLightNavigationBars());
        layout(840, 920, 40, 32, 0, 0, 0);
        assertEquals(40, viewport.getTop());
        assertEquals(888, viewport.getBottom());
        assertSame(viewport, root.getChildAt(0));
        root.appearance(activity.getWindow(), false);
        assertTrue(WindowCompat.getInsetsController(activity.getWindow(), root).isAppearanceLightStatusBars());
        assertTrue(WindowCompat.getInsetsController(activity.getWindow(), root).isAppearanceLightNavigationBars());
        assertEquals(40, viewport.getTop());
    }

    @Test
    public void statusBarAndCameraAreaAreOutsideTheWebViewport() {
        layout(840, 920, 40, 32, 0, 0, 0);
        assertEquals("native parent padding", 40, root.getPaddingTop());
        assertEquals(40, viewport.getTop());
        assertEquals(888, viewport.getBottom());
        assertEquals(848, viewport.getHeight());
        assertEquals(0, viewport.getPaddingTop());
    }

    @Test
    public void foldUnfoldAndRotationReuseTheSameViewportAndRecalculateInsets() {
        viewport.setTag("borrador pendiente");
        layout(412, 915, 24, 24, 0, 0, 0);
        assertEquals(24, viewport.getTop());
        layout(840, 920, 40, 32, 0, 0, 0);
        assertEquals(40, viewport.getTop());
        assertEquals(840, viewport.getWidth());
        layout(920, 840, 24, 0, 32, 24, 0);
        assertEquals(32, viewport.getLeft());
        assertEquals(896, viewport.getRight());
        assertEquals(24, viewport.getTop());
        assertSame(viewport, root.getChildAt(0));
        assertEquals("borrador pendiente", viewport.getTag());
        layout(412, 915, 24, 24, 0, 0, 0);
        assertEquals(412, viewport.getWidth());
        assertEquals(24, viewport.getTop());
    }

    @Test
    public void keyboardUsesTheLargerInsetWithoutAddingNavigationTwice() {
        layout(412, 915, 24, 24, 0, 0, 320);
        assertEquals(595, viewport.getBottom());
        assertEquals(571, viewport.getHeight());
        layout(412, 915, 24, 24, 0, 0, 0);
        assertEquals(891, viewport.getBottom());
        assertEquals(867, viewport.getHeight());
    }

    @Test
    @Config(sdk = 33)
    public void android13PhoneAlsoKeepsTheStatusBarOutsideContent() {
        layout(412, 915, 28, 24, 0, 0, 0);
        assertEquals(28, viewport.getTop());
        assertEquals(891, viewport.getBottom());
    }

    @Test
    @Config(sdk = 28)
    @SuppressWarnings("deprecation")
    public void legacyPhoneClearsFullscreenAndUsesDarkClockIcons() {
        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        root.refresh(activity.getWindow());
        int flags = activity.getWindow().getAttributes().flags;
        assertEquals(0, flags & WindowManager.LayoutParams.FLAG_FULLSCREEN);
        assertEquals(0, flags & WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        assertTrue(WindowCompat.getInsetsController(activity.getWindow(), root).isAppearanceLightStatusBars());
        WindowInsetsCompat insets = new WindowInsetsCompat.Builder()
                .setSystemWindowInsets(Insets.of(0, 24, 0, 48)).build();
        ViewCompat.dispatchApplyWindowInsets(root, insets);
        root.measure(View.MeasureSpec.makeMeasureSpec(412, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(915, View.MeasureSpec.EXACTLY));
        root.layout(0, 0, 412, 915);
        assertEquals(24, viewport.getTop());
        assertEquals(867, viewport.getBottom());
    }
}
