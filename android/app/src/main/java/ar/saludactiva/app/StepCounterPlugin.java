package ar.saludactiva.app;

import android.Manifest;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Lee el contador de pasos del propio teléfono (TYPE_STEP_COUNTER). El hardware lo va sumando todo el día
 * aunque la app esté cerrada; la app lo consulta al abrirse y calcula la diferencia desde la última lectura.
 */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = { @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION }) }
)
public class StepCounterPlugin extends Plugin {

    private SensorManager manager() {
        return (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
    }

    // Antes de Android 10 no existe el permiso de actividad física en tiempo de ejecución.
    private boolean granted() {
        return Build.VERSION.SDK_INT < 29 || getPermissionState("activity") == PermissionState.GRANTED;
    }

    private void respondGranted(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", granted());
        call.resolve(r);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        SensorManager m = manager();
        JSObject r = new JSObject();
        r.put("available", m != null && m.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null);
        call.resolve(r);
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        respondGranted(call);
    }

    @PluginMethod
    public void ensurePermission(PluginCall call) {
        if (granted()) {
            respondGranted(call);
        } else {
            requestPermissionForAlias("activity", call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        respondGranted(call);
    }

    @PluginMethod
    public void read(final PluginCall call) {
        final SensorManager m = manager();
        final Sensor s = m == null ? null : m.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (s == null) {
            call.reject("Este teléfono no tiene contador de pasos");
            return;
        }
        if (!granted()) {
            call.reject("Falta el permiso de actividad física");
            return;
        }
        final boolean[] done = { false };
        final SensorEventListener listener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent e) {
                if (done[0]) return;
                done[0] = true;
                m.unregisterListener(this);
                JSObject r = new JSObject();
                r.put("counter", (double) e.values[0]);
                r.put("bootTime", (double) (System.currentTimeMillis() - SystemClock.elapsedRealtime()));
                call.resolve(r);
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {}
        };
        m.registerListener(listener, s, SensorManager.SENSOR_DELAY_NORMAL);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!done[0]) {
                done[0] = true;
                m.unregisterListener(listener);
                call.reject("El sensor de pasos no respondió");
            }
        }, 8000);
    }
}
