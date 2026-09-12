package com.signature.signatureapp.model;

public enum SignatureRole {
    // Recipient reviews a signature the sender already placed, then approves
    // (witnesses) or declines it. This is the app's original/default behavior.
    VALIDATOR,

    // Recipient sees a blank marker at the position the sender set, and must
    // create their own signature (typed or drawn) to fill it.
    SIGNER
}
