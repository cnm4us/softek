export type LoadState = { loading: boolean; error: string | null };
export const initialLoad: LoadState = { loading: true, error: null };
export const LOAD_TIMEOUT_MS = 25_000;
export const CONNECTION_ERROR =
  'The demo could not load. Check your connection, then try again.';
export const PROCESS_ERROR =
  'The demo view closed. Try again to return to the demo.';

export function loadState(
  state: LoadState,
  event:
    | { type: 'start' }
    | { type: 'finish' }
    | { type: 'fail'; message: string }
    | { type: 'retry' },
): LoadState {
  if (event.type === 'start' || event.type === 'retry') return initialLoad;
  if (event.type === 'fail') return { loading: false, error: event.message };
  // WebView sends loadEnd after both success and failure. Keep a failure visible.
  return { ...state, loading: false };
}
