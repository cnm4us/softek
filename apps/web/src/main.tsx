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
} from 'lucide-react';
import { api, ApiError, minor, money, type State } from './api';
import {
  chooseConsent,
  collectionAvailable,
  confirmed,
  initialize,
  observe,
} from './analytics';
import './theme.css';

type Context = { state: State | null; refresh: () => Promise<void> };
const Demo = createContext<Context>({ state: null, refresh: async () => {} });
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
      <h1>{title}</h1>
      {children && <p className="lead">{children}</p>}
    </div>
  );
}
function Entry() {
  const { refresh } = useDemo();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const navigate = useNavigate();
  async function enter(profileId: string) {
    setBusy(true);
    setError('');
    try {
      await api('/entry', { profileId });
      await refresh();
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="entry">
      <div className="entry-art" aria-hidden="true">
        <div className="orbit">
          <Sprout size={68} />
        </div>
        <span className="art-caption">SMALL STEPS. BIG POSSIBILITIES.</span>
      </div>
      <div>
        <Heading
          eyebrow="WELCOME TO HARBOR"
          title="Your next chapter starts here."
        >
          Everyday banking, with a little more room for what matters.
        </Heading>
        <Card title="Choose a fictional profile">
          <p>
            Explore the experience with an independent set of demo accounts.
          </p>
          <div className="profile-options" data-clarity-mask="true">
            <button
              className="profile-button"
              disabled={busy}
              onClick={() => void enter('alex')}
            >
              <span className="avatar">AM</span>
              <span>
                <strong>Alex Morgan</strong>
                <small>Everyday banking · savings goals available</small>
              </span>
              <ChevronRight size={20} />
            </button>
            <button
              className="profile-button"
              disabled={busy}
              onClick={() => void enter('jamie')}
            >
              <span className="avatar">JC</span>
              <span>
                <strong>Jamie Chen</strong>
                <small>Everyday banking · standard profile</small>
              </span>
              <ChevronRight size={20} />
            </button>
          </div>
          <Alert message={error} />
        </Card>
        <p className="quiet-note">
          <ShieldCheck size={18} />
          Fictional accounts. No real money moves.
        </p>
      </div>
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
  const { state } = useDemo();
  if (!state) return <Entry />;
  return (
    <>
      <div className="welcome-row" data-clarity-mask="true">
        <Heading
          eyebrow="YOUR FINANCIAL HOME"
          title={`Good to see you, ${state.profile.firstName}.`}
        >
          <span data-clarity-mask="true">
            Here’s a little snapshot of your day.
          </span>
        </Heading>
        <div className="date-note">YOUR ACCOUNTS, AT A GLANCE</div>
      </div>
      <Promotion placement="banner" />
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
  const [profile, setProfile] = useState('alex'),
    [variant, setVariant] = useState('baseline'),
    [eligible, setEligible] = useState(true);
  const navigate = useNavigate();
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
  async function restart(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setBusy(true);
    setError('');
    try {
      await api(
        '/admin/restart',
        { profileId: profile, variant, eligible },
        auth,
      );
      await refresh();
      navigate('/');
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
          <Card title="Start a configured demo">
            <form className="controls-form" onSubmit={(e) => void restart(e)}>
              <label>
                Profile
                <select
                  value={profile}
                  onChange={(e) => {
                    setProfile(e.target.value);
                    setEligible(e.target.value === 'alex');
                  }}
                >
                  <option value="alex">Alex Morgan</option>
                  <option value="jamie">Jamie Chen</option>
                </select>
              </label>
              <label>
                Campaign variant
                <select
                  value={variant}
                  onChange={(e) => setVariant(e.target.value)}
                >
                  <option value="baseline">Baseline · What’s next</option>
                  <option value="value">Value · Build a cushion</option>
                </select>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={eligible}
                  onChange={(e) => setEligible(e.target.checked)}
                />
                Eligible for savings goals
              </label>
              <button className="button" disabled={busy}>
                {busy ? 'Starting…' : 'Start configured demo'}
              </button>
            </form>
          </Card>
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
  const { state } = useDemo();
  const [choice, setChoice] = useState(
    sessionStorage.getItem('softek_analytics_consent'),
  );
  useEffect(() => {
    if (state) initialize(state);
  }, [state?.runId, state?.visitId]);
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
function App() {
  const [state, setState] = useState<State | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [resetting, setResetting] = useState(false);
  const navigate = useNavigate(),
    location = useLocation();
  const refresh = useCallback(async () => {
    try {
      setState(await api<State>('/state'));
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setState(null);
      } else {
        setError((e as Error).message);
        throw e;
      }
    }
  }, []);
  useEffect(() => {
    void refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);
  async function reset() {
    if (!state) return;
    setResetting(true);
    setError('');
    try {
      await api('/reset', {}, state.csrf);
      await refresh();
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResetting(false);
    }
  }
  return (
    <Demo.Provider value={{ state, refresh }}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Harbor Community Bank home">
          <span className="brand-mark">
            <Landmark size={24} />
          </span>
          <span>
            <strong>Harbor</strong>
            <span className="brand-subtitle">COMMUNITY BANK</span>
          </span>
        </Link>
        <div className="header-right">
          <span className="demo-badge">Fictional demo</span>
          {state && (
            <span
              className="avatar"
              data-clarity-mask="true"
              aria-label="Demo profile"
            >
              {state.profile.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </span>
          )}
        </div>
      </header>
      <div className="app-layout">
        <nav aria-label="Main navigation" className="navigation">
          <NavLink end to="/">
            <Wallet size={18} />
            Overview
          </NavLink>
          <NavLink to={state?.enrolled ? '/goals' : '/savings-goals'}>
            <Target size={18} />
            Savings goals
          </NavLink>
          <NavLink to="/about">
            <ShieldCheck size={18} />
            About the demo
          </NavLink>
          <NavLink to="/controls">
            <Landmark size={18} />
            Demo controls
          </NavLink>
          {state && (
            <button
              className="reset-button"
              disabled={resetting}
              onClick={() => void reset()}
            >
              {resetting ? 'Resetting…' : 'Reset my demo'}
            </button>
          )}
        </nav>
        <main id="main" tabIndex={-1}>
          <Alert message={error} />
          {loading ? (
            <p role="status">Preparing your Harbor experience…</p>
          ) : error && !state ? (
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
              <Route path="/" element={<Overview />} />
              <Route path="/savings-goals" element={<Details />} />
              <Route path="/enroll" element={<Enrollment />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/controls" element={<Controls />} />
              <Route path="/about" element={<About />} />
              <Route
                path="*"
                element={
                  <Card title="Page not found">
                    <Link className="button" to="/">
                      Back to overview
                    </Link>
                  </Card>
                }
              />
            </Routes>
          )}
        </main>
      </div>
      <AnalyticsChoice />
      <footer className="site-footer">
        Harbor Community Bank · Fictional demonstration · No real money moves
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
