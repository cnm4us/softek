import { accountPageAtPath } from '../../api/src/account-pages';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { api, type State } from './api';
import { Demo } from './clarity-audit';
import {
  confirmed,
  collectionAvailable,
  consentChoice,
  initialize,
} from './analytics';
import {
  setRenderedSummaryBanner,
  clearRenderedSummaryBanner,
} from './summary-explorer-context';
import { isAdminRoute } from './routes';
import { featureAtPath } from '../../api/src/features';
import { BannerPlaceholder } from './ui';

export type Banner = {
  id: string;
  bannerId: string | null;
  imageUrl: string | null;
  title: string;
  altText: string;
  href: string;
  destination: string;
  campaignId: string | null;
};
export const sections = [
  { key: 'summary', label: 'Account Summary', href: '/' },
  { key: 'transfers', label: 'Transfers', href: '/transfers' },
  { key: 'savings', label: 'Savings & Investing', href: '/savings' },
  { key: 'loans', label: 'Loans', href: '/loans' },
  { key: 'bill-pay', label: 'Bill Pay', href: '/bill-pay' },
  { key: 'cards', label: 'Cards', href: '/cards' },
  { key: 'goals', label: 'Savings Goals', href: '/goals' },
  { key: 'statements', label: 'Statements', href: '/statements' },
  { key: 'support', label: 'Support', href: '/support' },
];
const documentId = crypto.randomUUID();
let pageId = crypto.randomUUID(),
  pagePath = location.pathname;
export function routeKey(path = location.pathname) {
  return (
    accountPageAtPath(path)?.routeKey ??
    featureAtPath(path)?.id ??
    sections.find((s) => s.href === path)?.key ??
    path.slice(1)
  );
}
export function interaction(
  state: State,
  name: string,
  extra: Record<string, string> = {},
) {
  if (isAdminRoute(location.pathname)) return Promise.resolve();
  if (pagePath !== location.pathname) {
    pagePath = location.pathname;
    pageId = crypto.randomUUID();
  }
  return api<{ accepted: boolean; events: string[] }>(
    '/interactions',
    {
      requestId: crypto.randomUUID(),
      pageId,
      name,
      routeKey: routeKey(),
      observedAt: new Date().toISOString(),
      ...extra,
    },
    state.csrf,
  ).then((result) => {
    confirmed(state, result.events);
    if (
      result.accepted &&
      collectionAvailable(state) &&
      consentChoice(state) === 'granted'
    )
      Demo('event', name);
  });
}
export function rememberBanner(userId: string, banner: Banner | null) {
  sessionStorage.setItem('softek_banner', JSON.stringify({ userId, banner }));
}
export async function restoreBanner(state: State, refreshDocument: boolean) {
  let saved: { userId: string; banner: Banner } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem('softek_banner') ?? 'null');
  } catch {
    sessionStorage.removeItem('softek_banner');
  }
  let banner: Banner | null;
  if (refreshDocument)
    banner = await api<Banner>(
      '/banners/select',
      { requestId: documentId, reason: 'refresh' },
      state.csrf,
    );
  else {
    try {
      banner = await api<Banner | null>(
        '/banners/current' +
          (saved?.userId === state.user.id && saved.banner?.id
            ? '?id=' + saved.banner.id
            : ''),
      );
    } catch {
      banner = await api<Banner | null>('/banners/current');
    }
  }
  rememberBanner(state.user.id, banner);
  return banner;
}
export function ImageBanner({
  state,
  banner,
  compact = false,
}: {
  state: State;
  banner: Banner | null;
  compact?: boolean;
}) {
  const element = useRef<HTMLAnchorElement>(null),
    [loadedUrl, setLoadedUrl] = useState<string | null>(null),
    [failedUrl, setFailedUrl] = useState<string | null>(null);
  const loaded = Boolean(banner?.imageUrl && loadedUrl === banner.imageUrl),
    failed = Boolean(banner?.imageUrl && failedUrl === banner.imageUrl);
  useEffect(() => {
    if (!compact) return;
    setRenderedSummaryBanner(
      state,
      loaded && !failed ? banner : null,
      loaded || failed || !banner?.imageUrl,
    );
    initialize(state);
    return () => {
      clearRenderedSummaryBanner();
    };
  }, [
    compact,
    banner?.id,
    banner?.imageUrl,
    loaded,
    failed,
    state.user.id,
    state.runId,
  ]);
  useEffect(() => {
    if (!element.current || !loaded || failed || !banner?.bannerId) return;
    let timer: ReturnType<typeof setTimeout> | undefined,
      visible = false;
    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      cancel();
      if (visible && document.visibilityState === 'visible')
        timer = setTimeout(() => {
          void interaction(state, 'banner_visible', {
            selectionId: banner.id,
          }).catch(() => {});
        }, 1000);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry && entry.intersectionRatio >= 0.5);
        schedule();
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(element.current);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      cancel();
      observer.disconnect();
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [banner?.id, loaded, failed, state.runId]);
  if (!banner?.imageUrl || failed)
    return compact ? <BannerPlaceholder /> : null;
  return (
    <Link
      ref={element}
      className={
        compact ? 'surface image-banner summary-feature-banner' : 'image-banner'
      }
      data-testid="promotion-banner"
      to={banner.href}
      state={
        featureAtPath(banner.href)
          ? {
              featureEntry: {
                userId: state.user.id,
                runId: state.runId,
                featureId: banner.destination,
                selectionId: banner.id,
                bannerId: banner.bannerId,
              },
            }
          : null
      }
      aria-label={banner.altText}
      onClick={() => {
        void interaction(state, 'banner_clicked', {
          selectionId: banner.id,
        }).catch(() => {});
      }}
    >
      <img
        src={banner.imageUrl}
        alt={banner.altText}
        onLoad={() => setLoadedUrl(banner.imageUrl)}
        onError={() => setFailedUrl(banner.imageUrl)}
        width="1200"
        height="400"
      />
    </Link>
  );
}
export function Placeholder({ title, kind }: { title: string; kind: string }) {
  const [done, setDone] = useState(false);
  const descriptions: Record<string, string> = {
    transfers: 'Move between your everyday accounts.',
    'bill-pay': 'Keep your payments together in one place.',
    cards: 'Manage your cards with a little more confidence.',
    statements: 'Your account documents, easy to find.',
    support: 'A helping hand when you need one.',
  };
  return (
    <section className="surface card reading-width placeholder-page">
      <p className="eyebrow">YOUR HARBOR</p>
      <h2>{descriptions[kind]}</h2>
      <p>Explore {title.toLowerCase()} in this fictional banking experience.</p>
      <p className="small-note">
        This section is a demonstration. Its action does not change your
        accounts or move money.
      </p>
      <button
        className="button"
        onClick={() => {
          setDone(true);
          window.dispatchEvent(
            new CustomEvent('demo-action', { detail: kind }),
          );
        }}
      >
        Try {title.toLowerCase()}
      </button>
      {done && (
        <p className="success" role="status">
          <Check size={18} />
          Demo action completed.
        </p>
      )}
    </section>
  );
}
