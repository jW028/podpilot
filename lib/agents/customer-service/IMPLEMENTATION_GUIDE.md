# Customer Service AI Agent Classification System - Implementation Guide

## Summary of Changes

The customer service AI agent has been updated with an enhanced classification system that provides:

1. **Regex-based Pattern Matching** - Strict classification using regex patterns and synonyms
2. **Auto-Summarization** - Automatic extraction of key details from messages
3. **Ticket Creation** - Structured tickets with extracted information
4. **Exact Classification Types** - Consistent labeling like "company_follow_up_refund", "company_follow_up_resend", etc.

---

## New Classification Types

The system now classifies messages into these specific types:

### Company Follow-up Categories:
- `company_follow_up_refund` - Customer requesting refund
- `company_follow_up_resend` - Customer requesting reshipment
- `company_follow_up_replacement` - Customer requesting item replacement
- `company_follow_up_missing` - Package never arrived
- `company_follow_up_damaged` - Item arrived damaged
- `company_follow_up_tracking` - Tracking/order status inquiry
- `company_follow_up_other` - Other company follow-up needs

### Risk Categories:
- `legal_risk` - Legal threats, fraud claims, chargebacks (auto-escalates to EXTREME)

---

## New Components

### 1. **Classifier Module** (`classifier.ts`)
Location: `lib/agents/customer-service/classifier.ts`

**Key Functions:**
- `classifyMessageWithPatterns(message)` - Classifies message and extracts confidence
- `generateTicketSummary(message, classification)` - Creates structured ticket summary
- `extractDetailsFromMessage(message)` - Extracts order #, tracking #, amount, item description

**Pattern Matching:**
- Uses regex patterns for strict matching
- Falls back to keyword matching with lower confidence (0.7)
- Returns confidence score (0-1)

**Extracted Details:**
```typescript
{
  orderNumber?: "ORD-12345",
  trackingNumber?: "ABC123XYZ",
  refundAmount?: 89.90,
  itemDescription?: "blue shirt",
  reason: "refund" | "resend" | "missing" | "damaged" | "replacement" | "tracking"
}
```

### 2. **Updated Types** (`types/customerService.ts`)
- New `ClassificationType` - specific classification values
- New `TicketSummary` interface - contains classification, extracted details, and summary text
- Updated `CustomerServiceTicket` - includes `classification` and `ticketSummary` fields

### 3. **Enhanced Customer Service Agent** (`customerServiceAgent.ts`)
- Now uses pattern-based classification instead of LLM classifier
- Generates ticket summaries automatically
- Assigns tier based on classification type
- Extracts and stores detailed information

### 4. **Updated UI** (`components/ui/support/CustomerServicePage.tsx`)
- Shows classification type in chat response
- Displays ticket summary with extracted details
- Shows summary in both regular and escalated ticket queues
- Better visual organization with background colors

---

## How It Works

