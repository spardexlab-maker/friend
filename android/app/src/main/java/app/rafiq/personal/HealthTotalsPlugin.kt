package app.rafiq.personal

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.*
import java.time.Instant

@CapacitorPlugin(name = "HealthTotals")
class HealthTotalsPlugin : Plugin() {
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
    @PluginMethod fun read(call:PluginCall) {
        scope.launch {
            try {
                val start=Instant.parse(call.getString("start"))
                val end=Instant.parse(call.getString("end"))
                val client=HealthConnectClient.getOrCreate(context)
                val result=client.aggregate(AggregateRequest(
                    metrics=setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                    timeRangeFilter=TimeRangeFilter.between(start,end)
                ))
                val out=JSObject()
                out.put("value",result[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: org.json.JSONObject.NULL)
                call.resolve(out)
            } catch(e:Exception) {call.reject("تعذرت قراءة إجمالي الحرق من Health Connect")}
        }
    }
    override fun handleOnDestroy(){scope.cancel();super.handleOnDestroy()}
}
