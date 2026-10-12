export type Account = {
  id: string;
  kind: 'checking' | 'savings' | 'credit';
  name: string;
  lastFour: string;
  balanceMinor: number;
  currency: string;
};
export type Goal = {
  id: string;
  title: string;
  targetMinor: number;
  currentMinor: number;
};
export type State = {
  user: { id: string; username: string; displayName: string };
  impersonation: { contextId: string; returnTo: string } | null;
  runId: string;
  visitId: string;
  csrf: string;
  profileId: string;
  profile: { name: string; firstName: string };
  variant: 'baseline' | 'value';
  eligible: boolean;
  enrolled: boolean;
  accounts: Account[];
  transactions: {
    id: string;
    description: string;
    amountMinor: number;
    occurredAt: string;
    accountName: string;
  }[];
  goals: Goal[];
  analytics: {
    enabled: boolean;
    revision: string;
    projectId: string | null;
    actor: 'human' | 'automation';
  };
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let browser = sessionStorage.getItem('softek_browser');
if (!browser) {
  browser = crypto.randomUUID();
  sessionStorage.setItem('softek_browser', browser);
}
export async function api<T>(
  path: string,
  body?: unknown,
  csrf?: string,
): Promise<T> {
  let contextId: string | undefined;
  try {
    contextId = JSON.parse(
      sessionStorage.getItem('softek_impersonation_context') ?? 'null',
    )?.contextId;
  } catch {
    /* Invalid saved context is not authentication. */
  }
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: {
      ...(body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      'X-Browser-Session': browser!,
      ...(contextId ? { 'X-Customer-Context': contextId } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    ...(body === undefined
      ? {}
      : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(response.status, data.error ?? 'Please try again.');
  return data;
}
export const money = (minor: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    minor / 100,
  );
export function minor(value: string): number | undefined {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value.trim())) return undefined;
  const [whole, cents = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(cents.padEnd(2, '0'));
}
