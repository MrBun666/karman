package kz.karman.app;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Читает уведомления банков (Kaspi, Halyk и др.) и складывает денежные в очередь.
 * Разбор и категории делает приложение при открытии. Ничего не отправляется в интернет.
 */
public class MoneyListenerService extends NotificationListenerService {
    private static final int F = Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;
    static final Pattern AMOUNT = Pattern.compile("([+\\-−]?\\s?\\d[\\d\\s\\u00a0]*(?:[.,]\\d{1,2})?)\\s?(₸|тг|kzt|тенге)", F);
    static final Pattern OPERATION = Pattern.compile("покупк|оплат|перевод|перевел|пополнен|сняти|плат[её]ж|списан|зачислен|поступ|возврат|получен|отправлен", F);
    static final Pattern PROMO = Pattern.compile("скидк|акци|розыгрыш|предлож|одобрен|доступен кредит|лимит до|выиграй|успей|подарок|промокод", F);
    static final Pattern PLUS = Pattern.compile("пополнен|поступ|зачислен|получил|вам перевел|перевел[аи]? вам|возврат|кэшбэк|кешбэк|\\sот\\s", F);
    static final Pattern CUT = Pattern.compile("(доступно|баланс|остаток|доступный)", F);

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            if (pkg.equals(getPackageName()) || sbn.isOngoing()) return;
            Notification n = sbn.getNotification();
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

            Bundle e = n.extras;
            String title = str(e.getCharSequence(Notification.EXTRA_TITLE));
            String big = str(e.getCharSequence(Notification.EXTRA_BIG_TEXT));
            String text = big.isEmpty() ? str(e.getCharSequence(Notification.EXTRA_TEXT)) : big;
            String full = (title + "\n" + text).trim();

            Matcher m = AMOUNT.matcher(full);
            if (!m.find() || !OPERATION.matcher(full).find() || PROMO.matcher(full).find()) return;

            String label = appLabel(pkg);
            Store.noteApp(this, pkg, label);
            if (!Store.isAllowed(this, pkg, label)) return;
            if (!Store.firstTime(this, pkg + "|" + full.hashCode())) return;

            JSONObject o = new JSONObject();
            o.put("pkg", pkg);
            o.put("app", label);
            o.put("title", title);
            o.put("text", text);
            o.put("ts", sbn.getPostTime());
            Store.push(this, o);

            if (Store.option(this, "confirm", true)) {
                boolean plus = PLUS.matcher(full).find() || m.group(1).trim().startsWith("+");
                String amount = m.group(1).replaceAll("[+\\-−\\s\\u00a0]", "");
                String after = full.substring(m.end()).replaceAll("^[\\s.,:;—-]+", "");
                Matcher cut = CUT.matcher(after);
                if (cut.find()) after = after.substring(0, cut.start());
                after = after.replace('\n', ' ').trim();
                if (after.length() > 40) after = after.substring(0, 40) + "…";
                String line = (plus ? "+" : "−") + group(amount) + " ₸" + (after.isEmpty() ? "" : " · " + after);
                Notifier.show(this, 20000 + (int) (Math.abs((long) full.hashCode()) % 10000), "money",
                        "Записал в Карман", line + "\nНажми, чтобы проверить категорию", "#tx");
            }
            MainActivity.deliverPush();
        } catch (Exception ignored) { }
    }

    private static String str(CharSequence cs) { return cs == null ? "" : cs.toString(); }

    private static String group(String digits) {
        String[] parts = digits.split("[.,]");
        String whole = parts[0].replaceAll("\\D", "");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < whole.length(); i++) {
            if (i > 0 && (whole.length() - i) % 3 == 0) sb.append(' ');
            sb.append(whole.charAt(i));
        }
        return sb.toString();
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (Exception e) {
            return pkg;
        }
    }
}
