import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, Route, Routes, useLocation, useParams } from 'react-router';
import {
  ArrowRight,
  Image,
  LockKeyhole,
  LogOut,
  Users,
  ChartNoAxesCombined,
  Activity,
} from 'lucide-react';
import { api, ApiError } from './api';
import { AdminSession, initialReportFilters, useAdmin } from './admin-session';
import {
  Banners,
  CreateCustomer,
  CustomerDetails,
  Customers,
} from './admin-tools';
import { adminSections, adminTitle } from './routes';
import { AppShell } from './shell';
import { Card, Alert } from './ui';
import { ClaritySettings } from './clarity-settings';
import { GenerateCustomers } from './generate-customers';

function CustomerRoute() {
  const { userId } = useParams(),
    location = useLocation();
  return (
    <CustomerDetails key={userId} created={Boolean(location.state?.created)} />
  );
}
function AdminHome() {
  const descriptions = [
    'Create logins, manage access, and inspect individual activity.',
    'Upload artwork, choose destinations, and arrange banner rotation.',
    'Review enrollment and service use with clear participant counts.',
    'Control Microsoft Clarity collection for the customer demo.',
  ];
  const icons = [Users, Image, ChartNoAxesCombined, Activity];
  return (
    <>
      <p className="lead">Manage the Harbor demo.</p>
      <div className="admin-home-grid">
        {adminSections.map((section, i) => {
          const Icon = icons[i]!;
          return (
            <Link
              className="surface card admin-home-link"
              key={section.key}
              to={section.href}
            >
              <span className="icon-circle">
                <Icon size={24} />
              </span>
              <h2>{section.label}</h2>
              <p>{descriptions[i]}</p>
              <span className="text-button">
                Open <ArrowRight size={17} />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
export function AdminApp() {
  const location = useLocation();
  const [csrf, setCsrf] = useState<string | null>(null),
    [checked, setChecked] = useState(false),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [filters, setFilters] = useState(initialReportFilters);
  const check = useCallback(async () => {
    try {
      const status = await api<{ authenticated: boolean; csrf?: string }>(
        '/admin/status',
      );
      setCsrf(status.authenticated ? status.csrf! : null);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecked(true);
    }
  }, []);
  useEffect(() => {
    void check();
  }, [check]);
  const expire = useCallback(() => {
    setCsrf(null);
    setFilters(initialReportFilters);
    setError('Your admin session expired. Sign in again.');
  }, []);
  const request = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      try {
        return await api<T>(
          path,
          body,
          body === undefined ? undefined : (csrf ?? undefined),
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) expire();
        else if (e instanceof ApiError && e.status === 403) {
          try {
            const status = await api<{ authenticated: boolean }>(
              '/admin/status',
            );
            if (!status.authenticated) expire();
          } catch {
            /* Keep the original request error visible. */
          }
        }
        throw e;
      }
    },
    [csrf, expire],
  );
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ csrf: string }>('/admin/login', { password });
      setPassword('');
      setCsrf(result.csrf);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await request('/admin/logout', {});
      setCsrf(null);
      setFilters(initialReportFilters);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      area="Admin"
      title={csrf ? adminTitle(location.pathname) : 'Admin Sign In'}
      authenticated={Boolean(csrf)}
      sections={adminSections}
      actions={
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void logout()}
        >
          <LogOut size={17} />
          Sign out
        </button>
      }
      footer={<a href="/"> · Customer site</a>}
    >
      <Alert message={error} />
      {!checked ? (
        <p role="status">Checking admin access…</p>
      ) : !csrf ? (
        <Card title="Protected admin access" className="reading-width">
          <div className="icon-circle">
            <LockKeyhole size={24} />
          </div>
          <p>Sign in with the demo administrator password.</p>
          <form onSubmit={(e) => void login(e)}>
            <label>
              Admin password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="button" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          {error && (
            <button className="text-button" onClick={() => void check()}>
              Check access again
            </button>
          )}
        </Card>
      ) : (
        <AdminSession.Provider value={{ request, filters, setFilters }}>
          <Routes>
            <Route path="/controls" element={<AdminHome />} />
            <Route path="/controls/customers" element={<Customers />} />
            <Route
              path="/controls/customers/generate"
              element={<GenerateCustomers />}
            />
            <Route
              path="/controls/customers/new"
              element={<CreateCustomer />}
            />
            <Route
              path="/controls/customers/:userId"
              element={<CustomerRoute />}
            />
            <Route path="/controls/banners" element={<Banners />} />
            <Route path="/controls/report" element={<AdoptionReport />} />
            <Route path="/controls/clarity" element={<ClaritySettings />} />
            <Route
              path="*"
              element={
                <Card title="Admin page not found">
                  <Link className="button" to="/controls">
                    Back to Admin Home
                  </Link>
                </Card>
              }
            />
          </Routes>
        </AdminSession.Provider>
      )}
    </AppShell>
  );
}
type Report = {
  filters: { start: string; end: string; cutoff: string };
  totalRuns: number;
  eligibleRuns: number;
  retiredRuns: number;
  actors: { human: number; automation: number };
  eventCount: number;
  reach: { name: string; count: number; denominator: number }[];
  funnel: { name: string; count: number; denominator: number }[];
  serviceUse: {
    enrolled: number;
    firstUse: number;
    repeatUse: number;
    directFirstUse: number;
  };
  placements: { placement: string; visible: number; clicked: number }[];
};
const labels: Record<string, string> = {
  eligible: 'Eligible',
  promotion_visible: 'Promotion visible',
  promotion_clicked: 'Promotion clicked',
  details_viewed: 'Details viewed',
  enrollment_started: 'Enrollment started',
  enrollment_completed: 'Enrolled',
  first_use: 'First use',
  repeat_use: 'Repeat use',
};

type FeatureActivity = {
  features: {
    id: string;
    label: string;
    views: number;
    viewers: number;
    viewedRuns: number;
    clicks: number;
    clickers: number;
    clickedRuns: number;
    bannerViews: number;
    bannerClicks: number;
  }[];
};
function AdoptionReport() {
  const { request, filters, setFilters } = useAdmin();
  const { actor, variant: variantFilter, start, end, cutoff } = filters;
  const setActor = (actor: string) => setFilters({ ...filters, actor });
  const setVariantFilter = (variant: string) =>
    setFilters({ ...filters, variant });
  const setStart = (start: string) => setFilters({ ...filters, start });
  const setEnd = (end: string) => setFilters({ ...filters, end });
  const setCutoff = (cutoff: string) => setFilters({ ...filters, cutoff });
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState<FeatureActivity | null>(null);
  const requestSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const q = new URLSearchParams({ actor, variant: variantFilter });
    setLoading(true);
    setError('');
    setReport(null);
    setActivity(null);
    try {
      for (const [key, value] of Object.entries({ start, end, cutoff }))
        if (value) q.set(key, new Date(value + 'Z').toISOString());
      const [result, featureResult] = await Promise.all([
        request<Report>('/admin/report?' + q),
        request<FeatureActivity>('/admin/feature-activity?' + q),
      ]);
      if (sequence === requestSequence.current) {
        setReport(result);
        setActivity(featureResult);
      }
    } catch (e) {
      if (sequence === requestSequence.current) setError((e as Error).message);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [request, actor, variantFilter, start, end, cutoff]);
  useEffect(() => {
    void load();
    return () => {
      requestSequence.current++;
    };
  }, [load]);
  return (
    <>
      <Alert message={error} />
      {loading && <p role="status">Loading report…</p>}
      <Card title="Savings Goals adoption">
        <p>
          One institution · Savings goals · Savings launch campaign. Counts
          represent distinct participant runs, including retired runs.
        </p>
        <div className="report-filters">
          <label>
            Activity
            <select value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="human">Human</option>
              <option value="automation">Automated journeys</option>
              <option value="all">All activity</option>
            </select>
          </label>
          <label>
            Variant
            <select
              value={variantFilter}
              onChange={(e) => setVariantFilter(e.target.value)}
            >
              <option value="all">All variants</option>
              <option value="baseline">Baseline</option>
              <option value="value">Value</option>
            </select>
          </label>
          <label>
            Runs started after (UTC)
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Runs started before (UTC)
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label>
            Observe through (UTC)
            <input
              type="datetime-local"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
            />
          </label>
          <button className="button secondary" onClick={() => void load()}>
            Refresh report
          </button>
        </div>
        {report && (
          <>
            <div className="metrics">
              <div>
                <strong>{report.totalRuns}</strong>
                <span>Total runs</span>
              </div>
              <div>
                <strong>{report.eligibleRuns}</strong>
                <span>Eligible denominator</span>
              </div>
              <div>
                <strong>{report.retiredRuns}</strong>
                <span>Retired runs</span>
              </div>
              <div>
                <strong>
                  {report.actors.human} / {report.actors.automation}
                </strong>
                <span>Human / automated</span>
              </div>
            </div>
            <p className="small-note">
              UTC cohort: {new Date(report.filters.start).toISOString()} through{' '}
              {new Date(report.filters.end).toISOString()}. Observation cutoff:{' '}
              {new Date(report.filters.cutoff).toISOString()}.
            </p>
            <h3>Ordered adoption funnel</h3>
            <p className="small-note">
              Each stage requires all previous stages in order. Conversion uses
              the previous qualifying stage as its denominator.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Runs</th>
                    <th>Previous stage</th>
                    <th>Conversion</th>
                    <th>All eligible reach</th>
                  </tr>
                </thead>
                <tbody>
                  {report.funnel.map((row, i) => (
                    <tr key={row.name}>
                      <th>{labels[row.name]}</th>
                      <td>{row.count}</td>
                      <td>{row.denominator}</td>
                      <td>
                        {row.denominator
                          ? Math.round((row.count / row.denominator) * 100) +
                            '%'
                          : '—'}
                      </td>
                      <td>
                        {report.reach[i]?.count} / {report.eligibleRuns}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Service use, including direct entry</h3>
            <p>
              Enrolled: {report.serviceUse.enrolled} · First use:{' '}
              {report.serviceUse.firstUse} · Repeat on a later visit:{' '}
              {report.serviceUse.repeatUse} · First use without a prior
              promotion click: {report.serviceUse.directFirstUse}
            </p>
            <div className="placement-summary">
              {report.placements.map((p) => (
                <p key={p.placement}>
                  <strong>
                    {p.placement === 'sidebar'
                      ? 'Sidebar / mobile inline'
                      : 'Banner'}
                  </strong>
                  <br />
                  {p.visible} visible · {p.clicked} clicked
                </p>
              ))}
            </div>
            <p className="small-note">
              Exposure requires at least 50% visibility for one continuous
              second in an active tab. Browser observations indicate behavior;
              enrollment and use are confirmed by the server.{' '}
              {report.eventCount} structured events in this selection.
            </p>
          </>
        )}
      </Card>
      {activity && (
        <Card title="Feature Activity">
          <p className="small-note">
            Admin impersonation activity is excluded. Runs entered only by an
            admin join customer counts after a customer visit; original
            run-start dates still apply.
          </p>
          <p>
            Landing views and CTA clicks are demo engagement observations. They
            do not represent enrollment or service adoption. Counts include
            retained banking runs and use the filters above.
          </p>
          <div className="table-scroll">
            <table data-testid="feature-activity">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Landing views</th>
                  <th>Viewers</th>
                  <th>Viewed runs</th>
                  <th>CTA clicks</th>
                  <th>Customers clicked</th>
                  <th>Clicked runs</th>
                </tr>
              </thead>
              <tbody>
                {activity.features.map((f) => (
                  <tr key={f.id} data-feature={f.id}>
                    <th>{f.label}</th>
                    <td>
                      {f.views}
                      <span className="small-note">
                        {f.bannerViews} from banners
                      </span>
                    </td>
                    <td>{f.viewers}</td>
                    <td>{f.viewedRuns}</td>
                    <td>
                      {f.clicks}
                      <span className="small-note">
                        {f.bannerClicks} from banners
                      </span>
                    </td>
                    <td>{f.clickers}</td>
                    <td>{f.clickedRuns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small-note">
            Landing views and CTA clicks count recorded events. Viewers and
            customers clicked count distinct demo customers; run columns count
            distinct banking runs. Ordinary page views are not added to landing
            views.
          </p>
        </Card>
      )}
    </>
  );
}
