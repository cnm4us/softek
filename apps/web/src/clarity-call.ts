// Invocation fidelity is independent of the audit transport and SDK replacement.
export function invokeClarity(
  host: { clarity?: ((...args: any[]) => any) & { q?: unknown } },
  command: string,
  args: unknown[],
  record: (snapshot: {
    command: string;
    args: unknown[];
    sdkState: 'queued' | 'loaded' | 'absent';
    outcome: 'returned' | 'threw' | 'absent';
    durationUs: number;
  }) => void,
  omitted: () => void = () => {},
) {
  const fn = host.clarity;
  const sdkState = fn ? (fn.q ? 'queued' : 'loaded') : 'absent';
  let snapshot: unknown[] | null = null;
  try {
    snapshot = JSON.parse(JSON.stringify(args));
  } catch {
    /* Audit serialization cannot change the invocation. */
  }
  const start = performance.now();
  let outcome: 'returned' | 'threw' | 'absent' = fn ? 'returned' : 'absent';
  try {
    return fn?.apply(host, [command, ...args]);
  } catch (e) {
    outcome = 'threw';
    throw e;
  } finally {
    try {
      if (snapshot)
        record({
          command,
          args: snapshot,
          sdkState,
          outcome,
          durationUs: Math.min(
            10000000,
            Math.max(0, Math.round((performance.now() - start) * 1000)),
          ),
        });
      else omitted();
    } catch {
      /* Never replace the original return or exception. */
    }
  }
}
