package app.rafiq.personal;
import org.junit.Test;
import static org.junit.Assert.*;
public class SensorQualityTest {
 @Test public void acceptsRecentContactReading(){assertTrue(SensorQuality.accept(80,3,20000000000L,21000000000L));}
 @Test public void rejectsInvalidAndUnreliable(){assertFalse(SensorQuality.accept(Float.NaN,3,1,2));assertFalse(SensorQuality.accept(Float.POSITIVE_INFINITY,3,1,2));assertFalse(SensorQuality.accept(80,0,1,2));assertFalse(SensorQuality.accept(0,3,1,2));}
 @Test public void rejectsStaleAndFuture(){assertFalse(SensorQuality.accept(80,3,1,16000000002L));assertFalse(SensorQuality.accept(80,3,3,2));}
}
