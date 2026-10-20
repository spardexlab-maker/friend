package app.rafiq.personal;
import android.content.Context;
import android.net.*;
import java.io.IOException;
import java.util.concurrent.*;
/** Hold Wi-Fi only while the user-requested update needs it. Never changes Wi-Fi settings. */
final class UpdateNetwork implements AutoCloseable {
 private final ConnectivityManager manager;private final ConnectivityManager.NetworkCallback callback;private volatile Network network;
 UpdateNetwork(Context context)throws Exception{
  manager=context.getSystemService(ConnectivityManager.class);CountDownLatch ready=new CountDownLatch(1);
  callback=new ConnectivityManager.NetworkCallback(){@Override public void onAvailable(Network n){network=n;ready.countDown();}@Override public void onUnavailable(){ready.countDown();}};
  manager.requestNetwork(new NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build(),callback,20000);
  if(!ready.await(22,TimeUnit.SECONDS)||network==null){close();throw new IOException("فعّل Wi-Fi مع اتصال إنترنت وأعد المحاولة");}
 }
 Network get(){return network;}
 @Override public void close(){try{manager.unregisterNetworkCallback(callback);}catch(Exception ignored){}}
}
