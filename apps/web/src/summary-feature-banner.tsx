import { useEffect, useRef, useState } from 'react';
import { api, type State } from './api';
import { ImageBanner, type Banner } from './revision';
import { BannerPlaceholder } from './ui';
const startsOnSummary = location.pathname === '/';
let summaryInitialized = false;
const storage = 'softek_explorer_summary';
export function SummaryFeatureBanner({ state }: { state: State }) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [resolved, setResolved] = useState(false);
  const selection = useRef<Promise<Banner | null> | null>(null);
  useEffect(() => {
    let current = true;
    if (!selection.current) {
      let saved: {
        userId: string;
        runId: string;
        banner: Banner | null;
      } | null = null;
      try {
        saved = JSON.parse(sessionStorage.getItem(storage) ?? 'null');
      } catch {
        /* Recover an invalid cache. */
      }
      const owned =
        saved?.userId === state.user.id && saved.runId === state.runId
          ? saved.banner
          : null;
      const advance =
        !state.impersonation &&
        !summaryInitialized &&
        (startsOnSummary || !owned);
      summaryInitialized = true;
      selection.current = api<Banner | null>(
        '/feature-explorer/summary/select',
        {
          requestId: crypto.randomUUID(),
          advance,
          ...(!advance && owned?.id ? { selectionId: owned.id } : {}),
        },
        state.csrf,
      )
        .then((selected) => {
          sessionStorage.setItem(
            storage,
            JSON.stringify({
              userId: state.user.id,
              runId: state.runId,
              banner: selected,
            }),
          );
          return selected;
        })
        .catch(() => null);
    }
    void selection.current.then((selected) => {
      if (current) {
        setBanner(selected);
        setResolved(true);
      }
    });
    return () => {
      current = false;
    };
  }, [state.user.id, state.runId]);
  return resolved ? (
    <ImageBanner
      key={banner?.id ?? 'empty'}
      state={state}
      banner={banner}
      compact
    />
  ) : (
    <BannerPlaceholder />
  );
}
