// Example: How the new classification system works

// EXAMPLE 1: Refund request
const message1 = "make me a refund for order #12345, I paid RM 89.90";
// Result:
// Classification: company_follow_up_refund
// Extracted Details:
//   - orderNumber: ORD-12345
//   - refundAmount: 89.90
//   - reason: refund
// Ticket Summary:
//   Classification: company follow up refund
//   Customer Issue: make me a refund for order #12345, I paid RM 89.90
//   Order Number: ORD-12345
//   Refund Amount: RM 89.90

// EXAMPLE 2: Lost package
const message2 = "my package never arrived, tracking # ABC123XYZ, order #67890";
// Result:
// Classification: company_follow_up_missing
// Extracted Details:
//   - orderNumber: ORD-67890
//   - trackingNumber: ABC123XYZ
//   - reason: missing
// Ticket Summary:
//   Classification: company follow up missing
//   Customer Issue: my package never arrived, tracking # ABC123XYZ, order #67890
//   Order Number: ORD-67890
//   Tracking Number: ABC123XYZ

// EXAMPLE 3: Resend request
const message3 = "can you resend my order? the product is defective";
// Result:
// Classification: company_follow_up_resend
// Extracted Details:
//   - reason: resend
// Ticket Summary:
//   Classification: company follow up resend
//   Customer Issue: can you resend my order? the product is defective

// EXAMPLE 4: Damaged item
const message4 = "my item arrived damaged, ORD-54321, I want a replacement";
// Result:
// Classification: company_follow_up_damaged
// Extracted Details:
//   - orderNumber: ORD-54321
//   - reason: damaged
// Ticket Summary:
//   Classification: company follow up damaged
//   Customer Issue: my item arrived damaged, ORD-54321, I want a replacement
//   Order Number: ORD-54321

// EXAMPLE 5: Replacement request
const message5 = "can I get a replacement for the blue shirt";
// Result:
// Classification: company_follow_up_replacement
// Extracted Details:
//   - itemDescription: blue shirt
//   - reason: replacement
// Ticket Summary:
//   Classification: company follow up replacement
//   Customer Issue: can I get a replacement for the blue shirt
//   Item: blue shirt

// EXAMPLE 6: Tracking inquiry
const message6 = "can you check where my order is?";
// Result:
// Classification: company_follow_up_tracking
// Extracted Details:
//   - reason: tracking
// Ticket Summary:
//   Classification: company follow up tracking
//   Customer Issue: can you check where my order is?

// EXAMPLE 7: Legal threat (escalates to EXTREME)
const message7 = "I'm going to sue you for fraud, this is unacceptable!";
// Result:
// Classification: legal_risk
// Tier: EXTREME (auto-escalated)
// Action: escalate_to_manager

// SUPPORTED PATTERNS AND SYNONYMS:

// REFUND patterns:
// - "refund", "money back", "reimburse", "return money"
// - "I want refund", "can I get money back", "I need reimburse"

// RESEND patterns:
// - "resend", "send again", "send another", "re-ship", "ship again"
// - "can you resend", "please send again", "send me another"

// MISSING patterns:
// - "never arrived", "didn't arrive", "missing", "lost package"
// - "where is my order", "still not here", "not received", "lost parcel"
// - "didn't receive", "where's my package"

// DAMAGED patterns:
// - "damaged", "broken", "cracked", "defective", "not working"
// - "arrived damaged", "came damaged", "received damaged"

// REPLACEMENT patterns:
// - "replace", "replacement", "swap", "exchange"
// - "get another", "swap", "exchange for different one"

// TRACKING patterns:
// - "track", "tracking", "where is", "status", "update"
// - "where is my order", "can i track", "track my"

// LEGAL/RISK patterns:
// - "sue", "lawsuit", "legal", "fraud", "chargeback", "dispute", "police"
// - "going to court", "taking legal action"
