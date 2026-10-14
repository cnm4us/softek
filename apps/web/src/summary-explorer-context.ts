import type { State } from './api.js';
import type { ContextBanner } from './feature-context.js';
let rendered: {
  userId: string;
  runId: string;
  banner: ContextBanner | null;
  ready: boolean;
} | null = null;
export function setRenderedSummaryBanner(
  state: State,
  banner: ContextBanner | null,
  ready = true,
) {
  rendered = { userId: state.user.id, runId: state.runId, banner, ready };
}
export function clearRenderedSummaryBanner() {
  rendered = null;
}
export function renderedSummaryBanner(state: State) {
  return rendered &&
    rendered.userId === state.user.id &&
    rendered.runId === state.runId &&
    rendered.ready
    ? rendered.banner
    : null;
}
export function summaryBannerPending(state: State) {
  return (
    !rendered ||
    rendered.userId !== state.user.id ||
    rendered.runId !== state.runId ||
    !rendered.ready
  );
}
