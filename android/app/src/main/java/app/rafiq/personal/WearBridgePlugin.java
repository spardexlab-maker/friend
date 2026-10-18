package app.rafiq.personal;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.wearable.*;
import org.json.*;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name="WearBridge")
public class WearBridgePlugin extends Plugin {
    @PluginMethod public void printCourse(PluginCall call) {
        getActivity().runOnUiThread(()->{
            try {
                android.print.PrintManager manager=(android.print.PrintManager)getActivity().getSystemService(android.content.Context.PRINT_SERVICE);
                manager.print("Rafiq training plan",bridge.getWebView().createPrintDocumentAdapter("رفيق — كورس التمرين"),new android.print.PrintAttributes.Builder().build());
                call.resolve();
            } catch(Exception e){call.reject("تعذر فتح الطباعة");}
        });
    }
    @PluginMethod public void publish(PluginCall call) {
        String json=call.getString("json", "{}");
        PutDataMapRequest map=PutDataMapRequest.create("/rafiq/plan");
        map.getDataMap().putString("json",json);
        map.getDataMap().putLong("updated",System.currentTimeMillis());
        Wearable.getDataClient(getContext()).putDataItem(map.asPutDataRequest().setUrgent())
            .addOnSuccessListener(x->call.resolve()).addOnFailureListener(e->call.reject("تعذرت مزامنة الساعة"));
    }
    @PluginMethod public void pending(PluginCall call) {
        Wearable.getDataClient(getContext()).getDataItems().addOnSuccessListener(buffer->{
            try { for(DataItem item:buffer) WearEvents.capture(getContext(),item); }
            finally {buffer.release();}
            JSObject out=new JSObject();out.put("json",WearEvents.read(getContext()).toString());call.resolve(out);
        }).addOnFailureListener(e->{JSObject out=new JSObject();out.put("json",WearEvents.read(getContext()).toString());call.resolve(out);});
    }
    @PluginMethod public void acknowledge(PluginCall call) {
        String raw=call.getString("ids","[]");
        try { JSONArray ids=new JSONArray(raw);Set<String> remove=new HashSet<>();for(int i=0;i<ids.length();i++)remove.add(ids.getString(i));WearEvents.remove(getContext(),remove);call.resolve();}
        catch(Exception e){call.reject("تعذرت معالجة تأكيد الساعة");}
    }
}
