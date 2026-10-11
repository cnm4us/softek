export function collectionMode(args: string[]) {
  if (args.some((arg) => arg !== '--clarity') || args.length > 1)
    throw new Error('Only --clarity is supported.');
  const enabled = args.includes('--clarity');
  if (
    enabled &&
    (process.env.CLARITY_CONFIG_VERIFIED !== 'true' ||
      !/^[a-z0-9]{6,30}$/.test(process.env.CLARITY_PROJECT_ID ?? ''))
  )
    throw new Error(
      'Clarity evaluation requires verified project settings and a valid project ID.',
    );
  return enabled;
}
