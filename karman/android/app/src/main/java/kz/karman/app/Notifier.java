package kz.karman.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

/** Уведомления самого «Кармана»: записанные траты, напоминания, отчёты. */
final class Notifier {
    static void channels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.createNotificationChannel(new NotificationChannel("money", "Записанные траты", NotificationManager.IMPORTANCE_LOW));
        nm.createNotificationChannel(new NotificationChannel("reminders", "Напоминания о платежах", NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(new NotificationChannel("reports", "Отчёты и итоги", NotificationManager.IMPORTANCE_DEFAULT));
    }

    static PendingIntent open(Context c, String route, int requestCode) {
        Intent i = new Intent(c, MainActivity.class);
        i.putExtra("route", route);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void show(Context c, int id, String channel, String title, String text, String route) {
        try {
            channels(c);
            Notification n = new Notification.Builder(c, channel)
                    .setSmallIcon(R.drawable.ic_notify)
                    .setColor(0xFF22C48F)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setStyle(new Notification.BigTextStyle().bigText(text))
                    .setAutoCancel(true)
                    .setContentIntent(open(c, route == null || route.isEmpty() ? "#home" : route, id))
                    .build();
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(id, n);
        } catch (SecurityException ignored) {
            // нет разрешения на уведомления — молча пропускаем
        }
    }
}