### Flow:
1. User submits message to customer service chat
2. `classifyMessageWithPatterns()` analyzes message:
   - Tests against regex patterns for each classification type
   - Extracts details (order #, tracking #, amount, etc.)
   - Returns classification and confidence score
3. `generateTicketSummary()` creates structured summary:
   - Shows classification type
   - Lists extracted details
   - Formats conversation summary
4. Tier is determined based on classification:
   - `legal_risk` → EXTREME (auto-escalate)
   - `company_follow_up_missing` → EXTREME
   - `company_follow_up_refund` → EXTREME
   - Other `company_follow_up_*` → MID
   - `none` → EASY
5. AI reply is generated
6. Ticket is created with all information if tier is MID or EXTREME
7. UI displays:
   - Classification with human-readable format
   - Ticket summary with extracted details
   - AI response

---

## Pattern Details

### Refund Pattern
**Regex:**
```regex
\b(refund|money\s+back|reimburse|return\s+money|get\s+money)\b
\b(i want|i need|can i get|please give|i'd like)\s+(my\s+)?(money|refund)
```
**Keywords:** "refund", "money back", "reimburse", "return money"
**Confidence:** 0.95

### Missing/Lost Pattern
**Regex:**
```regex
\b(never\s+arrived|didn't\s+arrive|did not arrive|missing|didn't\s+receive|did not receive|not\s+received)\b
\b(where is|where's|track|still not here|haven't received|not received)\b
\b(lost\s+package|package\s+lost|lost\s+parcel|parcel\s+lost)\b
```
**Keywords:** "never arrived", "didn't arrive", "missing", "lost package", etc.
**Confidence:** 0.93

### Damaged Pattern
**Regex:**
```regex
\b(damaged|broken|cracked|defective|not\s+working|doesn't\s+work|does not work)\b
\b(arrived\s+damaged|came\s+damaged|received\s+damaged|damaged\s+on\s+arrival)\b
```
**Keywords:** "damaged", "broken", "cracked", "defective", "not working"
**Confidence:** 0.91

### Resend Pattern
**Regex:**
```regex
\b(resend|send\s+again|send\s+another|re-ship|ship\s+again)\b
\b(can you|please|i need|send me)\s+(another|a new|the)\s+(one|package|item)
```
**Keywords:** "resend", "send again", "re-ship", "ship again"
**Confidence:** 0.92

### Replacement Pattern
**Regex:**
```regex
\b(replace|replacement|swap|exchange|get\s+another)\b
\b(can i|can you|please|i need)\s+(get|have|swap|exchange)\s+(a\s+)?(replacement|new one|different one)
```
**Keywords:** "replace", "replacement", "swap", "exchange"
**Confidence:** 0.90

### Tracking Pattern
**Regex:**
```regex
\b(track|tracking|where\s+is|where's|status|update)\b
\b(where is (my|the)\s+(order|package|parcel)|can i track|track my)\b
```
**Keywords:** "track", "tracking", "where is", "status"
**Confidence:** 0.88

### Legal Risk Pattern
**Regex:**
```regex
\b(sue|lawsuit|legal|fraud|chargeback|dispute|police)\b
\b(report|report.*police|going.*court|taking.*legal)\b
```
**Keywords:** "sue", "lawsuit", "legal", "fraud", "chargeback"
**Confidence:** 0.96 (auto-escalates to EXTREME)

---

## Detail Extraction

### Order Number Extraction
Matches patterns like:
- "order #12345"
- "#12345"
- "ORD-12345"
- "order 12345"

Extracted as: `ORD-12345`

### Tracking Number Extraction
Matches patterns like:
- "tracking #ABC123XYZ"
- "TRK-ABC123XYZ"
- "tracking number: ABC123XYZ"

Extracted as: `ABC123XYZ`

### Refund Amount Extraction
Matches patterns like:
- "RM 89.90"
- "$89.90"
- "100 dollars"
- "RM100"

Extracted as: `89.90` (number)

### Item Description Extraction
Extracts product/item names from context:
- "I want a refund for the blue shirt"
- "the product is defective"
- "replacement for my phone"

---

## Example Ticket Summary

**Message:** "I never received my order #12345, tracking # ABC123XYZ, refund RM 89.90"

**Generated Summary:**
```
Classification: company follow up missing
Customer Issue: I never received my order #12345, tracking # ABC123XYZ, refund RM 89.90
Order Number: ORD-12345
Tracking Number: ABC123XYZ
Refund Amount: RM 89.90
```

---

## Tier Assignment Logic

```
IF classification == "legal_risk"
  → EXTREME (auto-escalate to manager)

IF classification == "company_follow_up_missing" 
  → EXTREME (auto-escalate to manager)

IF classification == "company_follow_up_refund"
  → EXTREME (auto-escalate to manager)

ELSE IF classification starts with "company_follow_up_"
  → MID (create ticket for team)

ELSE
  → EASY (resolved in chat)

IF confidence < 0.7
  → Escalate up (easy → mid → extreme)
```

---

## Testing Examples

See `CLASSIFICATION_EXAMPLES.md` for 7 detailed examples showing:
1. Refund request with amount
2. Lost package with tracking
3. Resend request
4. Damaged item
5. Replacement request
6. Tracking inquiry
7. Legal threat (escalation)

---

## How to Add New Classification Types

To add a new classification type:

1. Add to `ClassificationType` in `types/customerService.ts`
2. Add pattern object to `CLASSIFICATION_PATTERNS` array in `classifier.ts`:
   ```typescript
   {
     type: "company_follow_up_warranty",
     patterns: [/\b(warranty|guarantee|coverage)\b/i],
     keywords: ["warranty", "guarantee", "coverage"],
     confidence: 0.89,
   }
   ```
3. Optionally add tier assignment in `runCustomerServiceAgent()`
4. Test with examples

---

## Files Modified

1. `types/customerService.ts` - Added new types
2. `lib/agents/customer-service/customerServiceAgent.ts` - Integrated new classifier
3. `lib/agents/customer-service/classifier.ts` - NEW FILE with classification logic
4. `components/ui/support/CustomerServicePage.tsx` - Display improvements
5. `lib/agents/customer-service/CLASSIFICATION_EXAMPLES.md` - NEW FILE with examples
