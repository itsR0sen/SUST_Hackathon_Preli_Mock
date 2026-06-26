// Rule-based classifier. Checked in priority order - phishing is checked FIRST and
// deliberately over-triggers a little, because a missed scam is far more costly than
// a false alarm that just costs an agent two seconds of double-checking.
//
// Patterns include a handful of common Banglish phrasings (e.g. "vul number") since
// the spec explicitly allows locale = "mixed".

const PHISHING_PATTERN =
  /\b(otp|pin code|cvv)\b|password|is (this|that) (really\s+)?(bkash|the bank)|verify (my|your) account|asked (for|me) (for )?(my )?(otp|pin|password)|claims? to be (bkash|the bank)/i;

const WRONG_TRANSFER_PATTERN =
  /wrong (number|recipient|account|person)|sent to (the )?wrong|vul\s*(number|account)|by mistake.*(sent|transfer)/i;

const PAYMENT_FAILED_PATTERN =
  /payment failed|transaction failed|failed.*(transaction|payment)|deduct(ed)?.*balance|balance.*deduct|didn'?t go through|did not go through/i;

const REFUND_PATTERN =
  /refund|money back|changed my mind|cancel (my|the) (order|transaction|payment)/i;

const CONTESTED_PATTERN =
  /dispute|not satisfied|never (got|received)|did(n'?t| not) receive|fraudulent charge|unauthorized/i;

const OTHER_HINT_PATTERN =
  /crash(ed)?|app (won'?t|wont|doesn'?t) (open|load|work)|bug|error|glitch|freez(e|ed|ing)/i;

const AMOUNT_PATTERN = /(?:taka|tk|bdt|৳)\s?([\d,]+)|([\d,]+)\s?(?:taka|tk|bdt|৳)/i;

function extractAmount(text) {
  const match = text.match(AMOUNT_PATTERN);
  if (!match) return null;
  const raw = match[1] || match[2];
  return raw ? Number(raw.replace(/,/g, '')) : null;
}

export function classifyMessage(message) {
  const text = message.toLowerCase();

  if (PHISHING_PATTERN.test(text)) {
    return {
      case_type: 'phishing_or_social_engineering',
      severity: 'critical',
      department: 'fraud_risk',
      confidence: 0.93,
      matchedRule: 'phishing',
    };
  }

  if (WRONG_TRANSFER_PATTERN.test(text)) {
    return {
      case_type: 'wrong_transfer',
      severity: 'high',
      department: 'dispute_resolution',
      confidence: 0.88,
      matchedRule: 'wrong_transfer',
      amount: extractAmount(text),
    };
  }

  if (PAYMENT_FAILED_PATTERN.test(text)) {
    const deducted = /deduct/i.test(text);
    return {
      case_type: 'payment_failed',
      severity: deducted ? 'high' : 'medium',
      department: 'payments_ops',
      confidence: 0.85,
      matchedRule: 'payment_failed',
    };
  }

  const contested = CONTESTED_PATTERN.test(text);

  if (REFUND_PATTERN.test(text) || contested) {
    // refund_request maps to TWO different departments depending on context -
    // a plain "changed my mind" refund is low-stakes support, a contested one
    // escalates - even if the customer never literally says the word "refund"
    // (e.g. "they took my money, this is unauthorized" is still a refund-type case).
    return {
      case_type: 'refund_request',
      severity: contested ? 'medium' : 'low',
      department: contested ? 'dispute_resolution' : 'customer_support',
      confidence: 0.8,
      matchedRule: 'refund_request',
    };
  }

  // Nothing matched strongly - fall back to "other". Still give a slightly higher
  // confidence if it at least looks like a generic technical complaint.
  return {
    case_type: 'other',
    severity: 'low',
    department: 'customer_support',
    confidence: OTHER_HINT_PATTERN.test(text) ? 0.6 : 0.3,
    matchedRule: 'fallback',
  };
}

export function buildAgentSummary(classification) {
  const { case_type, severity, department, amount } = classification;
  const amountPhrase = amount ? ` of ${amount} BDT` : '';

  switch (case_type) {
    case 'phishing_or_social_engineering':
      return 'Customer reports a suspicious contact requesting sensitive account credentials; potential social engineering attempt.';
    case 'wrong_transfer':
      return `Customer reports sending a payment${amountPhrase} to an incorrect recipient and requests recovery.`;
    case 'payment_failed':
      return severity === 'high'
        ? 'Customer reports a failed transaction where the balance was deducted despite the failure.'
        : 'Customer reports a failed transaction and requests assistance.';
    case 'refund_request':
      return department === 'dispute_resolution'
        ? 'Customer disputes a transaction and is requesting a refund or investigation.'
        : 'Customer requests a refund for a recent transaction.';
    default:
      return 'Customer reported a general issue that does not match a specific known case type.';
  }
}
