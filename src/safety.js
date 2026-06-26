// Defense-in-depth filter: agent_summary must NEVER re-request PIN, OTP, password,
// or full card number. The grader auto-fails any response that does.
//
// Our templated summaries (see classifier.js) are written to be safe by construction,
// but this filter exists as a backstop in case a future LLM fallback (see llmFallback.js)
// generates something unsafe - we never trust generated text without checking it.

const UNSAFE_PATTERNS = [
  /\b(share|provide|send|enter|give|tell|confirm)\b.{0,30}\b(otp|pin|password|cvv|card\s*number)\b/i,
  /\b(otp|pin|password|cvv|card\s*number)\b.{0,30}\b(share|provide|send|enter|give|tell|confirm)\b/i,
  /\bwhat('?s| is)\s+your\s+(otp|pin|password)\b/i,
];

export function isSummarySafe(summary) {
  return !UNSAFE_PATTERNS.some((pattern) => pattern.test(summary));
}

export function enforceSafeSummary(summary, fallback) {
  return isSummarySafe(summary) ? summary : fallback;
}
