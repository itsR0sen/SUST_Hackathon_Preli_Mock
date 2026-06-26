// Self-test against the 5 public sample cases from the spec. Run this against your
// local or deployed server before submitting - there's no excuse to submit blind.
//
// Usage:
//   npm start                     (in one terminal)
//   npm run test:samples          (in another)
//   BASE_URL=https://your-deployed-url npm run test:samples   (against a live deploy)

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const samples = [
  {
    ticket_id: 'T-1',
    message: 'I sent 3000 to wrong number',
    expected_case_type: 'wrong_transfer',
    expected_severity: 'high',
  },
  {
    ticket_id: 'T-2',
    message: 'Payment failed but balance deducted',
    expected_case_type: 'payment_failed',
    expected_severity: 'high',
  },
  {
    ticket_id: 'T-3',
    message: 'Someone called asking my OTP, is that bKash?',
    expected_case_type: 'phishing_or_social_engineering',
    expected_severity: 'critical',
  },
  {
    ticket_id: 'T-4',
    message: 'Please refund my last transaction, I changed my mind',
    expected_case_type: 'refund_request',
    expected_severity: 'low',
  },
  {
    ticket_id: 'T-5',
    message: 'App crashed when I opened it',
    expected_case_type: 'other',
    expected_severity: 'low',
  },
];

async function run() {
  let passed = 0;

  for (const sample of samples) {
    const res = await fetch(`${BASE_URL}/sort-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: sample.ticket_id, message: sample.message }),
    });
    const body = await res.json();

    const typeOk = body.case_type === sample.expected_case_type;
    const sevOk = body.severity === sample.expected_severity;
    const ok = typeOk && sevOk;
    passed += ok ? 1 : 0;

    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${sample.ticket_id}: "${sample.message}"\n` +
        `   got      case_type=${body.case_type} severity=${body.severity}\n` +
        `   expected case_type=${sample.expected_case_type} severity=${sample.expected_severity}\n`
    );
  }

  console.log(`${passed}/${samples.length} public sample cases passed`);
  process.exit(passed === samples.length ? 0 : 1);
}

run().catch((err) => {
  console.error('Self-test failed to run:', err);
  process.exit(1);
});
