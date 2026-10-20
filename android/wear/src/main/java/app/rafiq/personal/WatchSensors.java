package app.rafiq.personal;

import android.app.Activity;
import android.hardware.*;
import android.os.Build;
import android.content.pm.PackageManager;

public class WatchSensors implements SensorEventListener {
 public interface Callback { void reading(float bpm,int accuracy); void state(String text); }
 private final Activity activity;private final Callback callback;private final SensorManager manager;private boolean active=false;private long last=0;
 private final android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
 private final Runnable freshness=new Runnable(){public void run(){if(!active)return;if(last>0&&android.os.SystemClock.elapsedRealtime()-last>15000)callback.state("انقطعت القراءة؛ ثبّت الساعة وانتظر إشارة حديثة");handler.postDelayed(this,3000);}};
 public WatchSensors(Activity activity,Callback callback){this.activity=activity;this.callback=callback;manager=(SensorManager)activity.getSystemService(Activity.SENSOR_SERVICE);}
 String permission(){return Build.VERSION.SDK_INT>=36?"android.permission.health.READ_HEART_RATE":"android.permission.BODY_SENSORS";}
 public void start(){if(activity.checkSelfPermission(permission())!=PackageManager.PERMISSION_GRANTED){activity.requestPermissions(new String[]{permission()},41);return;}Sensor heart=manager.getDefaultSensor(Sensor.TYPE_HEART_RATE);if(heart==null){callback.state("حساس النبض غير متاح");return;}active=manager.registerListener(this,heart,SensorManager.SENSOR_DELAY_NORMAL);callback.state(active?"ثبّت الساعة على معصمك…":"تعذر تشغيل الحساس");}
 public void stop(){manager.unregisterListener(this);active=false;last=0;handler.removeCallbacks(freshness);}
 public boolean active(){return active;}
 public void onSensorChanged(SensorEvent event){if(!active||event.values.length==0||event.sensor.getType()!=Sensor.TYPE_HEART_RATE)return;float bpm=event.values[0];if(!SensorQuality.accept(bpm,event.accuracy,event.timestamp,android.os.SystemClock.elapsedRealtimeNanos())){callback.state("ثبّت الساعة؛ لا توجد قراءة حديثة موثوقة");return;}long now=android.os.SystemClock.elapsedRealtime();if(now-last<1000)return;last=now;handler.removeCallbacks(freshness);handler.postDelayed(freshness,3000);callback.reading(bpm,event.accuracy);}
 public void onAccuracyChanged(Sensor sensor,int accuracy){if(accuracy<=SensorManager.SENSOR_STATUS_UNRELIABLE)callback.state("بانتظار تلامس ثابت مع المعصم");}
}
