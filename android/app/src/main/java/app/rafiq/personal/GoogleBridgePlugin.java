package app.rafiq.personal;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.security.KeyStore;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

@CapacitorPlugin(name="GoogleBridge")
public class GoogleBridgePlugin extends Plugin {
    private final java.util.concurrent.ExecutorService executor=Executors.newSingleThreadExecutor();
    private javax.crypto.SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(!store.containsAlias("rafiq-google")){KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");gen.init(new KeyGenParameterSpec.Builder("rafiq-google",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());gen.generateKey();}
        return (javax.crypto.SecretKey)store.getKey("rafiq-google",null);
    }
    private String secret() throws Exception {
        String saved=getContext().getSharedPreferences("rafiq-google",0).getString("key","");if(saved.isEmpty())return "";
        String[] parts=saved.split(":");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
    }
    @PluginMethod public void saveKey(PluginCall call){try{String apiKey=call.getString("key","").trim();if(apiKey.length()<20||apiKey.length()>300){call.reject("راجع مفتاح Google API");return;}Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());String saved=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(apiKey.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);getContext().getSharedPreferences("rafiq-google",0).edit().putString("key",saved).commit();call.resolve();}catch(Exception e){call.reject("تعذر حفظ المفتاح بخزنة أندرويد");}}
    @PluginMethod public void clearKey(PluginCall call){getContext().getSharedPreferences("rafiq-google",0).edit().clear().commit();call.resolve();}
    @PluginMethod public void status(PluginCall call){try{JSObject result=new JSObject();result.put("configured",!secret().isEmpty());result.put("provider","Google Gemini — Android Keystore");result.put("model","gemini-3.8-flash");call.resolve(result);}catch(Exception e){call.reject("تعذر فتح خزنة المفتاح");}}
    private JSONObject request(String path,String body)throws Exception {
        String apiKey=secret();if(apiKey.isEmpty())throw new IOException("أضف مفتاح Google من إعدادات الاتصال");
        URL url=new URL("https://generativelanguage.googleapis.com/v1beta/"+path);
        javax.net.ssl.HttpsURLConnection c=(javax.net.ssl.HttpsURLConnection)url.openConnection();
        try{c.setConnectTimeout(20000);c.setReadTimeout(90000);c.setRequestProperty("x-goog-api-key",apiKey);c.setRequestProperty("Content-Type","application/json");
        if(body!=null){c.setRequestMethod("POST");c.setDoOutput(true);try(OutputStream stream=c.getOutputStream()){stream.write(body.getBytes(StandardCharsets.UTF_8));}}
        int status=c.getResponseCode();if(status<200||status>=300)throw new IOException(status==429?"تم بلوغ حد Google API؛ جرّب لاحقاً":status==400||status==403?"Google رفض الطلب؛ راجع المفتاح وصلاحيات النموذج":"تعذر الاتصال بـGoogle ("+status+")");
        try(InputStream stream=c.getInputStream()){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int count;while((count=stream.read(buffer))!=-1)out.write(buffer,0,count);return new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8));}
        }finally{c.disconnect();}
    }
    @PluginMethod public void models(PluginCall call){executor.execute(()->{try{JSONObject response=request("models?pageSize=100",null);JSONArray all=response.optJSONArray("models"),filtered=new JSONArray();if(all!=null)for(int i=0;i<all.length();i++){JSONObject m=all.getJSONObject(i);String name=m.optString("name");JSONArray methods=m.optJSONArray("supportedGenerationMethods");if(name.contains("gemini")&&methods!=null&&methods.toString().contains("generateContent")){JSONObject x=new JSONObject();x.put("id",name.replace("models/",""));x.put("name",m.optString("displayName",name));filtered.put(x);}}JSObject out=new JSObject();out.put("models",filtered);call.resolve(out);}catch(Exception e){call.reject(e.getMessage());}});}
    @PluginMethod public void generate(PluginCall call){executor.execute(()->{try{String model=call.getString("model","");if(!model.matches("[a-zA-Z0-9._-]{1,120}")){call.reject("اختار نموذج Gemini صحيحاً");return;}String json=call.getString("json","");if(json.length()>10000000){call.reject("الطلب أكبر من المسموح");return;}JSONObject response=request("models/"+model+":generateContent",json);JSONArray candidates=response.optJSONArray("candidates");if(candidates==null||candidates.length()==0)throw new IOException("ما وصل رد؛ جرّب صياغة ثانية");JSONArray parts=candidates.getJSONObject(0).getJSONObject("content").getJSONArray("parts");StringBuilder text=new StringBuilder();for(int i=0;i<parts.length();i++)text.append(parts.getJSONObject(i).optString("text"));String raw=text.toString().replaceAll("^```(?:json)?\\s*|\\s*```$","");JSONObject result;try{result=new JSONObject(raw);}catch(Exception e){result=new JSONObject();result.put("reply",raw);result.put("proposal",JSONObject.NULL);}call.resolve(new JSObject(result.toString()));}catch(Exception e){call.reject(e.getMessage()==null?"تعذر الاتصال بـGoogle":e.getMessage());}});}
}
