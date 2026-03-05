import DodoPayments from 'dodopayments'

// DodoPayments server client (use in API routes only)
export function getDodoClient() {
  return new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
  })
}

// Tier definitions
export type SubscriptionTier = 'free' | 'basic' | 'pro'

export const TIER_LIMITS = {
  free: { messagesPerWindow: 20, windowMs: 60 * 60 * 1000, monthlyLimit: null, memoryEnabled: false },
  basic: { messagesPerWindow: null, windowMs: null, monthlyLimit: 500, memoryEnabled: true },
  pro: { messagesPerWindow: null, windowMs: null, monthlyLimit: null, memoryEnabled: true },
} as const

export function getTierFromProfile(subscriptionTier: string | null): SubscriptionTier {
  if (subscriptionTier === 'pro') return 'pro'
  if (subscriptionTier === 'basic') return 'basic'
  return 'free'
}

export function isMemoryEnabled(tier: SubscriptionTier): boolean {
  return TIER_LIMITS[tier].memoryEnabled
}
