export const discoveryPolicy = {
  version: 'contextual-v1',
  maximumPerVisit: 1,
  impressionCooldownDays: 14,
  dismissalCooldownDays: 90,
  fewerSuggestionsDays: 7,
} as const;
export const discoveryContexts = [
  'investing',
  'loan-auto',
  'loan-personal',
] as const;
export type DiscoveryContext = (typeof discoveryContexts)[number];
export const discoveryInvitations = {
  investing: {
    featureId: 'easycoin',
    placement: 'investing-exploration',
    title: 'Curious about digital assets?',
    message:
      'Learn how cryptocurrency works and consider its risks before making any decisions.',
    reason: 'explicit-investing-interest',
    returnTo: '/savings',
  },
  'loan-auto': {
    featureId: 'skip-pay',
    placement: 'loan-payment',
    title: 'An option for an upcoming payment',
    message: 'See whether you can defer an upcoming payment.',
    reason: 'demo-loan-eligible',
    returnTo: '/loans?loan=auto',
  },
} as const;
export const demoLoans = [
  {
    key: 'auto',
    name: 'Harbor auto loan',
    lastFour: '2846',
    balanceMinor: 1482500,
    paymentMinor: 32500,
    eligibleForDiscovery: true,
  },
  {
    key: 'personal',
    name: 'Harbor personal loan',
    lastFour: '7319',
    balanceMinor: 420000,
    paymentMinor: 17500,
    eligibleForDiscovery: false,
  },
] as const;
export type DiscoveryPreferences = {
  optOut: boolean;
  fewerSuggestions: boolean;
};
export function suppressionReason(
  input: DiscoveryPreferences & {
    lastImpression: number | null;
    lastDismissal: number | null;
    lastAnyImpression: number | null;
    adopted: boolean;
  },
  now = Date.now(),
): string | null {
  const recent = (at: number | null, days: number) =>
    at !== null && now - at < days * 86400000;
  if (input.optOut) return 'opted-out';
  if (input.adopted) return 'already-activated';
  if (recent(input.lastDismissal, discoveryPolicy.dismissalCooldownDays))
    return 'dismissed';
  if (recent(input.lastImpression, discoveryPolicy.impressionCooldownDays))
    return 'recently-seen';
  if (
    input.fewerSuggestions &&
    recent(input.lastAnyImpression, discoveryPolicy.fewerSuggestionsDays)
  )
    return 'fewer-suggestions';
  return null;
}
