import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, Landmark, ShieldCheck } from 'lucide-react';
import { money, minor, type State } from './api';
import { Card, Alert } from './ui';
import { DiscoverySlot } from './discovery';
import { demoLoans } from '../../api/src/discovery-config';
export function SavingsExploration({ state }: { state: State }) {
  const savings = state.accounts.find((a) => a.kind === 'savings')!;
  const [investing, setInvesting] = useState(false);
  return (
    <div className="reading-width banking-context">
      <Card title={savings.name}>
        <div className="banking-balance" data-clarity-mask="true">
          <p>•••• {savings.lastFour}</p>
          <strong>{money(savings.balanceMinor)}</strong>
          <small>Available balance</small>
        </div>
        <p>
          Explore your goals and learn about the different ways people save and
          invest.
        </p>
        <div className="context-actions">
          <Link
            className="button"
            to={state.enrolled ? '/goals' : '/savings-goals'}
          >
            View savings goals <ArrowRight size={17} />
          </Link>
          <Link className="button secondary" to="/features/savings">
            Savings & certificates
          </Link>
        </div>
      </Card>
      <Card title="Explore investing at your own pace">
        <p>
          Investing involves different risks from saving. Start with education,
          understand potential losses, and consider the time you may need your
          money.
        </p>
        <button
          className="button secondary"
          aria-expanded={investing}
          onClick={() => setInvesting(!investing)}
        >
          {investing ? 'Close investing exploration' : 'Explore investing'}
        </button>
        {investing && (
          <div className="investing-exploration">
            <p>
              No purchase or investment account is needed to learn. These pages
              describe hypothetical demo services.
            </p>
            <div className="context-links">
              <Link to="/features/easyvest-auto">
                Learn about automated investing
              </Link>
              <Link to="/features/easyvest-choice">
                Learn about stocks & ETFs
              </Link>
            </div>
            <DiscoverySlot state={state} context="investing" />
          </div>
        )}
      </Card>
    </div>
  );
}
export function LoanPayments({ state }: { state: State }) {
  const [params, setParams] = useSearchParams();
  const loan = demoLoans.find((l) => l.key === params.get('loan'));
  const [stage, setStage] = useState<
    'options' | 'form' | 'review' | 'confirmed'
  >('options');
  const [amount, setAmount] = useState(''),
    [error, setError] = useState('');
  const account = state.accounts.find((a) => a.kind === 'checking')!;
  if (!loan)
    return (
      <div className="reading-width banking-context">
        <Card title="Your demo loans">
          <p>Explore a loan’s upcoming payment and available options.</p>
          <p className="small-note">
            These loan examples are fictional and separate from your banking
            balances.
          </p>
          <div className="loan-list">
            {demoLoans.map((l) => (
              <button
                key={l.key}
                className="loan-option"
                onClick={() => {
                  setParams({ loan: l.key });
                  setStage('options');
                  setAmount((l.paymentMinor / 100).toFixed(2));
                }}
              >
                <Landmark size={24} />
                <span>
                  <strong>{l.name}</strong>
                  <small data-clarity-mask="true">
                    Next payment {money(l.paymentMinor)} · •••• {l.lastFour}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </Card>
      </div>
    );
  return (
    <div className="reading-width banking-context">
      <button
        className="text-button"
        onClick={() => {
          setParams({});
          setStage('options');
          setError('');
        }}
      >
        ← All demo loans
      </button>
      <Card title={loan.name}>
        <div className="loan-summary" data-clarity-mask="true">
          <div>
            <small>Remaining balance</small>
            <strong>{money(loan.balanceMinor)}</strong>
          </div>
          <div>
            <small>Upcoming payment</small>
            <strong>{money(loan.paymentMinor)}</strong>
          </div>
        </div>
        <p className="small-note">
          Fictional loan example. Reviewing or confirming a demo payment does
          not move money or change a loan.
        </p>
        {stage === 'options' && (
          <>
            <h3>Your upcoming payment</h3>
            <p>
              Choose your payment details and review them before confirming.
            </p>
            <button
              className="button"
              onClick={() => {
                setAmount((loan.paymentMinor / 100).toFixed(2));
                setStage('form');
              }}
            >
              Make a demo payment <ArrowRight size={17} />
            </button>
            <DiscoverySlot
              key={loan.key}
              state={state}
              context={loan.key === 'auto' ? 'loan-auto' : 'loan-personal'}
            />
          </>
        )}
        {stage === 'form' && (
          <form
            data-clarity-mask="true"
            onSubmit={(e) => {
              e.preventDefault();
              const n = minor(amount);
              if (!n || n > account.balanceMinor) {
                setError(
                  'Enter a positive amount within your available checking balance.',
                );
                return;
              }
              setError('');
              setStage('review');
            }}
          >
            <label>
              Pay from
              <select defaultValue={account.id}>
                <option value={account.id}>
                  {account.name} · •••• {account.lastFour}
                </option>
              </select>
            </label>
            <label>
              Payment amount
              <input
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <Alert message={error} />
            <div className="context-actions">
              <button className="button">Review demo payment</button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setStage('options');
                  setError('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {stage === 'review' && (
          <>
            <div data-clarity-mask="true">
              <h3>Review your payment</h3>
              <p>
                {money(minor(amount)!)} from {account.name} toward {loan.name}.
              </p>
            </div>
            <p>
              This is a preview only. Confirming completes a demo interaction.
            </p>
            <div className="context-actions">
              <button
                className="button"
                onClick={() => {
                  setStage('confirmed');
                  window.dispatchEvent(
                    new CustomEvent('demo-action', { detail: 'loans' }),
                  );
                }}
              >
                Confirm demo payment
              </button>
              <button
                className="button secondary"
                onClick={() => setStage('form')}
              >
                Edit payment
              </button>
            </div>
          </>
        )}
        {stage === 'confirmed' && (
          <>
            <p className="success" role="status">
              <ShieldCheck size={20} />
              Demo payment reviewed. Your accounts and loan remain unchanged.
            </p>
            <Link className="button secondary" to="/">
              Back to Account Summary
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
