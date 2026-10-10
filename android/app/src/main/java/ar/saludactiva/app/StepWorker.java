package ar.saludactiva.app;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Cada ~15 min lee el contador de pasos del teléfono y guarda la lectura (hora, contador, arranque).
 * La app las recoge al abrirse (StepCounterPlugin.drain) y reparte los pasos por día.
 */
public class StepWorker extends Worker {
    static final String PREFS = "step_readings";
    static final String KEY = "list";
    static final int MAX = 700; // ~7 días de lecturas cada 15 min
    static final Object LOCK = new Object();

    public StepWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        if (Build.VERSION.SDK_INT >= 29
            && ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
            return Result.success();
        }
        SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        Sensor sensor = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (sensor == null) return Result.success();

        final float[] value = { -1f };
        final CountDownLatch latch = new CountDownLatch(1);
        HandlerThread thread = new HandlerThread("step-worker");
        thread.start();
        SensorEventListener listener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent e) {
                value[0] = e.values[0];
                latch.countDown();
            }

            @Override
            public void onAccuracyChanged(Sensor s, int a) {}
        };
        try {
            sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, new Handler(thread.getLooper()));
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
        } finally {
            sm.unregisterListener(listener);
            thread.quitSafely();
        }
        if (value[0] >= 0) save(ctx, value[0]);
        return Result.success();
    }

    private static void save(Context ctx, float counter) {
        synchronized (LOCK) {
            SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            try {
                JSONArray list = new JSONArray(p.getString(KEY, "[]"));
                JSONObject o = new JSONObject();
                o.put("t", System.currentTimeMillis());
                o.put("c", (double) counter);
                o.put("b", System.currentTimeMillis() - SystemClock.elapsedRealtime());
                list.put(o);
                JSONArray cut = new JSONArray();
                for (int i = Math.max(0, list.length() - MAX); i < list.length(); i++) cut.put(list.get(i));
                p.edit().putString(KEY, cut.toString()).apply();
            } catch (Exception ignored) {
            }
        }
    }
}
