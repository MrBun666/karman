package kz.karman.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Напоминания по расписанию (платежи из календаря, вечерний итог, итоги недели).
 * Список готовит веб-часть: [{id, at, title, text, route, channel}].
 */
final class Reminders {
    static final String ACTION = "kz.karman.app.REMIND";

    static void schedule(Context c, String json) {
        Store.p(c).edit().putString("alarms", json).apply();
        apply(c);
    }

    static synchronized void apply(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        SharedPreferences sp = Store.p(c);
        try {
            JSONArray old = new JSONArray(sp.getString("alarmIds", "[]"));
            for (int i = 0; i < old.length(); i++) am.cancel(pending(c, old.getInt(i), null));
        } catch (Exception ignored) { }

        JSONArray ids = new JSONArray();
        try {
            JSONArray list = new JSONArray(sp.getString("alarms", "[]"));
            long now = System.currentTimeMillis();
            for (int i = 0; i < list.length() && ids.length() < 80; i++) {
                JSONObject o = list.getJSONObject(i);
                long at = o.getLong("at");
                if (at <= now) continue;
                int id = o.getInt("id");
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c, id, o));
                ids.put(id);
            }
        } catch (Exception ignored) { }
        sp.edit().putString("alarmIds", ids.toString()).apply();
    }

    static PendingIntent pending(Context c, int id, JSONObject o) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.setAction(ACTION);
        if (o != null) {
            i.putExtra("id", id);
            i.putExtra("title", o.optString("title"));
            i.putExtra("text", o.optString("text"));
            i.putExtra("route", o.optString("route", "#home"));
            i.putExtra("channel", o.optString("channel", "reminders"));
        }
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
