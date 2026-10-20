package app.rafiq.personal;
import android.content.Context;
import com.google.android.gms.wearable.*;
import org.json.*;
final class ExerciseOutbox {
 static synchronized boolean save(Context c,JSONObject event){try{JSONArray queue=new JSONArray(c.getSharedPreferences("rafiq-exercise-outbox",0).getString("pending","[]"));for(int i=0;i<queue.length();i++)if(queue.getJSONObject(i).getString("id").equals(event.getString("id")))return true;queue.put(event);return c.getSharedPreferences("rafiq-exercise-outbox",0).edit().putString("pending",queue.toString()).commit();}catch(Exception e){return false;}}
 static void resend(Context c){try{JSONArray queue=new JSONArray(c.getSharedPreferences("rafiq-exercise-outbox",0).getString("pending","[]"));for(int i=0;i<queue.length();i++){JSONObject e=queue.getJSONObject(i);PutDataMapRequest r=PutDataMapRequest.create("/rafiq/event/"+e.getString("id"));r.getDataMap().putString("json",e.toString());Wearable.getDataClient(c).putDataItem(r.asPutDataRequest().setUrgent());}}catch(Exception ignored){}}
 static synchronized boolean acknowledge(Context c,JSONArray ids){try{java.util.Set<String> saved=new java.util.HashSet<>();for(int i=0;i<ids.length();i++)saved.add(ids.getString(i));JSONArray queue=new JSONArray(c.getSharedPreferences("rafiq-exercise-outbox",0).getString("pending","[]")),next=new JSONArray();for(int i=0;i<queue.length();i++)if(!saved.contains(queue.getJSONObject(i).getString("id")))next.put(queue.getJSONObject(i));return c.getSharedPreferences("rafiq-exercise-outbox",0).edit().putString("pending",next.toString()).commit();}catch(Exception e){return false;}}
}
