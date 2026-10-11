import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAdmin } from './admin-session';
import { Card, Alert } from './ui';
import { minor, money } from './api';
type Customer = {
  id: string;
  username: string;
  displayName: string;
  checkingMinor: number;
  savingsMinor: number;
  actor: string;
};
type Batch = { batchId: number; customers: Customer[] };
export function GenerateCustomers() {
  const { request } = useAdmin();
  const [result, setResult] = useState<Batch | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const amounts = Object.fromEntries(
      [
        'checkingMinMinor',
        'checkingMaxMinor',
        'savingsMinMinor',
        'savingsMaxMinor',
      ].map((key) => [key, minor(String(data.get(key)))]),
    );
    if (Object.values(amounts).some((value) => value === undefined)) {
      setError('Enter amounts with up to two decimal places.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const batch = await request<Batch>('/admin/users/generate', {
        requestId: requestId.current,
        count: Number(data.get('count')),
        prefix: data.get('prefix'),
        password: data.get('password'),
        profileId: data.get('profileId'),
        variant: data.get('variant'),
        eligible: data.get('eligible') === 'on',
        actor: data.get('actor'),
        ...amounts,
      });
      setResult(batch);
      (form.elements.namedItem('password') as HTMLInputElement).value = '';
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function startNew() {
    requestId.current = crypto.randomUUID();
    setResult(null);
    setError('');
  }
  function download() {
    if (!result) return;
    const quote = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      [
        'user_id',
        'username',
        'display_name',
        'checking_balance_usd',
        'savings_balance_usd',
        'activity_mode',
      ],
      ...result.customers.map((c) => [
        c.id,
        c.username,
        c.displayName,
        (c.checkingMinor / 100).toFixed(2),
        (c.savingsMinor / 100).toFixed(2),
        c.actor,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        [rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n'],
        { type: 'text/csv;charset=utf-8' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-batch-${result.batchId}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <Link className="back-link" to="/controls/customers">
        ← Manage Customers
      </Link>
      <Card title="Generate demo customers">
        <p>
          Create up to 200 fictional customers at once with unique usernames and
          display names. Each receives a saved starting checking and savings
          balance within your ranges.
        </p>
        <Alert message={error} />
        {result ? (
          <>
            <p className="success" role="status">
              Created {result.customers.length} customers in batch{' '}
              {result.batchId}.
            </p>
            <p>
              These customers use the shared demo password you entered. The
              download contains identities and starting amounts; it does not
              include the password.
            </p>
            <div className="generation-actions">
              <button className="button" onClick={download}>
                Download customer list
              </button>
              <button className="button secondary" onClick={startNew}>
                Start new batch
              </button>
            </div>
            <ul className="generated-customers">
              {result.customers.map((c) => (
                <li key={c.id}>
                  <Link to={`/controls/customers/${c.id}`}>
                    <strong>{c.displayName}</strong>
                    <span>{c.username}</span>
                  </Link>
                  <p>
                    Checking {money(c.checkingMinor)} · Savings{' '}
                    {money(c.savingsMinor)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy} className="generation-fields">
              <div className="controls-form">
                <label>
                  Number of customers
                  <input
                    name="count"
                    type="number"
                    min="1"
                    max="200"
                    step="1"
                    defaultValue="10"
                    required
                  />
                </label>
                <label>
                  Username prefix
                  <input
                    name="prefix"
                    defaultValue="demo"
                    minLength={1}
                    maxLength={16}
                    pattern="[a-zA-Z][a-zA-Z0-9._\-]*"
                    required
                  />
                </label>
                <label>
                  Shared demo password
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </label>
                <label>
                  Starting accounts template
                  <select name="profileId" defaultValue="alex">
                    <option value="alex">Eligible account</option>
                    <option value="jamie">Standard template</option>
                  </select>
                </label>
                <label>
                  Checking minimum ($)
                  <input
                    name="checkingMinMinor"
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    defaultValue="100"
                    required
                  />
                </label>
                <label>
                  Checking maximum ($)
                  <input
                    name="checkingMaxMinor"
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    defaultValue="10000"
                    required
                  />
                </label>
                <label>
                  Savings minimum ($)
                  <input
                    name="savingsMinMinor"
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Savings maximum ($)
                  <input
                    name="savingsMaxMinor"
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    defaultValue="50000"
                    required
                  />
                </label>
                <label>
                  Campaign variant
                  <select name="variant" defaultValue="value">
                    <option value="value">Value</option>
                    <option value="baseline">Baseline</option>
                  </select>
                </label>
                <label>
                  Activity mode
                  <select name="actor" defaultValue="human">
                    <option value="human">Human</option>
                    <option value="automation">Automation</option>
                  </select>
                </label>
              </div>
              <label className="checkbox-field">
                <input name="eligible" type="checkbox" defaultChecked />
                Eligible for Savings Goals
              </label>
              <p className="small-note">
                Use Human for manual logins. Automation is for the trusted
                journey runner. Creation does not sign customers in or allow
                analytics for them. Credit accounts and recent activity use the
                selected template; resets restore each customer's saved starting
                amounts.
              </p>
              <button className="button" type="submit">
                {busy ? 'Creating customers…' : 'Generate customers'}
              </button>
              {busy && (
                <p role="status">A large batch may take a few moments.</p>
              )}
            </fieldset>
            {error && (
              <button className="text-button" type="button" onClick={startNew}>
                Start new batch
              </button>
            )}
          </form>
        )}
      </Card>
    </>
  );
}
