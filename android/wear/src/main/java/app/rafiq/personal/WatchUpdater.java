package app.rafiq.personal;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import java.io.*;
import java.net.*;
import java.util.*;

final class WatchUpdater {
 interface Progress { void text(String text); }
 static void install(Activity activity,String url,String version,Progress progress){
  if(!url.startsWith("https://github.com/spardexlab-maker/friend/releases/download/")){progress.text("عنوان تحديث غير صالح");return;}
  if(!activity.getPackageManager().canRequestPackageInstalls()){
   progress.text("اسمح لرفيق بتثبيت تحديثه، ثم أعد المحاولة");
   Intent settings=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName()));
   try{activity.startActivity(settings);}catch(Exception e){progress.text("نظام الساعة لا يتيح إذن التثبيت هنا؛ يلزم التثبيت عبر الكمبيوتر");}return;
  }
  new Thread(()->{File file=new File(activity.getCacheDir(),"rafiq-update.apk");int sessionId=-1;PackageInstaller installer=activity.getPackageManager().getPackageInstaller();
   try{
    progress.text("ننزل تحديث الساعة…");HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();connection.setConnectTimeout(20000);connection.setReadTimeout(30000);
    try{if(connection.getResponseCode()!=200||!connection.getURL().getProtocol().equals("https"))throw new IOException();
     try(InputStream in=connection.getInputStream();OutputStream out=new FileOutputStream(file)){byte[] buffer=new byte[16384];int n;long size=0;while((n=in.read(buffer))!=-1){size+=n;if(size>80000000)throw new IOException();out.write(buffer,0,n);}}
    }finally{connection.disconnect();}
    PackageManager pm=activity.getPackageManager();PackageInfo next=pm.getPackageArchiveInfo(file.getAbsolutePath(),PackageManager.GET_SIGNING_CERTIFICATES),current=pm.getPackageInfo(activity.getPackageName(),PackageManager.GET_SIGNING_CERTIFICATES);
    if(next==null||!current.packageName.equals(next.packageName)||!version.equals(next.versionName)||next.getLongVersionCode()<=current.getLongVersionCode()||signatures(current).isEmpty()||!signatures(next).equals(signatures(current)))throw new SecurityException("توقيع التحديث أو الإصدار غير مطابق");
    PackageInstaller.SessionParams params=new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);params.setAppPackageName(activity.getPackageName());params.setSize(file.length());
    if(Build.VERSION.SDK_INT>=31)params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
    sessionId=installer.createSession(params);
    try(PackageInstaller.Session session=installer.openSession(sessionId)){
     try(InputStream in=new FileInputStream(file);OutputStream out=session.openWrite("base.apk",0,file.length())){byte[] buffer=new byte[16384];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);session.fsync(out);}
     Intent result=new Intent(activity,UpdateReceiver.class);PendingIntent pending=PendingIntent.getBroadcast(activity,sessionId,result,PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));session.commit(pending.getIntentSender());}
    progress.text("التحديث جاهز؛ وافق على نافذة تثبيت النظام");
   }catch(Exception e){if(sessionId>=0)try{installer.abandonSession(sessionId);}catch(Exception ignored){}progress.text(e instanceof SecurityException?e.getMessage():"تعذر تنزيل أو تجهيز التحديث؛ أعد المحاولة");}
   finally{if(file.exists())file.delete();}
  }).start();
 }
 static Set<String> signatures(PackageInfo info){Set<String> result=new HashSet<>();if(info.signingInfo!=null)for(Signature s:info.signingInfo.getApkContentsSigners())result.add(s.toCharsString());return result;}
}
