import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import { getFeature, type Feature } from '../../api/src/features';
import { api, type State } from './api';
import { emitFeatureObservation } from './analytics';
import { featureEntry } from './feature-context';
import { Alert, Card } from './ui';

export function FeaturePage({ state }: { state: State }) {
  const { featureId } = useParams(),
    location = useLocation();
  const feature = getFeature(featureId ?? '');
  return feature ? (
    <Landing
      key={`${location.key}:${state.runId}:${feature.id}`}
      state={state}
      feature={feature}
    />
  ) : (
    <Card title="Feature not found">
      <p>Choose a feature from Explore Features.</p>
      <Link className="text-button" to="/">
        Back to Account Summary
      </Link>
    </Card>
  );
}
function Landing({ state, feature }: { state: State; feature: Feature }) {
  const location = useLocation();
  const entry = featureEntry(state, feature.id, location.state?.featureEntry);
  const pageId = useRef(crypto.randomUUID()),
    viewId = useRef(crypto.randomUUID()),
    ctaId = useRef(crypto.randomUUID());
  const view = useRef<Promise<unknown> | null>(null),
    emitted = useRef(new Set<string>()),
    inFlight = useRef(false),
    active = useRef(true);
  const [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState('');
  async function record(
    name: 'feature_viewed' | 'feature_cta_clicked',
    requestId: string,
  ) {
    const result = await api<{ acknowledged: boolean }>(
      '/interactions',
      {
        requestId,
        pageId: pageId.current,
        name,
        routeKey: feature.id,
        ...(entry ? { selectionId: entry.selectionId } : {}),
        observedAt: new Date().toISOString(),
      },
      state.csrf,
    );
    if (active.current && result.acknowledged && !emitted.current.has(name)) {
      emitted.current.add(name);
      emitFeatureObservation(state, name);
    }
  }
  useEffect(() => {
    active.current = true;
    view.current ??= record('feature_viewed', viewId.current).catch(() => {});
    return () => {
      active.current = false;
    };
  }, []);
  async function activate() {
    if (inFlight.current || confirmed) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await record('feature_cta_clicked', ctaId.current);
      setConfirmed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="feature-landing">
      <Card className="feature-hero">
        <h2 className="eyebrow">{feature.headline}</h2>
        <div className="feature-description">
          {feature.description.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <ul className="feature-benefits">
          {feature.benefits.map((benefit) => (
            <li key={benefit}>
              <Check size={19} />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        {feature.audience && (
          <p className="small-note">For adult parents and guardians.</p>
        )}
        <Alert message={error} />
        <button
          className="button"
          onClick={() => void activate()}
          disabled={busy || confirmed}
        >
          {busy ? 'Please wait…' : feature.cta}
          <ArrowRight size={17} />
        </button>
        {confirmed && (
          <p className="success feature-confirmation" role="status">
            Thanks for exploring {feature.name}. This demo does not activate a
            service or submit an application.
          </p>
        )}
        {feature.disclosure && (
          <p className="small-note feature-disclosure">{feature.disclosure}</p>
        )}
        <p className="small-note feature-demo-notice">
          This is a simulated banking experience. No real financial
          transactions, investment orders, applications, account changes or
          enrollments will occur.
        </p>
      </Card>
      <Link className="text-button feature-return" to="/">
        Back to Account Summary
      </Link>
    </div>
  );
}
