import express from 'express';
import { ticketRequestSchema } from './schemas.js';
import { classifyMessage, buildAgentSummary } from './classifier.js';
import { enforceSafeSummary } from './safety.js';
import { LLM_FALLBACK_ENABLED, classifyWithLlmFallback } from './llmFallback.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LOW_CONFIDENCE_THRESHOLD = 0.5;

// Deliberately does almost nothing - no DB ping, no LLM warm-up - so it always
// responds well inside the 10s budget even under cold start.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/sort-ticket', async (req, res) => {
  const parsed = ticketRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
  }

  const { ticket_id, message } = parsed.data;

  let classification = classifyMessage(message);

  // Only reach for the LLM fallback when the rule engine itself is unsure, and only
  // if it's turned on. classifyWithLlmFallback() already fails soft on its own, so
  // a bad/slow LLM call can never take this endpoint down.
  if (LLM_FALLBACK_ENABLED && classification.confidence < LOW_CONFIDENCE_THRESHOLD) {
    const llmResult = await classifyWithLlmFallback(message);
    if (llmResult) {
      classification = { ...classification, ...llmResult };
    }
  }

  const fallbackSummary = 'Customer reported an issue that requires manual review.';
  const rawSummary = buildAgentSummary(classification);
  const agent_summary = enforceSafeSummary(rawSummary, fallbackSummary);

  const human_review_required =
    classification.severity === 'critical' ||
    classification.case_type === 'phishing_or_social_engineering';

  return res.status(200).json({
    ticket_id,
    case_type: classification.case_type,
    severity: classification.severity,
    department: classification.department,
    agent_summary,
    human_review_required,
    confidence: classification.confidence,
  });
});

// Catch-all error handler - never let an uncaught exception hang a request past the SLA.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`QueueStorm warmup service listening on port ${PORT}`);
});
