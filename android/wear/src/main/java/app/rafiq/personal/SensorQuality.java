package app.rafiq.personal;
final class SensorQuality {
 static boolean accept(float bpm,int accuracy,long measuredNanos,long nowNanos){return Float.isFinite(bpm)&&bpm>=25&&bpm<=240&&accuracy>0&&accuracy<=3&&measuredNanos>0&&measuredNanos<=nowNanos&&nowNanos-measuredNanos<=15000000000L;}
}
