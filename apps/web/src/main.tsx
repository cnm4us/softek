import {
  StrictMode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from 'react-router';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CreditCard,
  Landmark,
  Leaf,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sprout,
  Target,
  Wallet,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { api, ApiError, minor, money, type State } from './api';
import {
  chooseConsent,
  collectionAvailable,
  confirmed,
  initialize,
  observe,
} from './analytics';
import {
  ImageBanner,
  Placeholder,
  RevisionControls,
  sections,
  interaction,
  rememberBanner,
  restoreBanner,
  type Banner,
} from './revision';
import './theme.css';

type Context = {
  state: State | null;
  banner: Banner | null;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
};
const Demo = createContext<Context>({
  state: null,
  banner: null,
  refresh: async () => {},
  login: async () => {},
});
const useDemo = () => useContext(Demo);
function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface card ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
function Alert({ message }: { message: string }) {
  return message ? (
    <p className="alert" role="alert">
      {message}
    </p>
  ) : null;
}
function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="feature-title">{title}</h2>
      {children && <p className="lead">{children}</p>}
    </div>
  );
}
function Entry() {
  const { login } = useDemo();
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      setPassword('');
    } catch (e) {
      setError((e as Error).message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <div className="login-welcome">
        <div className="login-orbit" aria-hidden="true">
          <Leaf size={48} />
        </div>
        <p className="eyebrow">A LITTLE MORE POSSIBILITY</p>
        <h1>Welcome to Harbor.</h1>
        <p>Your everyday, with room to grow.</p>
      </div>
      <section className="surface card login-card">
        <div className="login-caption">
          <LockKeyhole size={18} />
          <h2>Sign in to your account</h2>
        </div>
        <form onSubmit={submit} data-clarity-mask="true">
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={40}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <Alert message={error} />
          <button className="button" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="small-note">
          Use the demo login provided by your administrator.
        </p>
      </section>
    </div>
  );
}
function Promotion({ placement }: { placement: 'banner' | 'sidebar' }) {
  const { state } = useDemo();
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!state?.eligible || state.enrolled || !element.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ratio = 0,
      sent = false;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const update = () => {
      clear();
      if (!sent && ratio >= 0.5 && document.visibilityState === 'visible')
        timer = setTimeout(() => {
          if (ratio >= 0.5 && document.visibilityState === 'visible') {
            sent = true;
            void observe(state, 'promotion_visible', placement).catch(() => {
              sent = false;
            });
          }
        }, 1000);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        ratio = entries[0]?.intersectionRatio ?? 0;
        update();
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(element.current);
    document.addEventListener('visibilitychange', update);
    return () => {
      clear();
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [state?.runId, state?.enrolled, placement]);
  if (!state?.eligible || state.enrolled) return null;
  const value = state.variant === 'value';
  return (
    <section
      ref={element}
      data-testid={`promotion-${placement}`}
      className={`promotion promotion-${placement}`}
      aria-label="Savings goals promotion"
    >
      <div className="promo-symbol" aria-hidden="true">
        <Sprout size={placement === 'banner' ? 36 : 30} />
      </div>
      <div>
        <p className="eyebrow">A LITTLE TODAY. MORE TOMORROW.</p>
        <h2>
          {value
            ? 'Build a cushion at your own pace.'
            : 'Make room for what’s next.'}
        </h2>
        <p>
          {value
            ? 'Give your savings a purpose. Create a goal and watch each small step add up.'
            : 'A weekend away. A rainy-day fund. Bring your next goal a little closer.'}
        </p>
        <Link
          className="promo-link"
          to="/savings-goals"
          onClick={() => {
            void observe(state, 'promotion_clicked', placement).catch(() => {});
          }}
        >
          Explore savings goals <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}
function Overview() {
  const { state, banner } = useDemo();
  if (!state) return <Entry />;
  return (
    <>
      <ImageBanner state={state} banner={banner} />
      <section
        aria-label="Account balances"
        className="accounts-grid"
        data-clarity-mask="true"
      >
        {state.accounts.map((a) => (
          <Card
            key={a.id}
            className={`account-card ${a.kind === 'checking' ? 'account-primary' : ''}`}
          >
            <div className="account-label">
              <span>{a.name}</span>
              {a.kind === 'credit' ? (
                <CreditCard size={20} />
              ) : (
                <Wallet size={20} />
              )}
            </div>
            <p className="account-number">•••• {a.lastFour}</p>
            <strong className="account-balance">
              {money(a.kind === 'credit' ? -a.balanceMinor : a.balanceMinor)}
            </strong>
            <span className="balance-label">
              {a.kind === 'credit'
                ? 'Current amount owed'
                : 'Available balance'}
            </span>
          </Card>
        ))}
      </section>
      <div className="dashboard-grid">
        <Card title="Recent activity">
          <div className="section-caption">Your latest account movements</div>
          <div className="activity" data-clarity-mask="true">
            {state.transactions.map((t) => (
              <div className="transaction" key={t.id}>
                <div className="transaction-icon">
                  <ArrowUpRight size={18} />
                </div>
                <div>
                  <strong>{t.description}</strong>
                  <small>
                    {t.accountName} ·{' '}
                    {new Date(t.occurredAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </small>
                </div>
                <span className={t.amountMinor > 0 ? 'positive' : ''}>
                  {t.amountMinor > 0 ? '+' : ''}
                  {money(t.amountMinor)}
                </span>
              </div>
            ))}
          </div>
          <p className="small-note">All activity shown is fictional.</p>
        </Card>
        <div className="side-column">
          <Promotion placement="sidebar" />
          {state.enrolled ? (
            <Card title="Your goals">
              <div className="icon-circle">
                <Target size={24} />
              </div>
              <p>
                {state.goals.length
                  ? `${state.goals.length} ${state.goals.length === 1 ? 'goal' : 'goals'}, one step at a time.`
                  : 'You’re ready for your first savings goal.'}
              </p>
              <Link className="button" to="/goals">
                View savings goals <ArrowRight size={17} />
              </Link>
            </Card>
          ) : !state.eligible ? (
            <Card title="Banking that fits your day">
              <div className="icon-circle">
                <Leaf size={24} />
              </div>
              <p>
                Keep an eye on your balances and recent activity, all in one
                place.
              </p>
            </Card>
          ) : (
            <Card title="A steady place to grow">
              <div className="icon-circle">
                <ShieldCheck size={24} />
              </div>
              <p>Your everyday banking and your next big idea, together.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
function Details() {
  const { state } = useDemo();
  useEffect(() => {
    if (state?.eligible) void observe(state, 'details_viewed').catch(() => {});
  }, [state?.runId]);
  if (!state) return <Entry />;
  return (
    <div className="reading-width">
      <Link className="back-link" to="/">
        ← Account overview
      </Link>
      <div className="feature-icon">
        <Sprout size={34} />
      </div>
      <Heading
        eyebrow="HARBOR SAVINGS GOALS"
        title="Something to look forward to."
      >
        Turn “someday” into a plan. A small step today can help you get there.
      </Heading>
      <Card>
        <h2>A purpose for every bit you save.</h2>
        <div className="benefits">
          <div>
            <span className="icon-circle">
              <Target size={22} />
            </span>
            <div>
              <h3>Make it yours</h3>
              <p>Name your goal and choose an amount that feels right.</p>
            </div>
          </div>
          <div>
            <span className="icon-circle">
              <Plus size={22} />
            </span>
            <div>
              <h3>Grow at your pace</h3>
              <p>
                Move fictional funds from checking into your Harbor savings.
              </p>
            </div>
          </div>
          <div>
            <span className="icon-circle">
              <Check size={22} />
            </span>
            <div>
              <h3>See how far you’ve come</h3>
              <p>
                Track progress and return whenever you’re ready for the next
                step.
              </p>
            </div>
          </div>
        </div>
        <div className="terms-note">
          <strong>Simple to start. No demo fees.</strong>
          <p>
            Goals track new contributions to savings. Your existing savings
            balance stays available; creating a goal doesn’t move money.
          </p>
        </div>
        {state.eligible ? (
          <Link className="button" to={state.enrolled ? '/goals' : '/enroll'}>
            {state.enrolled ? 'View my goals' : 'Get started'}{' '}
            <ArrowRight size={17} />
          </Link>
        ) : (
          <p className="status">
            Savings goals isn’t available for this demo profile.
          </p>
        )}
      </Card>
    </div>
  );
}
function Enrollment() {
  const { state, refresh } = useDemo();
  const navigate = useNavigate();
  const [step, setStep] = useState(1),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    if (state?.eligible && !state.enrolled)
      void observe(state, 'enrollment_started').catch(() => {});
  }, [state?.runId]);
  if (!state) return <Entry />;
  if (state.enrolled) return <Goals />;
  if (!state.eligible) return <Details />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!state || !accepted) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ events: string[] }>(
        '/enroll',
        { requestId: requestId.current, accepted: true },
        state.csrf,
      );
      confirmed(state, result.events);
      await refresh();
      navigate('/goals', { state: { enrolled: true } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="reading-width">
      <Link className="back-link" to="/savings-goals">
        ← Savings goals
      </Link>
      <Heading
        eyebrow="LET’S GET YOU STARTED"
        title="A little closer to your goal."
      />
      <Card>
        <div className="steps" aria-label={`Step ${step} of 2`}>
          <span className={step === 1 ? 'current' : ''}>1 · How it works</span>
          <span className={step === 2 ? 'current' : ''}>2 · Confirm</span>
        </div>
        {step === 1 ? (
          <>
            <h2>You set the destination.</h2>
            <p>
              Create up to 10 goals. Choose a target, then add fictional money
              from checking whenever you like. Each contribution increases
              savings and decreases checking by the same amount.
            </p>
            <p>There’s no automatic transfer and no real money involved.</p>
            <button className="button" onClick={() => setStep(2)}>
              Continue <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            <h2>Ready when you are.</h2>
            <p>
              Enabling savings goals adds goal tracking to your fictional Harbor
              savings account. You can start over using Reset my demo.
            </p>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              I understand this is a fictional service with simulated funds.
            </label>
            <Alert message={error} />
            <div className="form-actions">
              <button className="button" disabled={!accepted || busy}>
                {busy ? 'Enabling…' : 'Enable savings goals'}
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setStep(1)}
                disabled={busy}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
function Goals() {
  const { state, refresh } = useDemo();
  const location = useLocation();
  const [title, setTitle] = useState(''),
    [target, setTarget] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(
      location.state?.enrolled
        ? 'Savings goals is ready. Create your first goal below.'
        : '',
    );
  const request = useRef<{ id: string; payload: string } | null>(null);
  if (!state) return <Entry />;
  if (!state.enrolled) return <Details />;
  async function create(e: FormEvent) {
    e.preventDefault();
    if (!state) return;
    const targetMinor = minor(target);
    if (!targetMinor || targetMinor < 100 || targetMinor > 100_000_000) {
      setError(
        'Enter a goal between $1 and $1,000,000, with up to two decimal places.',
      );
      return;
    }
    const payload = JSON.stringify({ title: title.trim(), targetMinor });
    if (!request.current || request.current.payload !== payload)
      request.current = { id: crypto.randomUUID(), payload };
    setBusy(true);
    setError('');
    try {
      const result = await api<{ events: string[] }>(
        '/goals',
        { requestId: request.current.id, title: title.trim(), targetMinor },
        state.csrf,
      );
      confirmed(state, result.events);
      await refresh();
      setTitle('');
      setTarget('');
      request.current = null;
      setSuccess(
        'Your new goal is ready. Add a contribution whenever you like.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading eyebrow="ONE STEP AT A TIME" title="Your savings goals.">
        A little progress today. Something to look forward to tomorrow.
      </Heading>
      {success && (
        <p className="success" role="status">
          <Check size={18} />
          {success}
        </p>
      )}
      <div className="goals-layout">
        <div className="goals-list">
          {!state.goals.length ? (
            <Card title="What are you saving for?">
              <div className="icon-circle">
                <Sprout size={26} />
              </div>
              <p>
                A rainy-day cushion, a getaway, a fresh start. Give it a name
                and take the first step.
              </p>
            </Card>
          ) : (
            state.goals.map((g) => <GoalCard key={g.id} goal={g} />)
          )}
        </div>
        <Card title="Create a goal">
          <form onSubmit={(e) => void create(e)} data-clarity-mask="true">
            <label>
              Goal name
              <input
                required
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A weekend away"
              />
            </label>
            <label>
              Target amount ($)
              <input
                required
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="500.00"
              />
            </label>
            <p className="small-note">
              Creating a goal doesn’t move money. Only new contributions count
              toward its progress.
            </p>
            <Alert message={error} />
            <button className="button" disabled={busy}>
              {busy ? 'Creating…' : 'Create goal'} <Plus size={17} />
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
function GoalCard({ goal }: { goal: State['goals'][number] }) {
  const { state, refresh } = useDemo();
  const [amount, setAmount] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  const request = useRef<{ id: string; amount: number } | null>(null);
  async function contribute(e: FormEvent) {
    e.preventDefault();
    if (!state) return;
    const amountMinor = minor(amount);
    if (!amountMinor) {
      setError('Enter a positive amount with up to two decimal places.');
      return;
    }
    if (!request.current || request.current.amount !== amountMinor)
      request.current = { id: crypto.randomUUID(), amount: amountMinor };
    setBusy(true);
    setError('');
    try {
      const result = await api<{ events: string[] }>(
        '/goals/' + goal.id + '/contributions',
        { requestId: request.current.id, amountMinor },
        state.csrf,
      );
      confirmed(state, result.events);
      await refresh();
      request.current = null;
      setAmount('');
      setSuccess(`${money(amountMinor)} added to your goal.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="goal-card">
      <div data-clarity-mask="true">
        <div className="goal-heading">
          <span className="icon-circle">
            <Target size={24} />
          </span>
          <h2>{goal.title}</h2>
        </div>
        <div className="goal-amount">
          <strong>{money(goal.currentMinor)}</strong>
          <span>of {money(goal.targetMinor)}</span>
        </div>
        <progress
          value={goal.currentMinor}
          max={goal.targetMinor}
          aria-label="Savings goal progress"
        />
        <p className="small-note">
          {Math.round((goal.currentMinor / goal.targetMinor) * 100)}% of the way
          there
        </p>
        {goal.currentMinor === goal.targetMinor ? (
          <p className="success">
            <Check size={18} />
            You reached your goal.
          </p>
        ) : (
          <form onSubmit={(e) => void contribute(e)}>
            <label>
              Contribution from checking ($)
              <input
                required
                inputMode="decimal"
                placeholder="25.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <p className="small-note">
              Checking available:{' '}
              {money(
                state?.accounts.find((a) => a.kind === 'checking')
                  ?.balanceMinor ?? 0,
              )}
              . Funds move into Harbor savings.
            </p>
            <Alert message={error} />
            {success && (
              <p className="success" role="status">
                {success}
              </p>
            )}
            <button className="button secondary" disabled={busy}>
              {busy ? 'Adding…' : 'Add contribution'} <ArrowRight size={17} />
            </button>
          </form>
        )}
      </div>
    </Card>
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
function Controls() {
  const { state, refresh } = useDemo();
  const [auth, setAuth] = useState<string | null>(null),
    [checked, setChecked] = useState(false),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState<Report | null>(null);
  const [actor, setActor] = useState('human'),
    [variantFilter, setVariantFilter] = useState('all'),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [cutoff, setCutoff] = useState('');
  useEffect(() => {
    void api<{ authenticated: boolean; csrf?: string }>('/admin/status')
      .then((s) => setAuth(s.csrf ?? null))
      .catch((e) => setError(e.message))
      .finally(() => setChecked(true));
  }, []);
  const load = useCallback(async () => {
    const q = new URLSearchParams({ actor, variant: variantFilter });
    for (const [key, value] of Object.entries({ start, end, cutoff }))
      if (value) q.set(key, new Date(value + 'Z').toISOString());
    setError('');
    try {
      setReport(await api<Report>('/admin/report?' + q));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [actor, variantFilter, start, end, cutoff]);
  useEffect(() => {
    if (auth) void load();
  }, [auth, load]);
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ csrf: string }>('/admin/login', { password });
      setPassword('');
      setAuth(result.csrf);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!checked) return <p role="status">Loading demo controls…</p>;
  return (
    <div data-clarity-mask="true">
      <Heading
        eyebrow="DEMONSTRATION WORKSPACE"
        title="Demo controls & reporting."
      />
      {!auth ? (
        <Card title="Protected demo controls" className="reading-width">
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
            <Alert message={error} />
            <button className="button" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </Card>
      ) : (
        <>
          <div className="controls-top">
            <p className="small-note">
              Current profile: {state?.profile.name ?? 'No active demo'}.
              Changes start a new independent run and preserve the previous
              history.
            </p>
            <button
              className="text-button"
              onClick={() => {
                void api('/admin/logout', {}, auth)
                  .then(() => {
                    setAuth(null);
                    setReport(null);
                  })
                  .catch((e) => setError(e.message));
              }}
            >
              Sign out
            </button>
          </div>
          <Alert message={error} />
          <RevisionControls csrf={auth} onChanged={refresh} />
          <Card title="Adoption report">
            <p>
              One institution · Savings goals · Savings launch campaign. Counts
              represent distinct participant runs, including retired runs.
            </p>
            <div className="report-filters">
              <label>
                Activity
                <select
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                >
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
                  UTC cohort: {new Date(report.filters.start).toISOString()}{' '}
                  through {new Date(report.filters.end).toISOString()}.
                  Observation cutoff:{' '}
                  {new Date(report.filters.cutoff).toISOString()}.
                </p>
                <h3>Ordered adoption funnel</h3>
                <p className="small-note">
                  Each stage requires all previous stages in order. Conversion
                  uses the previous qualifying stage as its denominator.
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
                              ? Math.round(
                                  (row.count / row.denominator) * 100,
                                ) + '%'
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
                  second in an active tab. Browser observations indicate
                  behavior; enrollment and use are confirmed by the server.{' '}
                  {report.eventCount} structured events in this selection.
                </p>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
function About() {
  return (
    <div className="reading-width">
      <Heading
        eyebrow="A FICTIONAL BANKING EXPERIENCE"
        title="A place to explore."
      />
      <Card>
        <p>
          Harbor Community Bank is a fictional institution. Explore account
          information, discover savings goals, and try a goal with invented
          data.
        </p>
        <p>
          Every participant gets an independent copy of the accounts. Reset
          starts a fresh experience while retaining the previous run for the
          demonstration report.
        </p>
        <p>No real money moves, and no live bank accounts are connected.</p>
        <Link className="button" to="/">
          Back to overview <ArrowRight size={17} />
        </Link>
      </Card>
    </div>
  );
}
function AnalyticsChoice() {
  const { state, banner } = useDemo();
  const location = useLocation();
  const [choice, setChoice] = useState(
    sessionStorage.getItem('softek_analytics_consent'),
  );
  useEffect(() => {
    if (state) {
      initialize(state);
      if (
        collectionAvailable(state) &&
        sessionStorage.getItem('softek_analytics_consent') === 'granted'
      )
        window.clarity?.('set', 'banner', banner?.bannerId ?? 'none');
    }
  }, [state?.runId, state?.visitId, location.pathname, banner?.id]);
  if (!state || !collectionAvailable(state)) return null;
  return (
    <aside className="analytics-choice" aria-label="Experience analytics">
      <p>
        {choice === 'granted'
          ? 'Experience analytics is enabled for this browser session.'
          : 'Help us understand this demo with Microsoft Clarity? Account details and form contents are masked.'}
      </p>
      {!choice && (
        <button
          className="button"
          onClick={() => {
            chooseConsent(state, true);
            setChoice('granted');
          }}
        >
          Allow analytics
        </button>
      )}
      <button
        className="text-button"
        onClick={() => {
          chooseConsent(state, false);
          setChoice('denied');
        }}
      >
        {choice === 'granted' ? 'Turn off analytics' : 'Keep analytics off'}
      </button>
    </aside>
  );
}
const initialSummaryDocument = location.pathname === '/';
let bootstrap: Promise<{ state: State; banner: Banner | null }> | undefined;
function App() {
  const [state, setState] = useState<State | null>(null),
    [banner, setBanner] = useState<Banner | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [menuOpen, setMenuOpen] = useState(false),
    [resetting, setResetting] = useState(false);
  const navigate = useNavigate(),
    location = useLocation(),
    menuButton = useRef<HTMLButtonElement>(null),
    menuPanel = useRef<HTMLElement>(null);
  const closeMenu = () => {
    setMenuOpen(false);
    menuButton.current?.focus();
  };
  const refresh = useCallback(async () => {
    try {
      const next = await api<State>('/state');
      const current = await restoreBanner(next, false);
      setState(next);
      setBanner(current);
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setState(null);
        setBanner(null);
      } else {
        setError((e as Error).message);
        throw e;
      }
    }
  }, []);
  useEffect(() => {
    bootstrap ??= (async () => {
      const next = await api<State>('/state');
      return {
        state: next,
        banner: await restoreBanner(next, initialSummaryDocument),
      };
    })();
    void bootstrap
      .then((result) => {
        setState(result.state);
        setBanner(result.banner);
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  const login = async (username: string, password: string) => {
    const result = await api<{ userId: string; banner: Banner | null }>(
      '/auth/login',
      { username, password, requestId: crypto.randomUUID() },
    );
    rememberBanner(result.userId, result.banner);
    await refresh();
    navigate('/');
  };
  async function logout() {
    if (!state) return;
    try {
      await api('/auth/logout', {}, state.csrf);
      if (window.clarity)
        window.clarity('consentv2', {
          ad_Storage: 'denied',
          analytics_Storage: 'denied',
        });
      sessionStorage.removeItem('softek_banner');
      sessionStorage.removeItem('softek_analytics_consent');
      locationAssignLogin();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function locationAssignLogin() {
    window.location.assign('/login');
  }
  async function reset() {
    if (
      !state ||
      !window.confirm(
        'Reset your demo accounts and goals? Previous report history will be retained.',
      )
    )
      return;
    setResetting(true);
    try {
      await api('/reset', {}, state.csrf);
      sessionStorage.removeItem('softek_banner');
      await refresh();
      navigate('/');
      closeMenu();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResetting(false);
    }
  }
  useEffect(() => {
    closeMenu();
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    if (state && !['/controls', '/login'].includes(location.pathname))
      void interaction(state, 'page_view').catch(() => {});
  }, [location.pathname, state?.runId]);
  useEffect(() => {
    const handler = (e: Event) => {
      if (state)
        void interaction(state, 'placeholder_action', {
          targetKey: (e as CustomEvent<string>).detail,
        }).catch(() => {});
    };
    window.addEventListener('demo-action', handler);
    return () => window.removeEventListener('demo-action', handler);
  }, [state]);
  useEffect(() => {
    if (!menuOpen) return;
    const controls = () =>
      Array.from(
        menuPanel.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled)',
        ) ?? [],
      );
    controls()[0]?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
      if (e.key === 'Tab') {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', keys);
    };
  }, [menuOpen]);
  const controlsPage = location.pathname === '/controls';
  const title = controlsPage
    ? 'Demo Administration'
    : (sections.find((s) => s.href === location.pathname)?.label ??
      (
        {
          '/savings-goals': 'Savings Goals',
          '/enroll': 'Savings Goals',
          '/about': 'About Harbor',
        } as Record<string, string>
      )[location.pathname] ??
      'Harbor');
  useEffect(() => {
    document.title = `${state || controlsPage ? title : 'Sign in'} · Harbor Community Bank`;
  }, [title, state, controlsPage]);
  return (
    <Demo.Provider value={{ state, banner, refresh, login }}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header
        className={`site-header ${state || controlsPage ? 'section-header' : 'login-header'}`}
      >
        {state || controlsPage ? (
          <div>
            <p className="section-eyebrow">HARBOR COMMUNITY BANK</p>
            <h1>{title}</h1>
          </div>
        ) : (
          <Link
            to="/"
            className="brand"
            aria-label="Harbor Community Bank home"
          >
            <span className="brand-mark">
              <Landmark size={26} />
            </span>
            <span>
              <strong>Harbor</strong>
              <span className="brand-subtitle">COMMUNITY BANK</span>
            </span>
          </Link>
        )}
        {state || controlsPage ? (
          <button
            ref={menuButton}
            className="menu-button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="bank-menu"
            onClick={() => {
              setMenuOpen(true);
              if (state && !controlsPage)
                void interaction(state, 'menu_open').catch(() => {});
            }}
          >
            <Menu size={24} />
          </button>
        ) : null}
      </header>
      {menuOpen && (
        <div className="menu-overlay">
          <button
            className="menu-backdrop"
            tabIndex={-1}
            aria-label="Close navigation"
            onClick={closeMenu}
          />
          <nav
            ref={menuPanel}
            id="bank-menu"
            className="bank-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Banking menu"
          >
            <div className="menu-top">
              <strong>Harbor</strong>
              <button
                className="menu-button"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <X size={22} />
              </button>
            </div>
            {state && (
              <p className="menu-greeting" data-clarity-mask="true">
                Welcome, {state.profile.firstName}
              </p>
            )}
            {sections.map((section) => (
              <NavLink
                end={section.href === '/'}
                key={section.key}
                to={section.href}
                onClick={() => {
                  if (state && !controlsPage)
                    void interaction(state, 'menu_selected', {
                      targetKey: section.key,
                    }).catch(() => {});
                  closeMenu();
                }}
              >
                {section.label}
                <ChevronRight size={16} />
              </NavLink>
            ))}
            <div className="menu-secondary">
              <Link to="/about" onClick={closeMenu}>
                About this demo
              </Link>
              <Link
                to="/controls"
                onClick={() => {
                  if (window.clarity) {
                    window.clarity('consentv2', {
                      ad_Storage: 'denied',
                      analytics_Storage: 'denied',
                    });
                    window.location.assign('/controls');
                  } else closeMenu();
                }}
              >
                Demo controls
              </Link>
              {state && (
                <>
                  <button
                    className="text-button"
                    disabled={resetting}
                    onClick={() => void reset()}
                  >
                    {resetting ? 'Resetting…' : 'Reset my demo'}
                  </button>
                  <button className="text-button" onClick={() => void logout()}>
                    <LogOut size={17} />
                    Sign out
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
      <div className="app-layout">
        <main id="main" tabIndex={-1}>
          <Alert message={error} />
          {loading ? (
            <p role="status">Preparing your Harbor experience…</p>
          ) : error && !state && !controlsPage ? (
            <Card title="Let’s reconnect">
              <p>We couldn’t reach your accounts.</p>
              <button
                className="button"
                onClick={() => void refresh().catch(() => {})}
              >
                Try again
              </button>
            </Card>
          ) : (
            <Routes>
              <Route path="/controls" element={<Controls />} />
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Entry />} />
              {state ? (
                <>
                  <Route path="/" element={<Overview />} />
                  <Route path="/savings-goals" element={<Details />} />
                  <Route path="/enroll" element={<Enrollment />} />
                  <Route path="/goals" element={<Goals />} />
                  {sections
                    .filter((s) => !['summary', 'goals'].includes(s.key))
                    .map((section) => (
                      <Route
                        key={section.key}
                        path={section.href}
                        element={
                          <Placeholder
                            title={section.label}
                            kind={section.key}
                          />
                        }
                      />
                    ))}
                  <Route
                    path="*"
                    element={
                      <Card title="Page not found">
                        <Link className="button" to="/">
                          Back to Account Summary
                        </Link>
                      </Card>
                    }
                  />
                </>
              ) : (
                <Route path="*" element={<Entry />} />
              )}
            </Routes>
          )}
        </main>
      </div>
      {!controlsPage && <AnalyticsChoice />}
      <footer className="site-footer">
        Harbor Community Bank · Fictional demonstration · No real money moves
        {!state && <Link to="/controls"> · Demo controls</Link>}
      </footer>
    </Demo.Provider>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
