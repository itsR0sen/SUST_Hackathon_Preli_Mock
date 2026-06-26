import { z } from 'zod';

// Closed enums, copied verbatim from the spec. Keeping these in one place means
// schema validation and the classifier can never silently drift apart.
export const CHANNELS = ['app', 'sms', 'call_center', 'merchant_portal'];
export const LOCALES = ['bn', 'en', 'mixed'];
export const CASE_TYPES = [
  'wrong_transfer',
  'payment_failed',
  'refund_request',
  'phishing_or_social_engineering',
  'other',
];
export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const DEPARTMENTS = [
  'customer_support',
  'dispute_resolution',
  'payments_ops',
  'fraud_risk',
];

export const ticketRequestSchema = z.object({
  ticket_id: z.string().min(1, 'ticket_id is required'),
  channel: z.enum(CHANNELS).optional(),
  locale: z.enum(LOCALES).optional(),
  message: z.string().min(1, 'message is required'),
});

// Used in dev/tests to make sure we never accidentally ship a malformed response.
export const ticketResponseSchema = z.object({
  ticket_id: z.string(),
  case_type: z.enum(CASE_TYPES),
  severity: z.enum(SEVERITIES),
  department: z.enum(DEPARTMENTS),
  agent_summary: z.string(),
  human_review_required: z.boolean(),
  confidence: z.number().min(0).max(1),
});
