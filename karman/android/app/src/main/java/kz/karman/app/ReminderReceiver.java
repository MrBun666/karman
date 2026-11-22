package kz.karman.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Срабатывает в назначенное время и показывает напоминание. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (!Reminders.ACTION.equals(i.getAction())) return;
        Notifier.show(c, i.getIntExtra("id", 1), i.getStringExtra("channel"),
                i.getStringExtra("title"), i.getStringExtra("text"), i.getStringExtra("route"));
    }
}
