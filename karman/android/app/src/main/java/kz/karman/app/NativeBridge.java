package kz.karman.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

/** Методы, которые веб-часть вызывает как window.KarmanNative.*. Данные не покидают телефон. */
final class NativeBridge {
    private final MainActivity a;

    NativeBridge(MainActivity a) { this.a = a; }

    @JavascriptInterface
    public String info() {
        try {
            JSONObject o = new JSONObject();
            o.put("versionName", BuildConfig.VERSION_NAME);
            o.put("versionCode", BuildConfig.VERSION_CODE);
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("notifAccess", hasNotificationAccess());
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface
    public boolean hasNotificationAccess() {
        return NotificationManagerCompat.getEnabledListenerPackages(a).contains(a.getPackageName());
    }

    @JavascriptInterface
    public void openNotificationAccess() {
        a.runOnUiThread(() -> {
            try {
                a.startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            } catch (Exception e) {
                a.startActivity(new Intent(Settings.ACTION_SETTINGS));
            }
        });
    }

    @JavascriptInterface
    public void openAppNotificationSettings() {
        a.runOnUiThread(() -> {
            try {
                Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                i.putExtra(Settings.EXTRA_APP_PACKAGE, a.getPackageName());
                a.startActivity(i);
            } catch (Exception ignored) { }
        });
    }

    /** Новые денежные уведомления, накопленные сервисом, — и очистка очереди. */
    @JavascriptInterface
    public String pullNotifications() { return Store.pull(a); }

    @JavascriptInterface
    public String appsSeen() { return Store.appsJson(a); }

    @JavascriptInterface
    public void setApp(String pkg, boolean allowed) { Store.setApp(a, pkg, allowed); }

    @JavascriptInterface
    public void setOptions(String json) { Store.p(a).edit().putString("options", json).apply(); }

    @JavascriptInterface
    public void schedule(String json) { Reminders.schedule(a, json); }

    @JavascriptInterface
    public void updateWidget(String json) {
        Store.p(a).edit().putString("widget", json).apply();
        BalanceWidget.refresh(a);
    }

    @JavascriptInterface
    public String takeShared() { return Shared.take(a); }

    @JavascriptInterface
    public void startVoice() { a.runOnUiThread(a::startVoice); }

    @JavascriptInterface
    public void openUrl(String url) {
        if (url != null && (url.startsWith("https://") || url.startsWith("http://"))) a.openExternal(url);
    }

    @JavascriptInterface
    public void shareText(String title, String text) {
        a.runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_SUBJECT, title);
            i.putExtra(Intent.EXTRA_TEXT, text);
            a.startActivity(Intent.createChooser(i, title));
        });
    }

    /** Сохранить/отправить файл (резервная копия): выбор Telegram, Google Диск и т.д. */
    @JavascriptInterface
    public boolean shareFile(String name, String mime, String base64) {
        try {
            File dir = new File(a.getCacheDir(), "out");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            File f = new File(dir, name.replaceAll("[^A-Za-z0-9._-]", "_"));
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(Base64.decode(base64, Base64.DEFAULT));
            }
            final Uri uri = FileProvider.getUriForFile(a, a.getPackageName() + ".files", f);
            a.runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType(mime);
                i.putExtra(Intent.EXTRA_STREAM, uri);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                a.startActivity(Intent.createChooser(i, "Сохранить копию"));
            });
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
