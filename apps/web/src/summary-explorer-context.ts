import type { State } from './api';
import type { Banner } from './revision';
let rendered: { userId: string; runId: string; banner: Banner } | null = null;
export function setRenderedSummaryBanner(state: State, banner: Banner | null) {
  rendered = banner
    ? { userId: state.user.id, runId: state.runId, banner }
    : null;
}
export function clearRenderedSummaryBanner() {
  rendered = null;
}
export function renderedSummaryBanner(state: State) {
  return rendered?.userId === state.user.id && rendered.runId === state.runId
    ? rendered.banner
    : null;
}
