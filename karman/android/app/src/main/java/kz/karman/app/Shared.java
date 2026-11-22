package kz.karman.app;

import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;

/** Файл или текст, отправленные в «Карман» через «Поделиться» (например, выписка из Kaspi). */
final class Shared {
    private static final long MAX = 15L * 1024 * 1024;

    static boolean capture(Context c, Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return false;
        try {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            File dir = new File(c.getCacheDir(), "shared");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            JSONObject meta = new JSONObject();
            if (uri != null) {
                String mime = c.getContentResolver().getType(uri);
                String name = displayName(c, uri);
                try (InputStream in = c.getContentResolver().openInputStream(uri);
                     FileOutputStream out = new FileOutputStream(new File(dir, "file.bin"))) {
                    if (in == null) return false;
                    byte[] buf = new byte[64 * 1024];
                    long total = 0;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        total += n;
                        if (total > MAX) return false;
                        out.write(buf, 0, n);
                    }
                }
                meta.put("name", name == null ? "file" : name);
                meta.put("mime", mime == null ? "" : mime);
                meta.put("hasFile", true);
            }
            if (text != null && !text.trim().isEmpty()) meta.put("text", text);
            if (meta.length() == 0) return false;
            Store.p(c).edit().putString("shared", meta.toString()).apply();
            intent.setAction(Intent.ACTION_MAIN); // не обрабатывать повторно при повороте экрана
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Отдаёт и очищает отправленное: {name, mime, b64?, text?} или "". */
    static String take(Context c) {
        String s = Store.p(c).getString("shared", "");
        if (s.isEmpty()) return "";
        Store.p(c).edit().remove("shared").apply();
        try {
            JSONObject meta = new JSONObject(s);
            if (meta.optBoolean("hasFile")) {
                File f = new File(new File(c.getCacheDir(), "shared"), "file.bin");
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                try (InputStream in = new FileInputStream(f)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
                }
                //noinspection ResultOfMethodCallIgnored
                f.delete();
                meta.put("b64", Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP));
            }
            return meta.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static String displayName(Context c, Uri uri) {
        try (Cursor cur = c.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cur != null && cur.moveToFirst()) return cur.getString(0);
        } catch (Exception ignored) { }
        return uri.getLastPathSegment();
    }
}
