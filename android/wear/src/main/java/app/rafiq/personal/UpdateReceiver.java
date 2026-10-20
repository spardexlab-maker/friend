package app.rafiq.personal;
import android.content.*;
import android.content.pm.PackageInstaller;
public class UpdateReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  int status=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
  if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){Intent confirm=android.os.Build.VERSION.SDK_INT>=33?intent.getParcelableExtra(Intent.EXTRA_INTENT,Intent.class):intent.getParcelableExtra(Intent.EXTRA_INTENT);if(confirm!=null)try{confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(confirm);}catch(Exception ignored){} }
  else context.getSharedPreferences("rafiq-update",0).edit().putString("result",status==PackageInstaller.STATUS_SUCCESS?"اكتمل تحديث الساعة":"لم يكتمل التحديث؛ يمكنك إعادة المحاولة").apply();
 }
}
