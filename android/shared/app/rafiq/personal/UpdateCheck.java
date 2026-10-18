package app.rafiq.personal;
import java.net.*;
import java.io.*;
import org.json.*;
public final class UpdateCheck {
 public static JSONObject check(String installed,String asset) throws Exception {
  HttpURLConnection connection=(HttpURLConnection)new URL("https://api.github.com/repos/spardexlab-maker/friend/releases/latest").openConnection();
  connection.setConnectTimeout(15000);connection.setReadTimeout(20000);connection.setRequestProperty("Accept","application/vnd.github+json");connection.setRequestProperty("User-Agent","Rafiq-Android");
  try {
   int code=connection.getResponseCode();
   if(code==404)throw new IOException("لا توجد نسخة منشورة بعد");
   if(code!=200)throw new IOException("تعذر فحص التحديث؛ جرّب لاحقاً");
   String raw;try(InputStream input=connection.getInputStream()){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1){if(out.size()+count>1000000)throw new IOException("Response too large");out.write(buffer,0,count);}raw=new String(out.toByteArray(),java.nio.charset.StandardCharsets.UTF_8);}
   JSONObject release=new JSONObject(raw);String version=release.getString("tag_name").replaceFirst("^v","");
   if(!version.matches("[0-9]+\\.[0-9]+\\.[0-9]+"))throw new IOException("رقم إصدار غير صالح");
   String download="";JSONArray assets=release.getJSONArray("assets");for(int i=0;i<assets.length();i++){JSONObject item=assets.getJSONObject(i);if(asset.equals(item.optString("name")))download=item.getString("browser_download_url");}
   if(!download.startsWith("https://github.com/spardexlab-maker/friend/releases/download/"))throw new IOException("ملف التحديث غير متوفر");
   String[] a=version.split("\\."),b=installed.split("\\.");boolean newer=false;for(int i=0;i<3;i++){int x=Integer.parseInt(a[i]),y=Integer.parseInt(b[i]);if(x!=y){newer=x>y;break;}}
   return new JSONObject().put("installed",installed).put("version",version).put("available",newer).put("url",download);
  } finally {connection.disconnect();}
 }
}
