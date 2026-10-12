import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Copy, Plus, Upload, ArrowRight } from 'lucide-react';
import { useAdmin } from './admin-session';
import { Card, Alert } from './ui';
import { getFeature } from '../../api/src/features';
import { ClientProfileFields } from './client-profile-fields';
import type { ClientProfile } from '../../api/src/client-profiles';
type User = ClientProfile & {
  id: string;
  username: string;
  displayName: string;
  enabled: boolean;
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

function useResource<T>(path: string) {
  const { request } = useAdmin();
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setData(await request<T>(path));
    setError('');
    setLoading(false);
  }, [path, request]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setData(null);
    setError('');
    request<T>(path)
      .then((value) => {
        if (current) setData(value);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [path, request]);
  const action = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return {
    data,
    loading,
    error,
    notice,
    busy,
    action,
    setError,
    setNotice,
    load,
    request,
  };
}
function Feedback({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      <Alert message={error} />
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
export function Customers() {
  const {
    data: users,
    loading,
    error,
    load,
    setError,
  } = useResource<User[]>('/admin/users');
  const [search, setSearch] = useState('');
  const matching =
    users?.filter((user) =>
      `${user.username} ${user.displayName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ) ?? [];
  return (
    <Card>
      <div className="admin-page-intro">
        <p>
          Manage individual demo logins and their saved banking experiences.
        </p>
        <Link className="button" to="/controls/customers/new">
          <Plus size={17} />
          Create customer
        </Link>
        <Link className="button secondary" to="/controls/customers/generate">
          Generate customers
        </Link>
      </div>
      <Alert message={error} />
      {error && (
        <button
          className="button secondary"
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Try again
        </button>
      )}
      <label>
        Search customers
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Username or display name"
        />
      </label>
      {loading ? (
        <p role="status">Loading customers…</p>
      ) : (
        users && (
          <>
            <p className="small-note">
              {matching.length} customer{matching.length === 1 ? '' : 's'}
            </p>
            {matching.length === 0 ? (
              <p>
                {users.length
                  ? 'No customers match your search.'
                  : 'No customers yet. Create a customer to get started.'}
              </p>
            ) : (
              <div className="customer-list">
                {matching.map((user) => (
                  <Link
                    className="customer-row"
                    key={user.id}
                    to={`/controls/customers/${user.id}`}
                  >
                    <span>
                      <strong>{user.displayName}</strong>
                      <span className="customer-username">{user.username}</span>
                      <span className="small-note">
                        {user.enabled ? 'Enabled' : 'Disabled'} · {user.actor} ·{' '}
                        {user.runId ? 'Has banking state' : 'Not yet signed in'}
                      </span>
                    </span>
                    <ArrowRight size={18} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )
      )}
    </Card>
  );
}
export function CreateCustomer() {
  const { request } = useAdmin(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    setError('');
    try {
      const created = await request<{ id: string }>('/admin/users', {
        username: f.get('username'),
        password: f.get('password'),
        displayName: f.get('displayName'),
        variant: f.get('variant'),
        eligible: f.get('eligible') === 'on',
        actor: f.get('actor'),
        device: f.get('device'),
        browser: f.get('browser'),
      });
      form.reset();
      navigate(`/controls/customers/${created.id}`, {
        state: { created: true },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Link className="text-button" to="/controls/customers">
        Back to customers
      </Link>
      <p>Create a login. Accounts and goals persist until explicitly reset.</p>
      <Alert message={error} />
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
        <ClientProfileFields />
        <button className="button" disabled={busy}>
          <Plus size={16} />
          Create customer
        </button>
      </form>
    </Card>
  );
}
export function CustomerDetails({ created = false }: { created?: boolean }) {
  const { userId } = useParams();
  const {
    data: users,
    loading,
    error,
    notice,
    busy,
    action,
    setError,
    setNotice,
    request,
  } = useResource<User[]>('/admin/users');
  const [activity, setActivity] = useState<
    | {
        name: string;
        routeKey: string;
        createdAt: string;
        actor: string;
        bannerId: string | null;
      }[]
    | null
  >(null);
  const [activityLoading, setActivityLoading] = useState(false);
  useEffect(() => {
    setActivity(null);
    setError('');
    setNotice('');
  }, [userId]);
  const u = users?.find((user) => user.id === userId);
  // The selected record also keys the form subtree so another customer cannot inherit inputs.
  return (
    <Card>
      <Link className="text-button" to="/controls/customers">
        Back to customers
      </Link>
      <Feedback
        error={error}
        notice={notice || (created ? 'Customer created.' : '')}
      />
      {loading ? (
        <p role="status">Loading customer…</p>
      ) : !u ? (
        !error && <p>Customer not found. Choose a customer from the list.</p>
      ) : (
        <div key={u.id} className="admin-user">
          <div>
            <h3>{u.displayName}</h3>
            <p className="small-note">
              {u.username} · {u.enabled ? 'Enabled' : 'Disabled'} · {u.actor} ·{' '}
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
                  .catch(() => setError('Select and copy the displayed ID.'));
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
                    request(`/admin/users/${u.id}/status`, {
                      enabled: !u.enabled,
                    }),
                  u.enabled
                    ? 'Customer disabled; sessions revoked.'
                    : 'Customer enabled.',
                )
              }
            >
              {u.enabled ? 'Disable customer' : 'Enable customer'}
            </button>
            <button
              className="text-button"
              disabled={activityLoading}
              onClick={() => {
                setActivityLoading(true);
                setError('');
                void request<NonNullable<typeof activity>>(
                  `/admin/interactions?userId=${u.id}`,
                )
                  .then(setActivity)
                  .catch((e) => setError(e.message))
                  .finally(() => setActivityLoading(false));
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
                await request(`/admin/users/${u.id}/password`, {
                  password: f.get('password'),
                });
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
          <section aria-label="Automation profile">
            <h3>Device and browser</h3>
            <form
              className="controls-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void action(
                  () =>
                    request(`/admin/users/${u.id}/browser-profile`, {
                      device: data.get('device'),
                      browser: data.get('browser'),
                    }),
                  'Device and browser saved.',
                );
              }}
            >
              <ClientProfileFields
                key={`${u.id}:${u.device}:${u.browser}`}
                initial={u}
              />
              <button className="button secondary" disabled={busy}>
                Save device and browser
              </button>
            </form>
          </section>
          <details>
            <summary>Reset banking state</summary>
            <p className="small-note">
              Starts fresh accounts and goals while retaining this customer's
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
                    request(`/admin/users/${u.id}/reset`, {
                      variant: f.get('variant'),
                      eligible: f.get('eligible') === 'on',
                    }),
                  'Banking state reset.',
                );
              }}
            >
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
        </div>
      )}
      {activityLoading && <p role="status">Loading activity…</p>}
      {activity && activity.length === 0 && (
        <p>No recorded activity for this customer yet.</p>
      )}
      {activity && activity.length > 0 && (
        <details open>
          <summary>Recent customer activity</summary>
          <ul>
            {activity.map((a, i) => (
              <li key={i} className="small-note">
                {new Date(a.createdAt).toLocaleString()} ·{' '}
                {a.name === 'feature_viewed'
                  ? 'Feature viewed'
                  : a.name === 'feature_cta_clicked'
                    ? 'Feature CTA clicked'
                    : a.name}{' '}
                · {getFeature(a.routeKey)?.label ?? a.routeKey} ·{' '}
                {a.bannerId ?? a.actor}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
export function Banners() {
  const { data, loading, error, notice, busy, action, request } = useResource<{
    banners: ConfigBanner[];
    destinations: { key: string; label: string; href: string }[];
  }>('/admin/banners');
  const banners = data?.banners ?? [],
    destinations = data?.destinations ?? [];
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await action(async () => {
      await request('/admin/banners/upload', new FormData(form));
      form.reset();
    }, 'Banner uploaded and enabled.');
  }
  return (
    <div className="admin-revision">
      <Feedback error={error} notice={notice} />
      {loading ? (
        <p role="status">Loading banners…</p>
      ) : (
        data && (
          <>
            <section className="surface card">
              <h2>Banner images</h2>
              <p>
                Enabled banners rotate in order on login and Account Summary
                refresh. Use a 3:1 image, such as 1200 × 400. JPEG, PNG, or
                WebP; up to 5 MiB.
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
                    <img
                      src={b.imageUrl}
                      alt={b.altText}
                      width="1200"
                      height="400"
                    />
                    <form
                      className="controls-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action(
                          () =>
                            request(`/admin/banners/${b.id}/settings`, {
                              title: f.get('title'),
                              altText: f.get('altText'),
                              destination: f.get('destination'),
                              enabled: f.get('enabled') === 'on',
                              sortOrder: Number(f.get('sortOrder')),
                              campaignId:
                                f.get('campaignId') === 'on'
                                  ? 'savings-launch'
                                  : null,
                            }),
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
                        <input
                          type="hidden"
                          name="sortOrder"
                          value={b.sortOrder}
                        />
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
          </>
        )
      )}
    </div>
  );
}
