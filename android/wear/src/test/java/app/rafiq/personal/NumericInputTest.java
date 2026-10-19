package app.rafiq.personal;
import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class NumericInputTest {
    @Test public void acceptsArabicAndPersianKeyboardDecimals() {
        assertEquals(150.5, NumericInput.parse("١٥٠٫٥"), 0);
        assertEquals(2.5, NumericInput.parse("۲.۵"), 0);
        assertEquals(20, NumericInput.parse(" 20 "), 0);
    }
    @Test(expected=NumberFormatException.class) public void rejectsAmbiguousGrouping() { NumericInput.parse("١٬٥٠٠"); }
    @Test(expected=NumberFormatException.class) public void rejectsInfinity() { NumericInput.parse("Infinity"); }
    @Test(expected=NumberFormatException.class) public void rejectsNotANumber() { NumericInput.parse("NaN"); }
    @Test(expected=NumberFormatException.class) public void rejectsEmptyInput() { NumericInput.parse(" "); }
}
