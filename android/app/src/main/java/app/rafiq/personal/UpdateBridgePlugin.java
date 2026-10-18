package app.rafiq.personal;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.Intent;
import android.net.Uri;
@CapacitorPlugin(name="UpdateBridge")
public class UpdateBridgePlugin extends Plugin {
 @PluginMethod public void check(PluginCall call){getBridge().execute(()->{try {
  String installed=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0).versionName;
  call.resolve(new JSObject(UpdateCheck.check(installed,"Rafiq-phone.apk").toString()));
 }catch(Exception e){call.reject(e.getMessage());}});}
 @PluginMethod public void open(PluginCall call){
  String url=call.getString("url","");
  if(!url.startsWith("https://github.com/spardexlab-maker/friend/releases/download/")||!url.endsWith("/Rafiq-phone.apk")){call.reject("رابط غير صالح");return;}
  try{Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(url));intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);getContext().startActivity(intent);call.resolve();}catch(Exception e){call.reject("افتح صفحة الإصدارات من المتصفح لتنزيل النسخة");}
 }
}
