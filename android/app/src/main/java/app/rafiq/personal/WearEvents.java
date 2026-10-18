package app.rafiq.personal;

import android.content.Context;
import com.google.android.gms.wearable.*;
import org.json.*;
import java.util.Set;

public class WearEvents extends WearableListenerService {
    public static synchronized JSONArray read(Context c) {
        try{return new JSONArray(c.getSharedPreferences("rafiq-wear",0).getString("queue","[]"));}catch(Exception e){return new JSONArray();}
    }
    public static synchronized void capture(Context c,DataItem item) {
        if(!item.getUri().getPath().startsWith("/rafiq/event/"))return;
        try {
            String raw=DataMapItem.fromDataItem(item).getDataMap().getString("json");
            JSONObject event=new JSONObject(raw);String id=event.getString("id");JSONArray queue=read(c);
            for(int i=0;i<queue.length();i++)if(queue.getJSONObject(i).getString("id").equals(id))return;
            queue.put(event);c.getSharedPreferences("rafiq-wear",0).edit().putString("queue",queue.toString()).commit();
        }catch(Exception ignored){}
    }
    public static synchronized void remove(Context c,Set<String> ids) {
        JSONArray queue=read(c),next=new JSONArray();
        for(int i=0;i<queue.length();i++){JSONObject event=queue.optJSONObject(i);if(event!=null&&!ids.contains(event.optString("id")))next.put(event);}
        c.getSharedPreferences("rafiq-wear",0).edit().putString("queue",next.toString()).commit();
        for(String id:ids)Wearable.getDataClient(c).getDataItems(android.net.Uri.parse("wear://*/rafiq/event/"+id),DataClient.FILTER_LITERAL).addOnSuccessListener(items->{try{for(DataItem item:items)Wearable.getDataClient(c).deleteDataItems(item.getUri());}finally{items.release();}});
    }
    @Override public void onDataChanged(DataEventBuffer events){for(DataEvent e:events)if(e.getType()==DataEvent.TYPE_CHANGED)capture(this,e.getDataItem());}
}
