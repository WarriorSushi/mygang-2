// Tier definitions
export type SubscriptionTier = 'free' | 'basic' | 'pro'

export const TIER_LIMITS = {
  free: { messagesPerWindow: 25, windowMs: 60 * 60 * 1000, monthlyLimit: null, memoryEnabled: true, memoryMaxCount: 20, memoryInPrompt: 0, squadLimit: 4, contextLimit: 25 },
  basic: { messagesPerWindow: 40, windowMs: 60 * 60 * 1000, monthlyLimit: null, memoryEnabled: true, memoryMaxCount: 50, memoryInPrompt: 3, squadLimit: 5, contextLimit: 40 },
  pro: { messagesPerWindow: null, windowMs: null, monthlyLimit: null, memoryEnabled: true, memoryMaxCount: null, memoryInPrompt: 5, squadLimit: 6, contextLimit: 50 },
} as const

export const TIER_COPY = {
  free: {
    label: 'Free',
    badgeLabel: null,
    messagesLabel: '25 messages per hour',
    shortMessagesLabel: '25/hr',
    usageHeading: '25 messages per hour',
    usageDescription: 'Starter access with squad chat and saved memories that do not enter prompt context.',
    memoryLabel: 'Starter memory',
    cooldownLabel: '60 min when capped',
    priceLabel: '$0',
    comparisonMessagesLabel: '25/hr',
  },
  basic: {
    label: 'Basic',
    badgeLabel: 'Basic',
    messagesLabel: '40 messages per hour',
    shortMessagesLabel: '40/hr',
    usageHeading: '40 messages per hour + memory',
    usageDescription: 'Memory, ecosystem chat, wallpapers, and custom names without monthly caps.',
    memoryLabel: 'Improved longer memory',
    cooldownLabel: 'None',
    priceLabel: '$14.99/mo',
    comparisonMessagesLabel: '40/hr',
  },
  pro: {
    label: 'Pro',
    badgeLabel: 'Pro',
    messagesLabel: 'Unlimited messages',
    shortMessagesLabel: 'Unlimited',
    usageHeading: 'Unlimited messages + full memory',
    usageDescription: 'Highest squad size, richest memory behavior, and priority response speed.',
    memoryLabel: 'Solid large memory',
    cooldownLabel: 'None',
    priceLabel: '$19.99/mo',
    comparisonMessagesLabel: 'Unlimited',
  },
} as const

export function getTierCopy(tier: SubscriptionTier) {
  return TIER_COPY[tier]
}

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

export function getMessagesPerWindow(tier: SubscriptionTier): number | null {
  return TIER_LIMITS[tier].messagesPerWindow
}

export function getTierUsageHeading(tier: SubscriptionTier): string {
  return TIER_COPY[tier].usageHeading
}

export function getTierMessagesLabel(tier: SubscriptionTier): string {
  return TIER_COPY[tier].messagesLabel
}
