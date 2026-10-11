import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Check, Copy, Plus, Upload } from 'lucide-react';
import { api, type State } from './api';
import { confirmed, collectionAvailable } from './analytics';

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
  return sections.find((s) => s.href === path)?.key ?? path.slice(1);
}
export function interaction(
  state: State,
  name: string,
  extra: Record<string, string> = {},
) {
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
      sessionStorage.getItem('softek_analytics_consent') === 'granted'
    )
      window.clarity?.('event', name);
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
}: {
  state: State;
  banner: Banner | null;
}) {
  const element = useRef<HTMLAnchorElement>(null),
    [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [banner?.id]);
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
  if (!banner?.imageUrl || failed) return null;
  return (
    <Link
      ref={element}
      className="image-banner"
      data-testid="promotion-banner"
      to={banner.href}
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
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
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

type User = {
  id: string;
  username: string;
  displayName: string;
  enabled: boolean;
  profileId: string;
  variant: string;
  eligible: boolean;
  actor: string;
  runId: string | null;
};
type ConfigBanner = {
  id: string;
  title: string;
  altText: string;
  destination: string;
  enabled: boolean;
  sortOrder: number;
  campaignId: string | null;
  imageUrl: string;
};
export function RevisionControls({
  csrf,
  onChanged,
}: {
  csrf: string;
  onChanged: () => Promise<void>;
}) {
  const [users, setUsers] = useState<User[]>([]),
    [banners, setBanners] = useState<ConfigBanner[]>([]),
    [destinations, setDestinations] = useState<
      { key: string; label: string; href: string }[]
    >([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<
    {
      name: string;
      routeKey: string;
      createdAt: string;
      actor: string;
      bannerId: string | null;
    }[]
  >([]);
  const load = async () => {
    const [u, b] = await Promise.all([
      api<User[]>('/admin/users'),
      api<{ banners: ConfigBanner[]; destinations: typeof destinations }>(
        '/admin/banners',
      ),
    ]);
    setUsers(u);
    setBanners(b.banners);
    setDestinations(b.destinations);
  };
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  const action = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      await onChanged();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    await action(async () => {
      await api(
        '/admin/users',
        {
          username: f.get('username'),
          password: f.get('password'),
          displayName: f.get('displayName'),
          profileId: f.get('profileId'),
          variant: f.get('variant'),
          eligible: f.get('eligible') === 'on',
          actor: f.get('actor'),
        },
        csrf,
      );
      form.reset();
    }, 'Demo user created.');
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await action(async () => {
      await api('/admin/banners/upload', new FormData(form), csrf);
      form.reset();
    }, 'Banner uploaded and enabled.');
  }
  return (
    <div className="admin-revision">
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <section className="surface card">
        <h2>Demo users</h2>
        <p>
          Create individual logins. Their accounts and goals persist until you
          explicitly reset them.
        </p>
        <form className="controls-form" onSubmit={createUser}>
          <label>
            Username
            <input
              name="username"
              required
              minLength={3}
              maxLength={40}
              pattern={'[A-Za-z0-9._@+\\-]+'}
              title="Use letters, numbers, dots, underscores, hyphens, @ or +."
              aria-describedby="create-username-hint"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <p
            id="create-username-hint"
            className="small-note"
            style={{ gridColumn: '1 / -1' }}
          >
            Usernames or email addresses, 3–40 characters. Use letters, numbers,
            dots, underscores, hyphens, @ or +.
          </p>
          <label>
            Display name
            <input name="displayName" required maxLength={100} />
          </label>
          <label>
            Initial password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              aria-describedby="create-password-hint"
            />
          </label>
          <p
            id="create-password-hint"
            className="small-note"
            style={{ gridColumn: '1 / -1' }}
          >
            Choose an initial password with 8–128 characters.
          </p>
          <label>
            Starting accounts
            <select name="profileId">
              <option value="alex">Alex · eligible template</option>
              <option value="jamie">Jamie · standard template</option>
            </select>
          </label>
          <label>
            Campaign variant
            <select name="variant">
              <option value="value">Value</option>
              <option value="baseline">Baseline</option>
            </select>
          </label>
          <label>
            Activity mode
            <select name="actor">
              <option value="human">Human walkthrough</option>
              <option value="automation">Trusted automation only</option>
            </select>
          </label>
          <label className="checkbox-field">
            <input name="eligible" type="checkbox" defaultChecked />
            Eligible for savings goals
          </label>
          <button className="button" disabled={busy}>
            <Plus size={16} />
            Create user
          </button>
        </form>
        <div className="user-list">
          {users.map((u) => (
            <section className="admin-user" key={u.id}>
              <div>
                <h3>{u.displayName}</h3>
                <p className="small-note">
                  {u.username} · {u.enabled ? 'Enabled' : 'Disabled'} ·{' '}
                  {u.actor} ·{' '}
                  {u.runId ? 'Has banking state' : 'Not yet signed in'}
                </p>
                <code className="lookup-id">{u.id}</code>
              </div>
              <div className="form-actions">
                <button
                  className="text-button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(u.id)
                      .then(() => setNotice('Clarity lookup ID copied.'))
                      .catch(() =>
                        setError('Select and copy the displayed ID.'),
                      );
                  }}
                >
                  <Copy size={16} />
                  Copy Clarity ID
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      () =>
                        api(
                          `/admin/users/${u.id}/status`,
                          { enabled: !u.enabled },
                          csrf,
                        ),
                      u.enabled
                        ? 'User disabled; sessions revoked.'
                        : 'User enabled.',
                    )
                  }
                >
                  {u.enabled ? 'Disable user' : 'Enable user'}
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    void api<typeof activity>(
                      `/admin/interactions?userId=${u.id}`,
                    )
                      .then(setActivity)
                      .catch((e) => setError(e.message));
                  }}
                >
                  View activity
                </button>
              </div>
              <form
                className="password-reset"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  void action(async () => {
                    await api(
                      `/admin/users/${u.id}/password`,
                      { password: f.get('password') },
                      csrf,
                    );
                    form.reset();
                  }, 'Password replaced; all user sessions revoked.');
                }}
              >
                <label>
                  New password for {u.username}
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </label>
                <button className="button secondary" disabled={busy}>
                  Reset password
                </button>
              </form>
              <details>
                <summary>Reset banking state</summary>
                <p className="small-note">
                  Starts fresh accounts and goals while retaining this user's
                  identity and previous report history.
                </p>
                <form
                  className="controls-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      !window.confirm(
                        `Reset banking state for ${u.username}? Previous history will be retained.`,
                      )
                    )
                      return;
                    void action(
                      () =>
                        api(
                          `/admin/users/${u.id}/reset`,
                          {
                            profileId: f.get('profileId'),
                            variant: f.get('variant'),
                            eligible: f.get('eligible') === 'on',
                          },
                          csrf,
                        ),
                      'Banking state reset.',
                    );
                  }}
                >
                  <label>
                    Starting accounts
                    <select name="profileId" defaultValue={u.profileId}>
                      <option value="alex">Alex</option>
                      <option value="jamie">Jamie</option>
                    </select>
                  </label>
                  <label>
                    Campaign variant
                    <select name="variant" defaultValue={u.variant}>
                      <option value="value">Value</option>
                      <option value="baseline">Baseline</option>
                    </select>
                  </label>
                  <label className="checkbox-field">
                    <input
                      name="eligible"
                      type="checkbox"
                      defaultChecked={u.eligible}
                    />
                    Eligible for savings goals
                  </label>
                  <button className="button secondary" disabled={busy}>
                    Reset banking state
                  </button>
                </form>
              </details>
            </section>
          ))}
        </div>
        {activity.length > 0 && (
          <details open>
            <summary>Recent user activity</summary>
            <ul>
              {activity.map((a, i) => (
                <li key={i} className="small-note">
                  {new Date(a.createdAt).toLocaleString()} · {a.name} ·{' '}
                  {a.routeKey} · {a.bannerId ?? a.actor}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section className="surface card">
        <h2>Banner images</h2>
        <p>
          Enabled banners rotate in order on login and Account Summary refresh.
          Use a 3:1 image, such as 1200 × 400. JPEG, PNG, or WebP; up to 5 MiB.
        </p>
        <form className="controls-form" onSubmit={upload}>
          <label>
            Image
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <label>
            Banner title
            <input name="title" required maxLength={100} />
          </label>
          <label>
            Accessible link text
            <input name="altText" required maxLength={180} />
          </label>
          <label>
            Destination
            <select name="destination">
              {destinations.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Display order
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={10000}
              defaultValue={banners.length}
              required
            />
          </label>
          <button className="button" disabled={busy}>
            <Upload size={16} />
            Upload banner
          </button>
        </form>
        <div className="banner-admin-list">
          {banners.map((b) => (
            <section className="admin-banner" key={b.id}>
              <img src={b.imageUrl} alt={b.altText} width="1200" height="400" />
              <form
                className="controls-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action(
                    () =>
                      api(
                        `/admin/banners/${b.id}/settings`,
                        {
                          title: f.get('title'),
                          altText: f.get('altText'),
                          destination: f.get('destination'),
                          enabled: f.get('enabled') === 'on',
                          sortOrder: Number(f.get('sortOrder')),
                          campaignId:
                            f.get('campaignId') === 'on'
                              ? 'savings-launch'
                              : null,
                        },
                        csrf,
                      ),
                    'Banner settings saved.',
                  );
                }}
              >
                <label>
                  Title
                  <input
                    name="title"
                    required
                    maxLength={100}
                    defaultValue={b.title}
                  />
                </label>
                <label>
                  Link text
                  <input
                    name="altText"
                    required
                    maxLength={180}
                    defaultValue={b.altText}
                  />
                </label>
                <label>
                  Internal destination
                  <select name="destination" defaultValue={b.destination}>
                    {destinations.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Order
                  <input
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={10000}
                    defaultValue={b.sortOrder}
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={b.enabled}
                  />
                  Enabled
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    name="campaignId"
                    defaultChecked={b.campaignId === 'savings-launch'}
                  />
                  Include in savings campaign
                </label>
                <button className="button secondary" disabled={busy}>
                  Save banner
                </button>
              </form>
              <details>
                <summary>Replace image</summary>
                <form onSubmit={upload}>
                  <input type="hidden" name="replaceId" value={b.id} />
                  <input type="hidden" name="title" value={b.title} />
                  <input type="hidden" name="altText" value={b.altText} />
                  <input
                    type="hidden"
                    name="destination"
                    value={b.destination}
                  />
                  <input type="hidden" name="sortOrder" value={b.sortOrder} />
                  <label>
                    Replacement image
                    <input
                      type="file"
                      name="image"
                      accept="image/jpeg,image/png,image/webp"
                      required
                    />
                  </label>
                  <button className="button secondary" disabled={busy}>
                    Replace image
                  </button>
                </form>
              </details>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
