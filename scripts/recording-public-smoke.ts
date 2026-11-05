import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { projectRoot } from '../apps/api/src/config.js';

// Explicit, project-only production receiver check. This uploads generated noise,
// never a real screen, and does not open a browser or contact analytics vendors.
const origin = 'https://demo.bawebtech.com';
const report: Record<string, unknown> = {
  source: 'generated-fixture',
  startedAt: new Date().toISOString(),
};
let adminCookie = '',
  adminCsrf = '',
  customerCookie = '',
  customerCsrf = '';
let userId = '',
  recordingId = '',
  credential = '';
const browser = randomUUID();
const uuid = (v: unknown) => {
  if (typeof v !== 'string' || !/^[a-f0-9-]{36}$/.test(v))
    throw new Error('Invalid owned fixture ID');
  return v;
};
const check = (condition: boolean, message: string) => {
  if (!condition) {
    report.failure = message;
    throw new Error(message);
  }
};
async function request(
  path: string,
  auth: 'none' | 'admin' | 'customer' | 'bearer',
  body?: unknown,
) {
  if (!path.startsWith('/api/'))
    throw new Error('Receiver check refuses non-API paths');
  const response = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: {
      Origin: origin,
      'X-Browser-Session': browser,
      'X-Demo-Automation': process.env.AUTOMATION_SECRET!,
      ...(auth === 'admin'
        ? { Cookie: adminCookie, 'X-CSRF-Token': adminCsrf }
        : {}),
      ...(auth === 'customer'
        ? { Cookie: customerCookie, 'X-CSRF-Token': customerCsrf }
        : {}),
      ...(auth === 'bearer' ? { Authorization: `Bearer ${credential}` } : {}),
      ...(body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined
      ? {}
      : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
  return response;
}
function imageBody(image: Uint8Array, sequence: number, elapsedMs: number) {
  const body = new FormData();
  body.set('image', new Blob([new Uint8Array(image)]), 'fixture.jpg');
  body.set(
    'metadata',
    JSON.stringify({
      sequence,
      capturedAt: new Date().toISOString(),
      elapsedMs,
      captureMs: 0,
    }),
  );
  return body;
}
try {
  check(
    Boolean(process.env.DEMO_ADMIN_SECRET && process.env.AUTOMATION_SECRET),
    'Private settings required',
  );
  const health = await request('/api/health', 'none');
  check(health.ok, 'API health');
  const login = await request('/api/admin/login', 'none', {
    password: process.env.DEMO_ADMIN_SECRET,
  });
  check(login.ok, 'Admin authentication');
  adminCookie =
    login.headers
      .getSetCookie()
      .find((s) => s.startsWith('softek_admin='))
      ?.split(';')[0] ?? '';
  adminCsrf = (await login.json()).csrf;
  const status = await request('/api/admin/recordings', 'admin');
  check(
    status.ok && (await status.json()).enabled === true,
    'Receiver must be deployed/enabled',
  );
  const username = `test.recording.${randomUUID().slice(0, 16)}`,
    password = randomUUID();
  const created = await request('/api/admin/users', 'admin', {
    username,
    password,
    displayName: 'Automation Screenshot Receiver Check',
    profileId: 'alex',
    variant: 'value',
    eligible: false,
    actor: 'automation',
  });
  check(created.status === 201, 'Owned fixture creation');
  userId = uuid((await created.json()).id);
  report.fixtureId = userId;
  const customer = await request('/api/auth/login', 'none', {
    username,
    password,
    requestId: randomUUID(),
  });
  check(customer.ok, 'Fixture login');
  customerCookie =
    customer.headers
      .getSetCookie()
      .find((s) => s.startsWith('softek_user='))
      ?.split(';')[0] ?? '';
  const state = await request('/api/state', 'customer');
  check(state.ok, 'Fixture state');
  customerCsrf = (await state.json()).csrf;
  const started = await request('/api/recordings', 'customer', {
    requestId: randomUUID(),
    documentId: randomUUID(),
    approvalVersion: 'screenshots-v1',
  });
  check(started.status === 201, 'Receiver creation');
  const session = await started.json();
  recordingId = uuid(session.id);
  report.recordingId = recordingId;
  credential = session.credential;
  const startMono = performance.now();
  const image = await sharp(randomBytes(720 * 1100 * 3), {
    raw: { width: 720, height: 1100, channels: 3 },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
  check(
    image.length > 32_768 && image.length < 1_048_576,
    'Fixture must cross ordinary body limit',
  );
  await new Promise((r) => setTimeout(r, 1000));
  const elapsedMs = Math.round(performance.now() - startMono),
    sequence = Math.floor(elapsedMs / 1000);
  const uploaded = await request(
    `/api/recordings/${recordingId}/frames`,
    'bearer',
    imageBody(image, sequence, elapsedMs),
  );
  check(uploaded.status === 201, 'Public multipart upload');
  report.upload = {
    status: uploaded.status,
    requestImageBytes: image.length,
    sequence,
    elapsedMs,
  };
  const ordinary = await request('/api/recordings', 'customer', {
    oversized: 'x'.repeat(40_000),
  });
  check(ordinary.status === 413, 'Ordinary request limit preserved');
  const apiLarge = await request(
    `/api/recordings/${recordingId}/frames`,
    'bearer',
    imageBody(new Uint8Array(1_048_577), sequence + 1, (sequence + 1) * 1000),
  );
  check(
    apiLarge.status === 413 &&
      apiLarge.headers.get('content-type')?.includes('application/json') ===
        true,
    'API image size limit',
  );
  const proxyLarge = await request(
    `/api/recordings/${recordingId}/frames`,
    'bearer',
    imageBody(new Uint8Array(2_097_153), sequence + 1, (sequence + 1) * 1000),
  );
  check(proxyLarge.status === 413, 'Proxy multipart size limit');
  report.limits = {
    ordinary: ordinary.status,
    apiImage: apiLarge.status,
    proxyMultipart: proxyLarge.status,
  };
  const stop = await request(`/api/recordings/${recordingId}/stop`, 'bearer', {
    phase: 'finish',
    elapsedMs: Math.round(performance.now() - startMono),
    slots: Math.floor((performance.now() - startMono) / 1000),
    reason: 'Stopped',
  });
  check(stop.ok, 'Finalization');
  const manifest = await request(
    `/api/admin/recordings/${recordingId}`,
    'admin',
  );
  check(manifest.ok, 'Admin manifest');
  const details = await manifest.json(),
    frame = details.frames[0];
  check(
    details.recording.user_id === userId,
    'Server-derived recording ownership',
  );
  check(
    details.recording.received_frames === 1 &&
      frame.sequence_number === sequence,
    'Metadata readback',
  );
  const unauthorized = await request(
    `/api/admin/recordings/${recordingId}/frames/${sequence}`,
    'none',
  );
  check(unauthorized.status === 401, 'Private screenshot access');
  const delivered = await request(
    `/api/admin/recordings/${recordingId}/frames/${sequence}`,
    'admin',
  );
  check(
    delivered.ok &&
      delivered.headers.get('cache-control')?.includes('no-store') === true,
    'Authenticated private image',
  );
  const bytes = Buffer.from(await delivered.arrayBuffer());
  check(
    createHash('sha256').update(bytes).digest('hex') === frame.image_hash,
    'Image integrity',
  );
  check(
    Number.isFinite(Date.parse(frame.captured_at)) &&
      Number.isFinite(Date.parse(frame.received_at)),
    'Independent timestamp readback',
  );
  const directory = `/var/lib/softek/recordings/${recordingId}`;
  const fileMode = execFileSync(
    'sudo',
    ['-n', 'stat', '-c', '%a %U:%G', `${directory}/${sequence}.jpg`],
    { encoding: 'utf8' },
  ).trim();
  const directoryMode = execFileSync(
    'sudo',
    ['-n', 'stat', '-c', '%a %U:%G', directory],
    { encoding: 'utf8' },
  ).trim();
  check(
    fileMode === '640 softek:softek' && directoryMode === '750 softek:softek',
    'Private runtime storage ownership and permissions',
  );
  report.storage = { file: fileMode, directory: directoryMode };
  report.readback = {
    frames: 1,
    storedBytes: bytes.length,
    width: frame.width,
    height: frame.height,
    capturedAt: frame.captured_at,
    receivedAt: frame.received_at,
    hashMatched: true,
    unauthorized: unauthorized.status,
    cacheControl: delivered.headers.get('cache-control'),
  };
  report.passed = true;
} catch {
  report.passed = false;
  console.error(
    'Screenshot receiver check failed. Inspect the private report and scoped service logs; no credentials are printed.',
  );
  process.exitCode = 1;
} finally {
  if (recordingId) {
    try {
      report.recordingDeleted = (
        await request(
          `/api/admin/recordings/${recordingId}/delete`,
          'admin',
          {},
        )
      ).ok;
    } catch {
      report.recordingDeleted = false;
    }
  }
  if (userId) {
    try {
      report.fixtureDeleted = (
        await request(`/api/admin/users/${userId}/delete`, 'admin', {})
      ).ok;
    } catch {
      report.fixtureDeleted = false;
    }
  }
  if (adminCookie) {
    try {
      report.adminSessionEnded = (
        await request('/api/admin/logout', 'admin', {})
      ).ok;
    } catch {
      report.adminSessionEnded = false;
    }
  }
  if (
    report.recordingDeleted === false ||
    report.fixtureDeleted === false ||
    report.adminSessionEnded === false
  ) {
    process.exitCode = 1;
    report.passed = false;
    report.cleanupIncomplete = true;
  }
  report.completedAt = new Date().toISOString();
  await mkdir(join(projectRoot, 'artifacts'), { recursive: true, mode: 0o700 });
  await writeFile(
    join(projectRoot, 'artifacts/recording-public-smoke.json'),
    JSON.stringify(report, null, 2) + '\n',
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
}
