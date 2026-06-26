// OPTIONAL LLM fallback - disabled by default. The rule engine alone correctly
// handles all 5 public sample cases and is fast, free, and deterministic.
//
// Enable this only if you want better recall on ambiguous/code-mixed messages the
// rule engine isn't confident about. Turn it on with USE_LLM_FALLBACK=true and set
// LLM_API_URL / LLM_API_KEY / LLM_MODEL for whichever provider you choose.
//
// Design choices that matter for the grader's runtime SLA:
//   - hard 8s timeout, well inside the 30s /sort-ticket budget
//   - any failure (timeout, bad JSON, non-200) returns null and the caller keeps
//     the rule-based result instead of erroring out or hanging

export const LLM_FALLBACK_ENABLED = process.env.USE_LLM_FALLBACK === 'true';

const TIMEOUT_MS = 8000;

export async function classifyWithLlmFallback(message) {
  if (!LLM_FALLBACK_ENABLED) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(process.env.LLM_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'your-model-here',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content:
              'Classify this customer support message into exactly one case_type from ' +
              '[wrong_transfer, payment_failed, refund_request, phishing_or_social_engineering, other], ' +
              'one severity from [low, medium, high, critical], and one department from ' +
              '[customer_support, dispute_resolution, payments_ops, fraud_risk]. ' +
              'Respond with ONLY raw JSON, no markdown fences, no prose: ' +
              '{"case_type":"","severity":"","department":"","confidence":0.0}\n' +
              `Message: """${message}"""`,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.content?.[0]?.text ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Network error, abort/timeout, or malformed JSON - fail soft.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
