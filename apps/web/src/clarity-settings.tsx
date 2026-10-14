import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from './admin-session';
import { Alert, Card } from './ui';
import { PhoenixSettings } from './phoenix-settings';
type Settings = {
  configured: boolean;
  enabled: boolean;
  requestedEnabled: boolean;
  projectId: string | null;
  revision: string;
  updatedAt: string;
};
export function ClaritySettings() {
  const { request } = useAdmin();
  const [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setSettings(await request<Settings>('/admin/clarity'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  async function toggle() {
    if (!settings) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await request<Settings>('/admin/clarity', {
        enabled: !settings.requestedEnabled,
        revision: settings.revision,
      });
      setSettings(next);
      setNotice(
        next.enabled
          ? 'Collection enabled. Customers must allow analytics before recording starts.'
          : 'Collection disabled. Open customer pages stop on their next settings check (normally within five seconds).',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card title="Microsoft Clarity" className="reading-width">
        <Alert message={error} />
        {!settings ? (
          <>
            <p role="status">Loading settings…</p>
            {error && (
              <button className="button secondary" onClick={() => void load()}>
                Try again
              </button>
            )}
          </>
        ) : (
          <>
            <p>
              <strong>Collection: {settings.enabled ? 'On' : 'Off'}</strong>
            </p>
            <p>Project: {settings.projectId ?? 'Not configured'}</p>
            {!settings.configured && (
              <p>
                This deployment has collection disabled. The site must be
                configured before you can turn it on here.
              </p>
            )}
            <p>
              Recording starts only after a signed-in customer chooses Allow
              analytics. Turning collection on again requires a new opt-in.
              Admin pages are excluded.
            </p>
            <p>
              Account details and form contents are masked. Feature views and
              CTA clicks are tracked separately from Savings Goals adoption.
            </p>
            <button
              className="button"
              disabled={
                busy || (!settings.configured && !settings.requestedEnabled)
              }
              onClick={() => void toggle()}
            >
              {busy
                ? 'Saving…'
                : settings.requestedEnabled
                  ? 'Turn collection off'
                  : 'Turn collection on'}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh settings
            </button>
            {notice && (
              <p className="success" role="status">
                {notice}
              </p>
            )}
            <p className="small-note">
              Last changed: {new Date(settings.updatedAt).toLocaleString()}
            </p>
            <a
              className="text-button"
              href="https://clarity.microsoft.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open Microsoft Clarity
            </a>
            <p className="small-note">
              The Adoption Report uses our database. Recordings and heatmaps are
              viewed in your Microsoft Clarity dashboard. Automated traffic may
              be filtered by your project's bot detection setting.
            </p>
          </>
        )}
      </Card>
      <PhoenixSettings />
    </>
  );
}
