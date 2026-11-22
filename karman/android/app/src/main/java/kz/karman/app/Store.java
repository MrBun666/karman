package kz.karman.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.regex.Pattern;

/** Небольшое хранилище нативной части: очередь уведомлений, список приложений, настройки. */
final class Store {
    /** Приложения, которые по умолчанию считаются банковскими (их уведомления записываются). */
    private static final Pattern BANK = Pattern.compile(
            "kaspi|halyk|homebank|jusan|freedom|bcc|centercredit|forte|bereke|eurasian|otbasy|altyn|shinhan|vtb|bank|банк",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    static SharedPreferences p(Context c) {
        return c.getSharedPreferences("karman", Context.MODE_PRIVATE);
    }

    private static JSONArray arr(String s) {
        try { return new JSONArray(s); } catch (Exception e) { return new JSONArray(); }
    }

    private static JSONObject obj(String s) {
        try { return new JSONObject(s); } catch (Exception e) { return new JSONObject(); }
    }

    // ---------- Очередь денежных уведомлений ----------
    static synchronized void push(Context c, JSONObject o) {
        JSONArray a = arr(p(c).getString("queue", "[]"));
        a.put(o);
        while (a.length() > 500) a.remove(0);
        p(c).edit().putString("queue", a.toString()).apply();
    }

    static synchronized String pull(Context c) {
        String s = p(c).getString("queue", "[]");
        p(c).edit().putString("queue", "[]").apply();
        return s;
    }

    /** true, если такое уведомление ещё не встречалось (банки иногда обновляют одно и то же). */
    static synchronized boolean firstTime(Context c, String key) {
        JSONArray seen = arr(p(c).getString("seen", "[]"));
        for (int i = 0; i < seen.length(); i++) if (key.equals(seen.optString(i))) return false;
        seen.put(key);
        while (seen.length() > 300) seen.remove(0);
        p(c).edit().putString("seen", seen.toString()).apply();
        return true;
    }

    // ---------- Приложения-источники ----------
    static synchronized void noteApp(Context c, String pkg, String label) {
        try {
            JSONObject apps = obj(p(c).getString("apps", "{}"));
            JSONObject o = apps.optJSONObject(pkg);
            if (o == null) o = new JSONObject();
            o.put("label", label);
            o.put("count", o.optInt("count") + 1);
            o.put("last", System.currentTimeMillis());
            apps.put(pkg, o);
            p(c).edit().putString("apps", apps.toString()).apply();
        } catch (Exception ignored) { }
    }

    static boolean defaultAllowed(String pkg, String label) {
        String s = (pkg + " " + label).toLowerCase();
        if (s.contains("onay")) return false; // пополнение Onay уже видно в банке
        return BANK.matcher(s).find();
    }

    static synchronized boolean isAllowed(Context c, String pkg, String label) {
        JSONObject o = obj(p(c).getString("apps", "{}")).optJSONObject(pkg);
        if (o != null && o.has("allowed")) return o.optBoolean("allowed");
        return defaultAllowed(pkg, label);
    }

    static synchronized void setApp(Context c, String pkg, boolean allowed) {
        try {
            JSONObject apps = obj(p(c).getString("apps", "{}"));
            JSONObject o = apps.optJSONObject(pkg);
            if (o == null) { o = new JSONObject(); o.put("label", pkg); }
            o.put("allowed", allowed);
            apps.put(pkg, o);
            p(c).edit().putString("apps", apps.toString()).apply();
        } catch (Exception ignored) { }
    }

    static synchronized String appsJson(Context c) {
        JSONArray out = new JSONArray();
        try {
            JSONObject apps = obj(p(c).getString("apps", "{}"));
            Iterator<String> it = apps.keys();
            while (it.hasNext()) {
                String pkg = it.next();
                JSONObject o = apps.getJSONObject(pkg);
                JSONObject r = new JSONObject();
                r.put("pkg", pkg);
                r.put("label", o.optString("label", pkg));
                r.put("count", o.optInt("count"));
                r.put("last", o.optLong("last"));
                r.put("allowed", o.has("allowed") ? o.optBoolean("allowed") : defaultAllowed(pkg, o.optString("label")));
                out.put(r);
            }
        } catch (Exception ignored) { }
        return out.toString();
    }

    static boolean option(Context c, String key, boolean def) {
        JSONObject o = obj(p(c).getString("options", "{}"));
        return o.has(key) ? o.optBoolean(key, def) : def;
    }
}
