package app.rafiq.personal;

/** Accept decimal keyboard output in Arabic or Latin digits without guessing grouping. */
final class NumericInput {
    static double parse(String raw) {
        String text = raw.trim();
        StringBuilder normalized = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            int digit = Character.digit(c, 10);
            if (digit >= 0) normalized.append((char) ('0' + digit));
            else if (c == '\u066B') normalized.append('.');
            else normalized.append(c);
        }
        double value = Double.parseDouble(normalized.toString());
        if (!Double.isFinite(value)) throw new NumberFormatException("Finite number required");
        return value;
    }
}
