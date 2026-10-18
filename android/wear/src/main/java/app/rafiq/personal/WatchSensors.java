package app.rafiq.personal;

import android.app.Activity;
import android.hardware.*;
import android.os.Build;
import android.content.pm.PackageManager;

public class WatchSensors implements SensorEventListener {
 public interface Callback { void reading(float bpm,int accuracy); void state(String text); }
 private final Activity activity;private final Callback callback;private final SensorManager manager;private boolean active=false;private long last=0;
 public WatchSensors(Activity activity,Callback callback){this.activity=activity;this.callback=callback;manager=(SensorManager)activity.getSystemService(Activity.SENSOR_SERVICE);}
 String permission(){return Build.VERSION.SDK_INT>=36?"android.permission.health.READ_HEART_RATE":"android.permission.BODY_SENSORS";}
 public void start(){if(activity.checkSelfPermission(permission())!=PackageManager.PERMISSION_GRANTED){activity.requestPermissions(new String[]{permission()},41);return;}Sensor heart=manager.getDefaultSensor(Sensor.TYPE_HEART_RATE);if(heart==null){callback.state("حساس النبض غير متاح");return;}active=manager.registerListener(this,heart,SensorManager.SENSOR_DELAY_NORMAL);callback.state(active?"ثبّت الساعة على معصمك…":"تعذر تشغيل الحساس");}
 public void stop(){manager.unregisterListener(this);active=false;last=0;}
 public boolean active(){return active;}
 public void onSensorChanged(SensorEvent event){if(!active||event.values.length==0)return;if(event.accuracy<=SensorManager.SENSOR_STATUS_UNRELIABLE){callback.state("ثبّت الساعة؛ القراءة غير موثوقة");return;}float bpm=event.values[0];if(bpm<25||bpm>240)return;long now=android.os.SystemClock.elapsedRealtime();if(now-last<1000)return;last=now;callback.reading(bpm,event.accuracy);}
 public void onAccuracyChanged(Sensor sensor,int accuracy){if(accuracy<=SensorManager.SENSOR_STATUS_UNRELIABLE)callback.state("بانتظار تلامس ثابت مع المعصم");}
}
