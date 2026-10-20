package app.rafiq.personal

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.os.*
import androidx.health.services.client.*
import androidx.health.services.client.data.*
import com.google.android.gms.wearable.*
import kotlinx.coroutines.*
import kotlinx.coroutines.guava.await
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

class WorkoutService : Service(), ExerciseUpdateCallback {
 private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
 private val client by lazy { HealthServices.getClient(this).exerciseClient }
 private val prefs by lazy { getSharedPreferences("rafiq-workout",0) }
 private var busy=false
 private var lastHeart=0L
 override fun onBind(intent:Intent?) : IBinder? = null
 override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int {
  val manager=getSystemService(NotificationManager::class.java)
  manager.createNotificationChannel(NotificationChannel("workout","تتبع التمرين",NotificationManager.IMPORTANCE_LOW))
  val open=PendingIntent.getActivity(this,0,Intent(this,WatchActivity::class.java),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  val notification=Notification.Builder(this,"workout").setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("رفيق · تمرينك مستمر").setContentText("اضغط للعودة والإيقاف أو الإنهاء").setContentIntent(open).setOngoing(true).build()
  try { if(Build.VERSION.SDK_INT>=34)startForeground(40,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)else startForeground(40,notification) }
  catch(e:Exception){message("لم يبدأ التتبع؛ افتح التطبيق وراجع الصلاحيات");stopSelf();return START_NOT_STICKY}
  if(busy)return START_NOT_STICKY
  busy=true
  scope.launch {
   try {
    val current=client.getCurrentExerciseInfoAsync().await()
    if(WorkoutOwnership.other(current)){message("تمرين آخر يعمل؛ أوقفه من تطبيقه أولاً");stopSelf();return@launch}
    client.setUpdateCallback(this@WorkoutService)
    when(intent?.action ?: "start") {
     "pause" -> { require(WorkoutOwnership.own(current));client.pauseExerciseAsync().await() }
     "resume" -> { require(WorkoutOwnership.own(current));client.resumeExerciseAsync().await() }
     "end" -> { if(WorkoutOwnership.own(current))client.endExerciseAsync().await()else stopSelf() }
     else -> if(!WorkoutOwnership.own(current)){
      val type=when(intent?.getStringExtra("kind")){"run"->ExerciseType.RUNNING;"walk"->ExerciseType.WALKING;else->ExerciseType.WEIGHTLIFTING}
      val caps=client.getCapabilitiesAsync().await()
      require(caps.supportedExerciseTypes.contains(type)){"هذا النوع غير مدعوم على الساعة"}
      val supported=caps.getExerciseTypeCapabilities(type).supportedDataTypes
      val wanted=setOf(DataType.HEART_RATE_BPM,DataType.CALORIES_TOTAL).filter { supported.contains(it) }.toSet()
      require(wanted.isNotEmpty()){"لا تتوفر قياسات مدعومة لهذا النوع"}
      prefs.edit().putString("session",UUID.randomUUID().toString()).putString("kind",type.name).putLong("start",System.currentTimeMillis()).putFloat("kcal",0f).putLong("seconds",0).apply()
      client.startExerciseAsync(ExerciseConfig.builder(type).setDataTypes(wanted).setIsGpsEnabled(false).setIsAutoPauseAndResumeEnabled(false).build()).await()
     }
    }
   } catch(e:CancellationException){throw e}
   catch(e:Exception){message("تعذر تنفيذ التتبع؛ راجع الصلاحيات ودعم نوع التمرين");stopSelf()}
   finally{busy=false}
  }
  return START_NOT_STICKY
 }
 private fun message(text:String){prefs.edit().putString("message",text).apply()}
 override fun onRegistered() {}
 override fun onRegistrationFailed(throwable:Throwable){message("تعذر الاتصال بخدمة قياس التمرين");stopSelf()}
 override fun onLapSummaryReceived(lapSummary:ExerciseLapSummary) {}
 override fun onAvailabilityChanged(dataType:DataType<*,*>,availability:Availability){if(dataType==DataType.HEART_RATE_BPM&&availability is DataTypeAvailability&&availability!=DataTypeAvailability.AVAILABLE)prefs.edit().remove("bpm").putString("signal","بانتظار إشارة نبض حديثة").apply()}
 override fun onExerciseUpdateReceived(update:ExerciseUpdate){
  val state=update.exerciseStateInfo.state
  val edit=prefs.edit().putBoolean("active",!state.isEnded).putBoolean("paused",state.isPaused).putString("message",if(state.isEnded)"انتهى التتبع" else if(state.isPaused)"التمرين متوقف مؤقتاً" else "التتبع يعمل؛ يمكنك قفل الشاشة")
  update.activeDurationCheckpoint?.let { edit.putLong("seconds",it.activeDuration.seconds+if(!state.isPaused&&!state.isEnded&&!state.isEnding)maxOf(0,java.time.Duration.between(it.time,Instant.now()).seconds)else 0) }
  update.latestMetrics.getData(DataType.CALORIES_TOTAL)?.let { edit.putFloat("kcal",it.total.toFloat()) }
  val point=update.latestMetrics.getData(DataType.HEART_RATE_BPM).lastOrNull()
  if(point!=null&&point.value.isFinite()&&point.value in 25.0..240.0){
   val measured=System.currentTimeMillis()-(SystemClock.elapsedRealtime()-point.timeDurationFromBoot.toMillis())
   edit.putFloat("bpm",point.value.toFloat()).putLong("measured",measured).putString("signal","Health Services · تقدير الحساس")
   if(measured-lastHeart>=10000){lastHeart=measured;publish(JSONObject().put("type","exerciseHeart").put("id",UUID.randomUUID().toString()).put("time",Instant.ofEpochMilli(measured).toString()).put("bpm",point.value))}
  }
  edit.apply()
  if(state.isEnded){
   val event=JSONObject().put("type","exerciseSummary").put("id",prefs.getString("session",UUID.randomUUID().toString())).put("time",Instant.now().toString()).put("name",prefs.getString("kind","تمرين")).put("seconds",prefs.getLong("seconds",0)).put("kcal",prefs.getFloat("kcal",0f).toDouble())
   if(!ExerciseOutbox.save(this,event))message("تعذر حفظ ملخص التمرين؛ راجع مساحة الساعة")
   publish(event);stopSelf()
  }
 }
 private fun publish(event:JSONObject){val request=PutDataMapRequest.create("/rafiq/event/"+event.getString("id"));request.dataMap.putString("json",event.toString());Wearable.getDataClient(this).putDataItem(request.asPutDataRequest().setUrgent())}
 override fun onDestroy(){prefs.edit().putBoolean("active",false).apply();client.clearUpdateCallbackAsync(this);scope.cancel();super.onDestroy()}
}
