package com.santaanita.ordendesalidas;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSArray;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Guarda todos los avisos, pero solo arma el siguiente.
 * Una alarma de reloj pendiente todo el día impide que el teléfono duerma.
 * setAlarmClock se usa solo cuando el aviso de después queda a menos de 9 minutos:
 * en reposo, Android no deja disparar dos alarmas exactas normales tan seguidas.
 */
public final class AlertScheduler {
    private static final String PREFS = "exact_alerts";
    private static final String KEY = "payload";
    private static final String ARMED = "armed";
    private static final long CLOSE_GAP_MS = 9L * 60L * 1000L;

    private AlertScheduler() {}

    public static int replace(Context context, JSArray alerts) throws Exception {
        JSONArray previous = load(context);
        for (int i = 0; i < previous.length(); i++) cancel(context, previous.getJSONObject(i).getInt("id"));
        cancelArmed(context);
        JSONArray next = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < alerts.length(); i++) {
            JSONObject item = alerts.getJSONObject(i);
            if (item.getLong("at") > now) next.put(item);
        }
        save(context, next);
        return armNext(context) ? 1 : 0;
    }

    public static void rescheduleStored(Context context) {
        try {
            JSONArray stored = load(context);
            JSONArray future = new JSONArray();
            long now = System.currentTimeMillis();
            for (int i = 0; i < stored.length(); i++) {
                JSONObject item = stored.getJSONObject(i);
                if (item.getLong("at") > now) future.put(item);
            }
            save(context, future);
            armNext(context);
        } catch (Exception ignored) {
            // Si el almacenamiento aún no está disponible tras el arranque, el siguiente
            // inicio de la app vuelve a escribir el plan.
        }
    }

    public static void removeStored(Context context, int id) {
        try {
            JSONArray stored = load(context);
            JSONArray kept = new JSONArray();
            for (int i = 0; i < stored.length(); i++) {
                JSONObject item = stored.getJSONObject(i);
                if (item.getInt("id") != id) kept.put(item);
            }
            save(context, kept);
            cancel(context, id);
            armNext(context);
        } catch (Exception ignored) {
        }
    }

    /** Arma únicamente el próximo aviso y devuelve si quedó programado. */
    public static boolean armNext(Context context) {
        try {
            cancelArmed(context);
            JSONArray stored = load(context);
            long now = System.currentTimeMillis();
            JSONObject soonest = null;
            JSONObject following = null;
            for (int i = 0; i < stored.length(); i++) {
                JSONObject item = stored.getJSONObject(i);
                long at = item.getLong("at");
                if (at <= now) continue;
                if (soonest == null || at < soonest.getLong("at")) {
                    following = soonest;
                    soonest = item;
                } else if (following == null || at < following.getLong("at")) {
                    following = item;
                }
            }
            SharedPreferences.Editor editor = prefs(context).edit();
            if (soonest == null) {
                editor.remove(ARMED).apply();
                return false;
            }
            boolean closeFollowUp = following != null && following.getLong("at") - soonest.getLong("at") < CLOSE_GAP_MS;
            if (!schedule(context, soonest, closeFollowUp)) {
                editor.remove(ARMED).apply();
                return false;
            }
            editor.putInt(ARMED, soonest.getInt("id")).apply();
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static boolean schedule(Context context, JSONObject item, boolean asAlarmClock) throws Exception {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) return false;
        int id = item.getInt("id");
        long at = item.getLong("at");
        PendingIntent fire = fireIntent(context, id, item.getString("title"), item.getString("body"));
        if (asAlarmClock) {
            Intent show = new Intent(context, MainActivity.class);
            show.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent showIntent = PendingIntent.getActivity(
                context,
                id,
                show,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showIntent), fire);
        } else {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        }
        return true;
    }

    private static void cancelArmed(Context context) {
        int armed = prefs(context).getInt(ARMED, 0);
        if (armed != 0) cancel(context, armed);
    }

    private static void cancel(Context context, int id) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        manager.cancel(fireIntent(context, id, "", ""));
    }

    private static PendingIntent fireIntent(Context context, int id, String title, String body) {
        Intent intent = new Intent(context, AlertReceiver.class);
        intent.setAction(AlertReceiver.ACTION_FIRE);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        return PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static JSONArray load(Context context) throws Exception {
        String raw = prefs(context).getString(KEY, "[]");
        return new JSONArray(raw == null ? "[]" : raw);
    }

    private static void save(Context context, JSONArray alerts) {
        prefs(context).edit().putString(KEY, alerts.toString()).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
