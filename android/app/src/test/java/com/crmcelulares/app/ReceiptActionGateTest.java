package com.crmcelulares.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class ReceiptActionGateTest {
    @Test public void aReceiptCannotAuthorizeItselfOrUseAnotherScreensContext() {
        ReceiptActionGate gate=new ReceiptActionGate();
        assertEquals(-1,gate.capture("phone-a-receipt"));
        gate.update("phone-a-receipt");
        assertTrue(gate.current(gate.capture("phone-a-receipt")));
        assertEquals(-1,gate.capture("phone-b-receipt"));
    }
    @Test public void leavingAndReturningCannotReviveAnOldPendingPrint() {
        ReceiptActionGate gate=new ReceiptActionGate();gate.update("first");long old=gate.capture("first");
        gate.update("second");gate.update("first");assertFalse(gate.current(old));assertTrue(gate.current(gate.capture("first")));
    }
    @Test public void pausingRequiresFreshAuthorizationEvenForTheSameReceipt() {
        ReceiptActionGate gate=new ReceiptActionGate();gate.update("receipt");long old=gate.capture("receipt");gate.clear();
        assertFalse(gate.current(old));assertEquals(-1,gate.capture("receipt"));gate.update("receipt");assertFalse(gate.current(old));assertTrue(gate.current(gate.capture("receipt")));
    }
    @Test public void aSynchronizationReplayOfTheSameContextDoesNotAuthorizeAnotherReceipt() {
        ReceiptActionGate gate=new ReceiptActionGate();gate.update("receipt");long ticket=gate.capture("receipt");assertFalse(gate.update("receipt"));assertTrue(gate.current(ticket));
        gate.update("");assertFalse(gate.current(ticket));assertEquals(-1,gate.capture(""));gate.update("invalid/context");assertEquals(-1,gate.capture("invalid/context"));
    }
}
