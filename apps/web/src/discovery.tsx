import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, X, Compass } from 'lucide-react';
import { api, type State } from './api';
import { Alert, Card } from './ui';
import type {
  DiscoveryContext,
  DiscoveryPreferences,
} from '../../api/src/discovery-config';
type Recommendation = {
  id: string;
  featureId: string;
  placement: string;
  title: string;
  message: string;
  href: string;
  label: string;
  disclosure: string;
  returnTo: string;
};
export type DiscoveryEntry = {
  userId: string;
  runId: string;
  featureId: string;
  presentationId: string;
  returnTo: string;
};
export function discoveryEntry(
  state: State,
  featureId: string,
  value: unknown,
): DiscoveryEntry | null {
  const v = value as DiscoveryEntry | null;
  return v &&
    v.userId === state.user.id &&
    v.runId === state.runId &&
    v.featureId === featureId &&
    /^[a-f0-9-]{36}$/i.test(v.presentationId ?? '') &&
    ['/savings', '/loans?loan=auto'].includes(v.returnTo)
    ? v
    : null;
}
export function DiscoverySlot({
  state,
  context,
}: {
  state: State;
  context: DiscoveryContext;
}) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const element = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    setRecommendation(null);
    void api<{ recommendation: Recommendation | null }>(
      '/discovery/select',
      { context },
      state.csrf,
    )
      .then((result) => {
        if (active) setRecommendation(result.recommendation);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [context, state.user.id, state.runId, state.visitId, state.csrf]);
  useEffect(() => {
    if (!recommendation || !element.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined,
      visible = false,
      recorded = false,
      active = true;
    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      cancel();
      if (!recorded && visible && document.visibilityState === 'visible')
        timer = setTimeout(() => {
          recorded = true;
          void api<{ acknowledged: boolean }>(
            '/discovery/observations',
            { presentationId: recommendation.id, name: 'impression' },
            state.csrf,
          )
            .then((result) => {
              if (active && !result.acknowledged) setRecommendation(null);
            })
            .catch(() => {
              recorded = false;
            });
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
      active = false;
      cancel();
      observer.disconnect();
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [recommendation?.id, state.csrf]);
  async function act(name: 'dismiss' | 'learn-more') {
    if (!recommendation || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ acknowledged: boolean }>(
        '/discovery/observations',
        { presentationId: recommendation.id, name },
        state.csrf,
      );
      if (!result.acknowledged) {
        setRecommendation(null);
        return;
      }
      if (name === 'dismiss') setRecommendation(null);
      else
        navigate(recommendation.href, {
          state: {
            discoveryEntry: {
              userId: state.user.id,
              runId: state.runId,
              featureId: recommendation.featureId,
              presentationId: recommendation.id,
              returnTo: recommendation.returnTo,
            } satisfies DiscoveryEntry,
          },
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!recommendation) return null;
  return (
    <aside
      ref={element}
      className="discovery-card"
      aria-label={`${recommendation.label} suggestion`}
      data-testid="discovery-card"
    >
      <div className="discovery-icon" aria-hidden="true">
        <Compass size={23} />
      </div>
      <div className="discovery-copy">
        <p className="eyebrow">EXPLORE YOUR OPTIONS</p>
        <h3>{recommendation.title}</h3>
        <p>{recommendation.message}</p>
        <button
          className="text-button discovery-learn"
          disabled={busy}
          onClick={() => void act('learn-more')}
        >
          Learn more <ArrowRight size={16} />
        </button>
        {recommendation.disclosure && (
          <p className="small-note discovery-disclosure">
            {recommendation.disclosure}
          </p>
        )}
        <Alert message={error} />
      </div>
      <button
        className="discovery-dismiss"
        aria-label={`Dismiss ${recommendation.label} suggestion`}
        disabled={busy}
        onClick={() => void act('dismiss')}
      >
        <X size={19} />
      </button>
    </aside>
  );
}
export function DiscoveryPreferencesPage({ state }: { state: State }) {
  const [choice, setChoice] = useState('standard'),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void api<DiscoveryPreferences>('/discovery/preferences')
      .then((p) => {
        if (active) {
          setChoice(
            p.optOut ? 'off' : p.fewerSuggestions ? 'fewer' : 'standard',
          );
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [state.user.id]);
  return (
    <div className="reading-width">
      <Card title="Make discovery work for you">
        <p>
          Choose how often you see optional suggestions while banking. You can
          always browse Explore more ways to bank from the menu.
        </p>
        <p className="small-note">
          These settings control invitations in Savings &amp; Investing and
          Loans.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setSaved(false);
            setError('');
            void api(
              '/discovery/preferences',
              {
                optOut: choice === 'off',
                fewerSuggestions: choice === 'fewer',
              },
              state.csrf,
            )
              .then(() => setSaved(true))
              .catch((e) => setError((e as Error).message))
              .finally(() => setBusy(false));
          }}
        >
          <fieldset
            disabled={!loaded || busy}
            hidden={!loaded}
            className="discovery-options"
          >
            <legend>Optional feature suggestions</legend>
            {(
              [
                [
                  'standard',
                  'Standard suggestions',
                  'At most one contextual suggestion per visit.',
                ],
                [
                  'fewer',
                  'Show fewer suggestions',
                  'At most one every seven days.',
                ],
                [
                  'off',
                  'Don’t suggest additional services',
                  'Keep contextual suggestions off.',
                ],
              ] as const
            ).map(([value, label, description]) => (
              <label key={value} className="discovery-choice">
                <input
                  type="radio"
                  name="suggestions"
                  value={value}
                  checked={choice === value}
                  onChange={() => {
                    setChoice(value);
                    setSaved(false);
                  }}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {!loaded && !error && <p role="status">Loading your preferences…</p>}
          <p className="small-note">
            Seen suggestions rest for 14 days. Dismissed suggestions stay hidden
            for 90 days. Your choices follow your account across logins.
          </p>
          <Alert message={error} />
          <button className="button" disabled={!loaded || busy}>
            {busy ? 'Saving…' : 'Save preferences'}
          </button>
          {saved && (
            <p className="success" role="status">
              Your discovery preferences are saved.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
