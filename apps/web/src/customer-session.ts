import { api } from './api';
import { stopCollection } from './analytics';

export const impersonationStorage = 'softek_impersonation_context';
const channel = new BroadcastChannel('softek_customer_session');
function clearCustomerState() {
  stopCollection();
  sessionStorage.removeItem('softek_banner');
  sessionStorage.removeItem('softek_analytics_consent');
}
channel.onmessage = ({ data }) => {
  if (data === 'changing') {
    clearCustomerState();
    window.dispatchEvent(new Event('customer-session-changing'));
  } else if (data?.changed) {
    clearCustomerState();
    sessionStorage.removeItem(impersonationStorage);
    if (!location.pathname.startsWith('/controls'))
      location.assign(data.impersonating ? '/controls/customers' : '/login');
  }
};
export function beginCustomerTransition() {
  clearCustomerState();
  channel.postMessage('changing');
}
export function finishCustomerTransition(destination: string) {
  stopCollection();
  channel.postMessage({
    changed: true,
    impersonating: Boolean(sessionStorage.getItem(impersonationStorage)),
  });
  window.location.assign(destination);
}
export function cancelCustomerTransition() {
  channel.postMessage({
    changed: true,
    impersonating: Boolean(sessionStorage.getItem(impersonationStorage)),
  });
}
export async function exitImpersonation(csrf?: string) {
  const saved = JSON.parse(
    sessionStorage.getItem(impersonationStorage) ?? 'null',
  );
  beginCustomerTransition();
  try {
    const result = await api<{ destination: string }>(
      '/auth/impersonation/exit',
      {},
      csrf ?? saved?.csrf,
    );
    sessionStorage.removeItem(impersonationStorage);
    finishCustomerTransition(result.destination);
  } catch (error) {
    cancelCustomerTransition();
    throw error;
  }
}
