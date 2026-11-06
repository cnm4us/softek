import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { projectRoot } from '../apps/api/src/config.js';

// Explicit, project-only production receiver check. This uploads generated noise,
// never a real screen, and does not open a browser or contact analytics vendors.
const origin = 'https://demo.bawebtech.com';
const canvas = process.argv.includes('--canvas');
const automatic = process.argv.includes('--auto-replay');
const windowCapture = canvas || process.argv.includes('--window');
const changes =
  automatic || windowCapture || process.argv.includes('--changes');
if (
  process.argv
    .slice(2)
    .some(
      (a) =>
        !['--changes', '--window', '--canvas', '--auto-replay'].includes(a),
    )
)
  throw new Error(
    'Only --changes, --window, --canvas and --auto-replay are supported.',
  );
const geometry = {
  route: '/',
  width: 720,
  height: 1100,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  scrollX: 0,
  scrollY: 0,
  container: 'document',
  containerX: 0,
  containerY: 0,
};
const report: Record<string, unknown> = {
  source: 'generated-fixture',
  startedAt: new Date().toISOString(),
  policy: changes ? 'changes-v2' : 'periodic-v1',
  captureMethod: windowCapture ? 'window-crop-v1' : 'view-v1',
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
      ...(changes
        ? {
            context: {
              reason: sequence === 1 ? 'start' : 'ui',
              geometry,
              uncertaintyMs: 1,
              unstable: false,
              ...(canvas
                ? {
                    page: {
                      version: 1,
                      web: {
                        version: 1,
                        visit: 1,
                        layout: 1,
                        documentWidth: 720,
                        documentHeight: 2000,
                        clientWidth: 720,
                        clientHeight: 1100,
                        scrollX: 0,
                        scrollY: 0,
                        fontSize: 16,
                        lineHeight: 24,
                        layer: 'document',
                        top: true,
                        bottom: false,
                      },
                      image: {
                        width: 720,
                        height: 1100,
                        valid: { x: 0, y: 0, width: 720, height: 700 },
                        excluded: [{ x: 0, y: 700, width: 720, height: 400 }],
                      },
                    },
                  }
                : {}),
              ...(windowCapture
                ? {
                    surface: {
                      method: 'window-crop-v1',
                      maskedKeyboard: true,
                      anchoredPopover: !automatic,
                    },
                  }
                : {}),
            },
          }
        : {}),
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
    ...(changes
      ? {
          approvalVersion: windowCapture
            ? canvas
              ? 'screenshots-window-canvas-v1'
              : 'screenshots-window-v1'
            : 'screenshots-v2',
          policy: 'changes-v2',
        }
      : {}),
  });
  check(started.status === 201, 'Receiver creation');
  const session = await started.json();
  if (canvas)
    check(session.pageContextVersion === 1, 'Page context negotiation');
  recordingId = uuid(session.id);
  report.recordingId = recordingId;
  credential = session.credential;
  const startMono = performance.now();
  const pixels = sharp(randomBytes(720 * 1100 * 3), {
    raw: { width: 720, height: 1100, channels: 3 },
  });
  if (automatic && canvas)
    pixels.composite([
      {
        input: Buffer.from(
          '<svg width="720" height="400"><rect width="720" height="400" fill="#f5f6f1"/></svg>',
        ),
        left: 0,
        top: 700,
      },
    ]);
  const image = await pixels.jpeg({ quality: 70 }).toBuffer();
  check(
    image.length > 32_768 && image.length < 1_048_576,
    'Fixture must cross ordinary body limit',
  );
  await new Promise((r) => setTimeout(r, 1000));
  const elapsedMs = changes ? 100 : Math.round(performance.now() - startMono),
    sequence = changes ? 1 : Math.floor(elapsedMs / 1000);
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
  if (changes) {
    const second = await request(
      `/api/recordings/${recordingId}/frames`,
      'bearer',
      imageBody(image, 2, 600),
    );
    check(second.status === 201, 'Same-second second capture');
    const batch = {
      requestId: randomUUID(),
      events: [
        {
          sequence: 1,
          elapsedMs: 500,
          kind: 'tap',
          geometry,
          uncertaintyMs: 1,
          x: 0.25,
          y: 0.5,
        },
        {
          sequence: 2,
          elapsedMs: 650,
          kind: 'scroll',
          geometry,
          uncertaintyMs: 1,
        },
      ],
    };
    const events = await request(
      `/api/recordings/${recordingId}/events`,
      'bearer',
      batch,
    );
    check(events.status === 201, 'Public event upload');
    check(
      (await request(`/api/recordings/${recordingId}/events`, 'bearer', batch))
        .status === 200,
      'Event retry deduplicates',
    );
    check(
      (await request(`/api/admin/recordings/${recordingId}/events`, 'none'))
        .status === 401,
      'Private interaction access',
    );
    const reviewed = await request(
      `/api/admin/recordings/${recordingId}/events`,
      'admin',
    );
    check(
      reviewed.ok && (await reviewed.json()).events.length === 2,
      'Private interaction readback',
    );
    report.interactions = {
      received: 2,
      retryDeduplicated: true,
      anonymousDenied: true,
    };
  }
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
  if (automatic && canvas) {
    execFileSync('sudo', [
      '-n',
      '-u',
      'softek',
      'python3',
      '-c',
      "import pathlib,sys;p=pathlib.Path(sys.argv[1]);p.mkdir(mode=0o750);(p/'abandoned').write_text('owned smoke workspace')",
      `/var/lib/softek/recordings/${recordingId}/.replay-work`,
    ]);
    report.recoveredWorkspaceSeeded = true;
  }
  const stop = await request(`/api/recordings/${recordingId}/stop`, 'bearer', {
    phase: 'finish',
    elapsedMs: Math.round(performance.now() - startMono),
    slots: changes ? 2 : Math.floor((performance.now() - startMono) / 1000),
    reason: 'Stopped',
    ...(changes ? { events: 2, coalesced: 1, lostEvents: 0 } : {}),
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
    details.recording.received_frames === (changes ? 2 : 1) &&
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
  if (windowCapture)
    check(
      details.recording.capture_method === 'window-crop-v1' &&
        frame.context?.surface?.anchoredPopover === !automatic &&
        frame.context?.surface?.maskedKeyboard === true,
      'Window provenance readback',
    );
  if (canvas)
    check(
      frame.context?.page?.version === 1 &&
        frame.context.page.image.valid.height === 700,
      'Page context private readback',
    );
  report.storage = { file: fileMode, directory: directoryMode };
  report.readback = {
    frames: changes ? 2 : 1,
    storedBytes: bytes.length,
    width: frame.width,
    height: frame.height,
    capturedAt: frame.captured_at,
    receivedAt: frame.received_at,
    hashMatched: true,
    unauthorized: unauthorized.status,
    cacheControl: delivered.headers.get('cache-control'),
  };
  if (automatic) {
    const states = new Set<string>();
    let ready = details;
    const deadline = performance.now() + 90_000;
    while (!ready.replay && performance.now() < deadline) {
      if (ready.replayJob?.state) states.add(ready.replayJob.state);
      check(
        ready.replayJob?.state !== 'failed',
        'Automatic render must not fail',
      );
      await new Promise((r) => setTimeout(r, 1000));
      const r = await request(`/api/admin/recordings/${recordingId}`, 'admin');
      check(r.ok, 'Automatic status readback');
      ready = await r.json();
    }
    check(
      ready.replayJob?.state === 'ready' && !!ready.replay,
      'Automatic generation completes without an operator render',
    );
    check(
      ready.replay.full.fps === 30 && ready.replay.sample.fps === 30,
      'Automatic replay reports 30 fps',
    );
    if (canvas) {
      const preview = ready.replay.sessionReference?.preview;
      check(
        preview?.coverageStatus === 'partial' &&
          preview.topReached &&
          !preview.bottomReached &&
          preview.coveragePercent > 0 &&
          preview.coveragePercent < 100,
        'Automatic native-context reference preserves partial coverage',
      );
      const r = await request(
        `/api/admin/recordings/${recordingId}/page-references/${preview.page}`,
        'admin',
      );
      check(r.ok, 'Automatically generated private page preview');
      await r.arrayBuffer();
      report.automaticReference = preview;
    }
    const verified: Record<string, unknown>[] = [];
    for (const name of ['sample.mp4', 'full.mp4']) {
      const path = `/api/admin/recordings/${recordingId}/replay/${name}`;
      check(
        (await request(path, 'none')).status === 401,
        'Automatic video remains private',
      );
      const r = await request(path, 'admin');
      check(
        r.ok && r.headers.get('cache-control')?.includes('no-store') === true,
        'Private automatic video delivery',
      );
      const bytes = Buffer.from(await r.arrayBuffer());
      const temporary = join(
        projectRoot,
        'artifacts',
        `auto-replay-${recordingId}-${name}`,
      );
      try {
        await writeFile(temporary, bytes, { mode: 0o600 });
        const probe = JSON.parse(
          execFileSync(
            'ffprobe',
            [
              '-v',
              'error',
              '-select_streams',
              'v:0',
              '-show_entries',
              'stream=r_frame_rate:format=duration',
              '-of',
              'json',
              temporary,
            ],
            { encoding: 'utf8' },
          ),
        );
        check(
          probe.streams[0].r_frame_rate === '30/1',
          'Encoded automatic video is 30 fps',
        );
        execFileSync(
          'ffmpeg',
          ['-v', 'error', '-i', temporary, '-f', 'null', '-'],
          { stdio: 'ignore' },
        );
        if (name === 'full.mp4')
          check(
            Math.abs(
              Number(probe.format.duration) * 1000 -
                ready.recording.stop_elapsed_ms,
            ) <=
              1000 / 30 + 1,
            'Automatic full duration preserves Stop',
          );
        verified.push({
          name,
          bytes: bytes.length,
          fps: probe.streams[0].r_frame_rate,
          duration: Number(probe.format.duration),
        });
      } finally {
        await rm(temporary, { force: true });
      }
    }
    report.automaticReplay = {
      states: [...states, 'ready'],
      attempts: ready.replayJob.attempts,
      files: verified,
      manualRenderInvoked: false,
    };
  }
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
    join(
      projectRoot,
      automatic && canvas
        ? 'artifacts/recording-public-auto-canvas-smoke.json'
        : automatic
          ? 'artifacts/recording-public-auto-replay-smoke.json'
          : canvas
            ? 'artifacts/recording-public-canvas-smoke.json'
            : windowCapture
              ? 'artifacts/recording-public-window-smoke.json'
              : changes
                ? 'artifacts/recording-public-changes-smoke.json'
                : 'artifacts/recording-public-smoke.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
}
