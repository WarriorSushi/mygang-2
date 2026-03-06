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
  free: { messagesPerWindow: 25, windowMs: 60 * 60 * 1000, monthlyLimit: null, memoryEnabled: true, memoryMaxCount: 20, memoryInPrompt: 0, squadLimit: 4, contextLimit: 15 },
  basic: { messagesPerWindow: 40, windowMs: 60 * 60 * 1000, monthlyLimit: null, memoryEnabled: true, memoryMaxCount: 50, memoryInPrompt: 3, squadLimit: 5, contextLimit: 25 },
  pro: { messagesPerWindow: null, windowMs: null, monthlyLimit: null, memoryEnabled: true, memoryMaxCount: null, memoryInPrompt: 5, squadLimit: 6, contextLimit: 35 },
} as const

export function getTierFromProfile(subscriptionTier: string | null): SubscriptionTier {
  if (subscriptionTier === 'pro') return 'pro'
  if (subscriptionTier === 'basic') return 'basic'
  return 'free'
}

export function isMemoryEnabled(tier: SubscriptionTier): boolean {
  return TIER_LIMITS[tier].memoryEnabled
}

/** How many memories to inject into the prompt (0 = saved but not used) */
export function getMemoryInPromptLimit(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier].memoryInPrompt
}

/** Max stored memories (null = unlimited) */
export function getMemoryMaxCount(tier: SubscriptionTier): number | null {
  return TIER_LIMITS[tier].memoryMaxCount
}

export function getSquadLimit(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier].squadLimit
}

export function getContextLimit(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier].contextLimit
}
