export const SITE_URL = 'https://demo.bawebtech.com/';
const siteOrigin = new URL(SITE_URL).origin;

// All top-level destinations, including popups, go through this policy.
export function destination(url: string): 'internal' | 'external' | 'blocked' {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
      return 'blocked';
    return parsed.origin === siteOrigin ? 'internal' : 'external';
  } catch {
    return 'blocked';
  }
}

export function navigationAction(request: {
  url: string;
  navigationType?: string;
  isTopFrame?: boolean;
}): 'allow' | 'open-browser' | 'block' {
  if (request.isTopFrame === false) return 'allow';
  const target = destination(request.url);
  if (target === 'internal') return 'allow';
  // Redirects/script navigation cannot launch other apps or replace this view.
  return target === 'external' && request.navigationType === 'click'
    ? 'open-browser'
    : 'block';
}

export function sameDocument(left: string, right: string): boolean {
  try {
    const a = new URL(left),
      b = new URL(right);
    a.hash = '';
    b.hash = '';
    return a.href === b.href;
  } catch {
    return false;
  }
}
