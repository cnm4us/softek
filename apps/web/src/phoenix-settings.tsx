import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from './admin-session';
import { Alert, Card } from './ui';
type Settings = {
  configured: boolean;
  enabled: boolean;
  requestedEnabled: boolean;
  revision: string;
  counts: Record<string, number>;
  oldestPendingAt: string | null;
  lastAcknowledgedAt: string | null;
  droppedCalls: number;
  failedBatches: number;
  retentionDays: number;
  project: string;
};
export function PhoenixSettings() {
  const { request } = useAdmin();
  const [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [customer, setCustomer] = useState(''),
    [command, setCommand] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const load = useCallback(async () => {
    try {
      setSettings(await request('/admin/clarity-tracing'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);
  async function toggle() {
    if (!settings) return;
    setBusy(true);
    setError('');
    try {
      await request('/admin/clarity-tracing', {
        enabled: !settings.requestedEnabled,
        revision: settings.revision,
      });
      setNotice(
        settings.requestedEnabled
          ? 'API-call tracing is off. Previously accepted records can finish exporting.'
          : 'API-call tracing is on for customers who have allowed analytics. Clarity collection is unchanged.',
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (customer.trim()) query.set('customer', customer.trim());
      if (command) query.set('command', command);
      if (from) query.set('from', new Date(from).toISOString());
      if (to) query.set('to', new Date(to).toISOString());
      const data = await request('/admin/clarity-tracing/export?' + query);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'softek-clarity-api-calls.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Clarity API-call tracing" className="reading-width">
      <Alert message={error} />
      {!settings ? (
        <p role="status">Loading tracing settings…</p>
      ) : (
        <>
          <p>
            <strong>API-call tracing: {settings.enabled ? 'On' : 'Off'}</strong>
          </p>
          {!settings.configured && (
            <p>
              This deployment has not configured the private Phoenix collector.
            </p>
          )}
          <p>
            Copies our Clarity commands and safe arguments to a private Phoenix
            instance. This records calls made by our application; it does not
            capture Clarity’s automatic uploads or confirm Microsoft processing.
          </p>
          <p>
            Customers must allow analytics. Admin, impersonation and ordinary
            automated tests are excluded. Retention: {settings.retentionDays}{' '}
            days.
          </p>
          <button
            className="button"
            disabled={
              busy || (!settings.configured && !settings.requestedEnabled)
            }
            onClick={() => void toggle()}
          >
            {busy
              ? 'Working…'
              : settings.requestedEnabled
                ? 'Turn API-call tracing off'
                : 'Turn API-call tracing on'}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void load()}
          >
            Refresh tracing status
          </button>
          {notice && (
            <p className="success" role="status">
              {notice}
            </p>
          )}
          <p>
            Pending:{' '}
            {(settings.counts.pending ?? 0) + (settings.counts.exporting ?? 0)}{' '}
            · Phoenix acknowledged: {settings.counts.acknowledged ?? 0} ·
            Failed: {settings.counts.failed ?? 0}
          </p>
          <p className="small-note">
            Last Phoenix acknowledgment:{' '}
            {settings.lastAcknowledgedAt
              ? new Date(settings.lastAcknowledgedAt).toLocaleString()
              : 'None'}
            . Oldest pending:{' '}
            {settings.oldestPendingAt
              ? new Date(settings.oldestPendingAt).toLocaleString()
              : 'None'}
            .
          </p>
          <p className="small-note">
            Reported omitted calls: {settings.droppedCalls} · Failed browser
            batches: {settings.failedBatches}. Browser closure/offline activity
            can leave additional unreported gaps.
          </p>
          <p>
            Phoenix project: <code>{settings.project}</code>. The viewer is
            private; use VS Code’s Ports panel to forward port 6006, or the SSH
            instructions in LOCAL_SETUP.md, then open{' '}
            <code>http://localhost:6006</code>.
          </p>
          <details>
            <summary>Export application-call records</summary>
            <label>
              Customer UUID (optional)
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Opaque customer ID"
              />
            </label>
            <label>
              Command
              <select
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              >
                <option value="">All commands</option>
                {['event', 'set', 'identify', 'consentv2', 'stop'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              From (your local time)
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              To (your local time)
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void download()}
            >
              Download call records
            </button>
            <p className="small-note">
              Up to 1,000 matching records; the JSON indicates whether results
              were truncated. Records contain UTC timestamps and opaque IDs.
            </p>
          </details>
        </>
      )}
    </Card>
  );
}
