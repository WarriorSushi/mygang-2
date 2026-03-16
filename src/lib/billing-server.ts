import DodoPayments from 'dodopayments'

// DodoPayments server client (use in API routes only)
export function getDodoClient() {
  if (!process.env.DODO_PAYMENTS_API_KEY) {
    throw new Error('Missing DODO_PAYMENTS_API_KEY environment variable')
  }
  return new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT as 'live_mode' | 'test_mode',
  })
}
