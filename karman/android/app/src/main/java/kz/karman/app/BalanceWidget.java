package kz.karman.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Виджет на главном экране: сколько можно тратить сегодня + быстрые кнопки. */
public class BalanceWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, views(c));
    }

    static RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        JSONObject d;
        try { d = new JSONObject(Store.p(c).getString("widget", "{}")); } catch (Exception e) { d = new JSONObject(); }
        v.setTextViewText(R.id.w_title, d.optString("title", "Можно тратить сегодня"));
        v.setTextViewText(R.id.w_value, d.optString("perDay", "—"));
        v.setTextViewText(R.id.w_sub, d.optString("sub", "Открой приложение"));
        v.setTextViewText(R.id.w_today, d.optString("today", ""));
        v.setTextColor(R.id.w_value, d.optBoolean("neg") ? 0xFFFF6B78 : 0xFF3DDC97);
        v.setOnClickPendingIntent(R.id.w_root, Notifier.open(c, "#home", 9001));
        v.setOnClickPendingIntent(R.id.w_add, Notifier.open(c, "#add-expense", 9002));
        v.setOnClickPendingIntent(R.id.w_voice, Notifier.open(c, "#voice", 9003));
        return v;
    }

    static void refresh(Context c) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            int[] ids = m.getAppWidgetIds(new ComponentName(c, BalanceWidget.class));
            for (int id : ids) m.updateAppWidget(id, views(c));
        } catch (Exception ignored) { }
    }
}
