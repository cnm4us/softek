import { Link } from 'react-router';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { money, type Account, type State } from './api';
import { Card } from './ui';

const samples = {
  checking: [
    ['City utilities', -9245, '2026-10-06'],
    ['Harbor Books', -2680, '2026-10-04'],
    ['Transfer received', 17550, '2026-10-03'],
    ['Neighborhood Grocer', -8320, '2026-09-28'],
  ],
  savings: [
    ['Monthly savings transfer', 25000, '2026-09-29'],
    ['Savings deposit', 10000, '2026-09-16'],
    ['Transfer to checking', -7500, '2026-09-12'],
    ['Interest credit', 1895, '2026-09-01'],
  ],
  credit: [
    ['Cove Fuel', -4618, '2026-10-11'],
    ['Harbor Kitchen', -5872, '2026-10-10'],
    ['Card payment received', 20000, '2026-10-08'],
    ['Streaming subscription', -1499, '2026-10-07'],
    ['Bay Trail Bike Shop', -8950, '2026-10-04'],
    ['Harbor Market', -6435, '2026-10-02'],
  ],
} satisfies Record<Account['kind'], [string, number, string][]>;

export function AccountDetails({
  state,
  kind,
}: {
  state: State;
  kind: Account['kind'];
}) {
  const account = state.accounts.find((a) => a.kind === kind);
  if (!account)
    return (
      <Card title="Account unavailable">
        <p>This account is not available in your demo.</p>
        <Link to="/">Back to Account Summary</Link>
      </Card>
    );
  // Stable examples per owned account, separate from persisted ledger activity.
  const offset =
    [...account.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 500;
  const activity = [
    ...state.transactions
      .filter((t) => t.accountId === account.id)
      .map((t) => ({ ...t, sample: false })),
    ...samples[kind].map(([description, amount, date], i) => ({
      id: `sample-${account.id}-${i}`,
      accountId: account.id,
      accountName: account.name,
      description,
      amountMinor: amount < 0 ? amount - offset : amount + offset,
      occurredAt: `${date}T12:00:00.000Z`,
      sample: true,
    })),
  ].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const owed = Math.max(0, -account.balanceMinor);
  const creditLimit = 1000000;
  return (
    <div className="account-details">
      <Link className="text-button account-back" to="/">
        <ArrowLeft size={17} />
        Back to Account Summary
      </Link>
      <Card
        className={`account-detail-balance ${kind === 'savings' ? 'savings-detail-balance' : ''}`}
      >
        {kind === 'savings' ? (
          <>
            <div className="savings-detail-heading">
              <h2>Personal Savings</h2>
              <p className="account-detail-number" data-clarity-mask="true">
                •••• {account.lastFour}
              </p>
            </div>
            <p className="savings-interest">
              Interest 1.25% / Compounded Monthly
            </p>
          </>
        ) : (
          <div className="account-detail-heading">
            <span className="icon-circle">
              {kind === 'credit' ? (
                <CreditCard size={24} />
              ) : (
                <Wallet size={24} />
              )}
            </span>
            <div>
              <h2>{kind === 'credit' ? 'Your credit card' : 'Your account'}</h2>
              <p className="small-note">
                {kind === 'checking'
                  ? 'Everyday spending, in one place.'
                  : 'Your balance, payments and recent purchases.'}
              </p>
            </div>
          </div>
        )}
        <div className="banking-balance" data-clarity-mask="true">
          {kind !== 'savings' && <p>•••• {account.lastFour}</p>}
          <strong data-testid="account-detail-balance">
            {money(
              kind === 'credit' ? -account.balanceMinor : account.balanceMinor,
            )}
          </strong>
          <small>
            {kind === 'credit' ? 'Current amount owed' : 'Available balance'}
          </small>
        </div>
        {kind === 'credit' && (
          <dl className="account-metrics" data-clarity-mask="true">
            <div>
              <dt>Available credit</dt>
              <dd>{money(Math.max(0, creditLimit - owed))}</dd>
            </div>
            <div>
              <dt>Example credit limit</dt>
              <dd>{money(creditLimit)}</dd>
            </div>
          </dl>
        )}
      </Card>
      <div
        className={`account-detail-grid ${kind === 'savings' ? 'account-detail-grid-single' : ''}`}
      >
        {kind !== 'savings' && (
          <Card title="Account information">
            <dl className="account-information" data-clarity-mask="true">
              <div>
                <dt>Account</dt>
                <dd>{account.name}</dd>
              </div>
              <div>
                <dt>Ending in</dt>
                <dd>•••• {account.lastFour}</dd>
              </div>
              <div>
                <dt>Account type</dt>
                <dd>
                  {kind === 'credit' ? 'Credit card' : 'Personal checking'}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Open</dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{account.currency}</dd>
              </div>
              {kind === 'checking' && (
                <>
                  <div>
                    <dt>Example account plan</dt>
                    <dd>Everyday banking</dd>
                  </div>
                  <div>
                    <dt>Example monthly fee</dt>
                    <dd>$0.00</dd>
                  </div>
                </>
              )}
              {kind === 'credit' && (
                <>
                  <div>
                    <dt>Example minimum payment</dt>
                    <dd>
                      {money(
                        Math.min(owed, Math.max(2500, Math.ceil(owed * 0.02))),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Example payment due date</dt>
                    <dd>November 5, 2026</dd>
                  </div>
                </>
              )}
            </dl>
            <p className="small-note">
              Rates, fees, limits and payment details are fictional examples for
              this demo.
            </p>
          </Card>
        )}
        <Card title="Recent activity">
          <p className="section-caption">
            {kind === 'credit'
              ? 'Purchases and payments'
              : 'Deposits, transfers and account activity'}
          </p>
          <div
            className="activity account-detail-activity"
            data-clarity-mask="true"
          >
            {activity.map((t) => {
              const amount = kind === 'credit' ? -t.amountMinor : t.amountMinor;
              const favorable = kind === 'credit' ? amount < 0 : amount > 0;
              return (
                <div
                  className="transaction"
                  key={t.id}
                  data-testid={
                    t.sample
                      ? 'sample-account-activity'
                      : 'saved-account-activity'
                  }
                >
                  <div className="transaction-icon">
                    {favorable ? (
                      <ArrowDownLeft size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </div>
                  <div>
                    <strong>{t.description}</strong>
                    <small>
                      {new Date(t.occurredAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}{' '}
                      · {t.sample ? 'Sample entry' : 'Posted'}
                    </small>
                  </div>
                  <span className={favorable ? 'positive' : ''}>
                    {amount > 0 ? '+' : ''}
                    {money(amount)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="small-note">
            All activity is fictional. Sample entries illustrate a statement and
            do not change your balance.
          </p>
        </Card>
      </div>
    </div>
  );
}
