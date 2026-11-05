package com.crmcelulares.app;

/** Local screen authorization. A pending print can never survive leaving its receipt. */
final class ReceiptActionGate {
    private String context = "";
    private long generation;
    boolean update(String next) {
        String value = next != null && next.matches("[A-Za-z0-9_-]{1,100}") ? next : "";
        if (context.equals(value)) return false;
        context = value;
        generation++;
        return true;
    }
    long capture(String requested) { return !context.isEmpty() && context.equals(requested) ? generation : -1; }
    boolean current(long ticket) { return ticket >= 0 && ticket == generation && !context.isEmpty(); }
    void clear() { context = ""; generation++; }
}
