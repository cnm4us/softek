const assert = require('node:assert/strict');
const { test } = require('node:test');
const { build } = require('esbuild');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const React = require('react');
let Test;

global.IS_REACT_ACT_ENVIRONMENT = true;
const site = 'https://demo.bawebtech.com/';

async function mount(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'softek-native-test-'));
  const outfile = join(directory, 'app.cjs');
  const ports = {
    opened: [],
    injected: [],
    back: 0,
    reload: 0,
    rejectBrowser: false,
    storageReady: true,
    requests: [],
    disposedFrames: [],
    webMounts: 0,
    webUnmounts: 0,
    ...options,
  };
  global.__softekNative = ports;
  try {
    await build({
      stdin: {
        contents:
          "export {default as App} from './App';export {default as Test} from 'react-test-renderer';",
        resolveDir: resolve(__dirname, '../..'),
        loader: 'tsx',
      },
      outfile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      jsx: 'automatic',
      define: {
        'process.env.EXPO_PUBLIC_WINDOW_CAPTURE': JSON.stringify(
          options.windowCapture ? '1' : '0',
        ),
        'process.env.EXPO_PUBLIC_OVERLAY_CHECK': JSON.stringify(
          options.overlayCheck ? '1' : '0',
        ),
        'process.env.EXPO_PUBLIC_CAPTURE_CHECK': JSON.stringify(
          options.captureCheck ? '1' : '0',
        ),
      },
      logLevel: 'silent',
      plugins: [
        {
          name: 'native-boundaries',
          setup(bundle) {
            bundle.onResolve(
              {
                filter:
                  /^\.\/(?:src\/)?(capture-file|recording-request|overlay-capture)$/,
              },
              () => ({
                path: 'probe',
                namespace: 'probe-stub',
              }),
            );
            bundle.onLoad({ filter: /.*/, namespace: 'probe-stub' }, () => ({
              contents: `exports.CaptureFileError=class extends Error {};
                 exports.overlayAvailable=true;exports.prepareOverlayCapture=async()=>true;exports.captureOverlay=async()=>({uri:'file:///candidate.jpg',bytes:1234,width:720,height:1000,dispose:()=>{global.__softekNative.disposedFrames.push('candidate');}});
                 exports.clearCaptureFiles=()=>global.__softekNative.storageReady;
                 exports.captureFile=async()=>{if(global.__softekNative.captureFailure)throw new exports.CaptureFileError('Capture copy: file permission denied');return {uri:'file:///fixture.jpg',bytes:1234,dispose:()=>{global.__softekNative.disposedFrames.push('baseline');}};};
                 exports.recordingRequest=async()=>{global.__softekNative.requests.push('upload');return {ok:true,status:200};};`,
            }));
            bundle.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({
              path: require.resolve(args.path),
              external: true,
            }));
            bundle.onResolve(
              {
                filter:
                  /^(react-native|react-native-safe-area-context|react-native-webview)$/,
              },
              (args) => ({ path: args.path, namespace: 'native-stub' }),
            );
            bundle.onLoad(
              { filter: /.*/, namespace: 'native-stub' },
              (args) => ({
                loader: 'js',
                resolveDir: resolve(__dirname, '../..'),
                contents:
                  args.path === 'react-native'
                    ? `module.exports = {
            View:'View', Text:'Text', Pressable:'Pressable', StatusBar:'StatusBar', ActivityIndicator:'ActivityIndicator', Modal:'Modal', Image:'Image', ScrollView:'ScrollView',
            AppState:{currentState:'active',addEventListener:()=>({remove:()=>{}})},
            StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',top:0,right:0,bottom:0,left:0}},
            Linking:{openURL:async url=>{if(global.__softekNative.rejectBrowser)throw Error('unavailable');global.__softekNative.opened.push(url);}}
          };`
                    : args.path === 'react-native-safe-area-context'
                      ? `module.exports={SafeAreaProvider:'SafeAreaProvider',SafeAreaView:'SafeAreaView'};`
                      : `const R=require('react');module.exports={WebView:R.forwardRef((props,ref)=>{
            R.useEffect(()=>{const p=global.__softekNative;p.webMounts++;return()=>p.webUnmounts++;},[]);
            R.useImperativeHandle(ref,()=>({goBack:()=>global.__softekNative.back++,reload:()=>global.__softekNative.reload++,injectJavaScript:s=>global.__softekNative.injected.push(s)}));
            return R.createElement('WebView',props);
          })};`,
              }),
            );
          },
        },
      ],
    });
    // Bundle the renderer against the mobile workspace's React, not the website's
    // independently versioned React hoisted at the repository root.
    const exports = require(outfile);
    const App = exports.App;
    Test = exports.Test;
    let root;
    await Test.act(async () => {
      root = Test.create(React.createElement(App));
    });
    return {
      root,
      ports,
      web: () => root.root.findByType('WebView'),
      button: (name) =>
        root.root
          .findAllByType('Pressable')
          .find((n) => n.props.accessibilityLabel === name),
      event: async (name, payload) => {
        const props = root.root.findByType('WebView').props;
        await Test.act(async () => props[name](payload));
      },
      close: async () => {
        await Test.act(async () => root.unmount());
        rmSync(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

test('actual shell preserves website source, history controls, and explicit reload', async () => {
  const app = await mount();
  try {
    assert.deepEqual(app.web().props.source, { uri: site, method: 'GET' });
    assert.equal(app.web().props.incognito, true);
    assert.equal(app.web().props.sharedCookiesEnabled, false);
    assert.equal(app.button('Back').props.disabled, true);
    assert.equal(typeof app.web().props.onMessage, 'function');
    assert.equal(app.web().props.injectedJavaScript, undefined);
    await app.event('onNavigationStateChange', { canGoBack: true });
    await Test.act(async () => app.button('Back').props.onPress());
    await Test.act(async () => app.button('Reload').props.onPress());
    assert.equal(app.ports.back, 1);
    assert.equal(app.ports.reload, 1);
  } finally {
    await app.close();
  }
});

test('capture-check profile opens only the local fixture and displays the capture failure stage', async () => {
  const app = await mount({ captureCheck: true, captureFailure: true });
  try {
    assert.equal(app.web().props.source.uri, undefined);
    assert.match(app.web().props.source.html, /LOCAL CAPTURE FIXTURE/);
    assert.equal(app.button('Reload'), undefined);
    assert.equal(app.button('Start check').props.disabled, true);
    await app.event('onLoadEnd');
    assert.equal(app.button('Start check').props.disabled, false);
    await Test.act(async () => app.button('Start check').props.onPress());
    await Test.act(
      async () => new Promise((resolve) => setTimeout(resolve, 1200)),
    );
    const status = app.root.root
      .findAllByType('Text')
      .find((node) => node.props.accessibilityRole === 'alert');
    assert.match(status.props.children.join(''), /0 screenshots captured/);
    assert.match(
      status.props.children.join(''),
      /Capture copy: file permission denied/,
    );
    assert.equal(app.button('Review latest screenshots').props.disabled, true);
    assert.deepEqual(app.ports.requests, []);
  } finally {
    await app.close();
  }
});

test('actual shell separates main HTTP failure from API errors; retry starts a fresh home GET', async () => {
  const app = await mount();
  try {
    await app.event('onLoadStart', { nativeEvent: { url: site + 'explore' } });
    await app.event('onHttpError', {
      nativeEvent: { url: site + 'api/state', statusCode: 401 },
    });
    assert.equal(app.button('Try again'), undefined);
    const lateLoadEnd = app.web().props.onLoadEnd;
    await app.event('onHttpError', {
      nativeEvent: { url: site + 'explore', statusCode: 503 },
    });
    await Test.act(async () => lateLoadEnd());
    assert.equal(app.root.root.findAllByType('WebView').length, 1);
    assert.ok(app.button('Try again'));
    await Test.act(async () => app.button('Try again').props.onPress());
    assert.equal(new URL(app.web().props.source.uri).pathname, '/');
    assert.equal(app.web().props.source.method, 'GET');
    assert.equal(app.ports.webMounts, 1);
    assert.equal(app.ports.webUnmounts, 0);
    assert.equal(app.ports.reload, 0);
    assert.equal(app.button('Back').props.disabled, true);
  } finally {
    await app.close();
  }
});

test('slow or terminated WebViews show manual recovery without automatic reload', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const app = await mount();
  try {
    await app.event('onLoadStart', { nativeEvent: { url: site } });
    await Test.act(async () => t.mock.timers.tick(25_000));
    assert.ok(app.button('Try again'));
    await Test.act(async () => app.button('Try again').props.onPress());
    await app.event('onContentProcessDidTerminate');
    assert.ok(app.button('Try again'));
    assert.equal(app.ports.reload, 0);
    assert.equal(app.ports.webMounts, 1);
    await Test.act(async () => app.button('Try again').props.onPress());
    assert.equal(app.ports.webMounts, 2);
    assert.equal(app.ports.webUnmounts, 1);
  } finally {
    await app.close();
    t.mock.timers.reset();
  }
});

test('connection failures and repeated retries preserve the mounted temporary WebView', async () => {
  const app = await mount();
  const content = () =>
    app.root.root
      .findAllByType('View')
      .find((node) => 'accessibilityElementsHidden' in node.props);
  try {
    await app.event('onLoadEnd');
    let lastSource = site;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const scriptsBeforeFailure = app.ports.injected.length;
      await app.event('onError', {
        nativeEvent: { domain: 'NSURLErrorDomain', code: -1009 },
      });
      await app.event('onLoadEnd'); // iOS emits loadEnd after failure too.
      assert.equal(app.ports.injected.length, scriptsBeforeFailure);
      assert.ok(app.button('Try again'));
      assert.equal(content().props.accessibilityElementsHidden, true);
      assert.equal(content().props.pointerEvents, 'none');
      assert.equal(app.ports.webMounts, 1);
      assert.equal(app.ports.webUnmounts, 0);
      assert.equal(app.web().props.source.uri, lastSource); // No automatic retry.
      await Test.act(async () => app.button('Try again').props.onPress());
      const source = app.web().props.source;
      const url = new URL(source.uri);
      assert.equal(url.origin, new URL(site).origin);
      assert.equal(url.pathname, '/');
      assert.equal(url.searchParams.get('_softek_retry'), String(attempt));
      assert.notEqual(source.uri, lastSource);
      assert.equal(source.method, 'GET');
      assert.equal(source.body, undefined);
      assert.equal(app.web().props.incognito, true);
      assert.equal(app.web().props.sharedCookiesEnabled, false);
      assert.equal(app.ports.webMounts, 1);
      assert.equal(app.ports.webUnmounts, 0);
      lastSource = source.uri;
      await app.event('onLoadStart', { nativeEvent: { url: source.uri } });
      await app.event('onLoadEnd');
      assert.equal(app.button('Try again'), undefined);
      assert.equal(content().props.accessibilityElementsHidden, false);
      assert.equal(app.ports.reload, 0);
    }
  } finally {
    await app.close();
  }
});

test('connection recovery invalidates the recording and does not restart it on the retained view', async () => {
  const app = await mount();
  try {
    await app.event('onLoadEnd');
    const documentId = JSON.parse(
      app.ports.injected.at(-1).match(/const id=("[^"]+")/)[1],
    );
    const send = (message) =>
      app.event('onMessage', {
        nativeEvent: {
          url: site,
          data: JSON.stringify({
            ...message,
            protocol: 'softek-capture-v1',
            documentId,
          }),
        },
      });
    await send({ type: 'hello' });
    await send({ type: 'eligibility', allowed: true, generation: 1 });
    const start = {
      type: 'start',
      recordingId: '01234567-89ab-4cde-8fab-0123456789ab',
      credential: 'a'.repeat(64),
      generation: 1,
    };
    await send(start);
    assert.match(app.ports.injected.at(-1), /"phase":"recording"/);
    await app.event('onError', { nativeEvent: { code: -1009 } });
    const failureBoundary = app.ports.injected.length;
    await Test.act(async () => app.button('Try again').props.onPress());
    await app.event('onLoadStart', {
      nativeEvent: { url: app.web().props.source.uri },
    });
    await app.event('onLoadEnd');
    await send(start);
    assert.doesNotMatch(
      app.ports.injected.slice(failureBoundary).join(''),
      /"phase":"recording"/,
    );
    assert.equal(app.ports.webMounts, 1);
    assert.equal(app.ports.webUnmounts, 0);
  } finally {
    await app.close();
  }
});

test('actual navigation handlers block redirects and schemes, open tapped HTTPS links, and handle popups', async () => {
  const app = await mount();
  try {
    const navigate = async (url, navigationType) => {
      let allowed;
      await Test.act(async () => {
        allowed = app.web().props.onShouldStartLoadWithRequest({
          url,
          navigationType,
          isTopFrame: true,
        });
      });
      return allowed;
    };
    assert.equal(await navigate(site + 'explore', 'other'), true);
    assert.equal(await navigate('https://example.com/', 'other'), false);
    assert.equal(await navigate('javascript:alert(1)', 'click'), false);
    assert.deepEqual(app.ports.opened, []);
    assert.equal(await navigate('https://example.com/', 'click'), false);
    assert.deepEqual(app.ports.opened, ['https://example.com/']);
    await app.event('onOpenWindow', {
      nativeEvent: { targetUrl: site + 'about' },
    });
    assert.deepEqual(app.web().props.source, {
      uri: site + 'about',
      method: 'GET',
    });
    await app.event('onOpenWindow', {
      nativeEvent: { targetUrl: 'data:text/html,test' },
    });
    assert.deepEqual(app.web().props.source, {
      uri: site + 'about',
      method: 'GET',
    });
    app.ports.rejectBrowser = true;
    await navigate('https://example.org/', 'click');
    assert.ok(app.button('Dismiss'));
  } finally {
    await app.close();
  }
});

test('actual shell bootstraps recording per document and invalidates old messages on reload', async () => {
  const app = await mount();
  try {
    await app.event('onLoadStart', { nativeEvent: { url: site } });
    await app.event('onLoadEnd');
    const boot = app.ports.injected.at(-1);
    assert.match(boot, /window.top!==window/);
    const documentId = JSON.parse(boot.match(/const id=("[^"]+")/)[1]);
    const send = async (message, url = site) =>
      app.event('onMessage', {
        nativeEvent: {
          url,
          data: JSON.stringify({
            ...message,
            protocol: 'softek-capture-v1',
            documentId,
          }),
        },
      });
    await send({ type: 'hello' });
    await send({ type: 'eligibility', allowed: true, generation: 1 });
    await send({
      type: 'start',
      recordingId: '01234567-89ab-4cde-8fab-0123456789ab',
      credential: 'a'.repeat(64),
      generation: 1,
    });
    assert.match(app.ports.injected.at(-1), /"phase":"recording"/);
    await Test.act(async () => app.button('Back').props.onPress());
    assert.match(app.ports.injected.at(-1), /"phase":"recording"/);
    await Test.act(async () => app.button('Reload').props.onPress());
    await send({
      type: 'start',
      recordingId: '01234567-89ab-4cde-8fab-0123456789ab',
      credential: 'a'.repeat(64),
      generation: 1,
    });
    assert.doesNotMatch(app.ports.injected.at(-1), /"phase":"recording"/);
  } finally {
    await app.close();
  }
});

test('unavailable recording cache keeps the banking WebView and navigation usable', async () => {
  const app = await mount({ storageReady: false });
  try {
    assert.deepEqual(app.web().props.source, { uri: site, method: 'GET' });
    assert.ok(app.button('Dismiss'));
    await Test.act(async () => app.button('Reload').props.onPress());
    assert.equal(app.ports.reload, 1);
  } finally {
    await app.close();
  }
});

test('overlay-check build opens only the local fictional comparison with uploads inactive', async () => {
  const m = await mount({ overlayCheck: true });
  try {
    const web = m.root.root.findByType('WebView');
    assert.ok(web.props.source.html.includes('id="name" required'));
    assert.ok(web.props.source.html.includes("addEventListener('invalid'"));
    assert.ok(
      m.root.root
        .findAllByType('Text')
        .some((n) => n.props.children === 'Local tooltip comparison'),
    );
    assert.deepEqual(m.ports.requests, []);
    assert.equal(
      web.props.onShouldStartLoadWithRequest({
        url: 'https://demo.bawebtech.com/',
      }),
      false,
    );
    await Test.act(async () => {
      web.props.onLoadEnd();
    });
    const start = m.root.root
      .findAllByType('Pressable')
      .find((n) => n.props.accessibilityLabel === 'Start local check');
    assert.equal(start.props.disabled, false);
    await Test.act(async () => {
      start.props.onPress();
    });
    const stop = m.root.root
      .findAllByType('Pressable')
      .find((n) => n.props.accessibilityLabel === 'Stop');
    assert.equal(stop.props.disabled, false);
    await Test.act(async () => {
      stop.props.onPress();
    });
    assert.deepEqual(m.ports.requests, []);
  } finally {
    await m.close();
  }
});

test('Clear & reset deletes review files, reloads an empty fixture and rejects its stale events without restarting capture', async () => {
  const app = await mount({ overlayCheck: true });
  try {
    await app.event('onLoadEnd');
    await Test.act(async () => app.button('Start local check').props.onPress());
    await Test.act(
      async () => new Promise((resolve) => setTimeout(resolve, 400)),
    );
    assert.equal(app.root.root.findAllByType('Image').length, 2);
    const previous = app.web().props;
    await Test.act(async () => app.button('Clear & reset').props.onPress());
    assert.equal(app.root.root.findAllByType('Image').length, 0);
    assert.deepEqual(app.ports.disposedFrames.sort(), [
      'baseline',
      'candidate',
    ]);
    assert.equal(app.ports.webMounts, 2);
    assert.equal(app.ports.webUnmounts, 1);
    assert.equal(app.button('Review').props.disabled, true);
    assert.equal(app.button('Start local check').props.disabled, true);
    assert.equal(app.button('Stop').props.disabled, true);
    await Test.act(async () => previous.onLoadEnd());
    assert.equal(
      app.button('Start local check').props.disabled,
      true,
      'Old document cannot mark the fresh fixture ready',
    );
    await app.event('onLoadEnd');
    assert.equal(app.button('Start local check').props.disabled, false);
    assert.equal(app.button('Stop').props.disabled, true);
    await Test.act(async () => app.button('Start local check').props.onPress());
    await Test.act(async () =>
      previous.onMessage({
        nativeEvent: {
          url: 'about:blank',
          data: JSON.stringify({
            type: 'softek-overlay-check',
            kind: 'invalid',
          }),
        },
      }),
    );
    await Test.act(
      async () => new Promise((resolve) => setTimeout(resolve, 400)),
    );
    const labels = app.root.root
      .findAllByType('Text')
      .map((n) => JSON.stringify(n.props.children))
      .join(' ');
    assert.ok(labels.includes('Test ') && labels.includes('View baseline'));
    assert.ok(
      !labels.includes('invalid'),
      'An old fixture message cannot trigger capture in the new test',
    );
    assert.equal(app.root.root.findAllByType('Image').length, 2);
    const reviewLabels = app.root.root
      .findAllByType('Text')
      .map((n) => React.Children.toArray(n.props.children).join(''));
    assert.ok(
      reviewLabels.some((label) =>
        /Test 2.*Pair 1.*View baseline.*ui/.test(label),
      ),
      'The fresh test is labeled separately and restarts at Pair 1',
    );
    await Test.act(async () => app.button('Stop').props.onPress());
    const scrollBefore = app.root.root.findByType('ScrollView');
    await Test.act(async () => app.button('Review').props.onPress());
    assert.notEqual(
      app.root.root.findByType('ScrollView'),
      scrollBefore,
      'Review remounts at the beginning',
    );
    await Test.act(async () =>
      app.root.root
        .findAllByType('Pressable')
        .filter((n) => n.props.accessibilityLabel === 'Clear & reset')[1]
        .props.onPress(),
    );
    assert.equal(app.root.root.findAllByType('Image').length, 0);
    assert.equal(app.button('Stop').props.disabled, true);
    assert.deepEqual(app.ports.requests, []);
  } finally {
    await app.close();
  }
});

test('experimental banking preview advertises optional native tooltip capture while leaving the normal entry intact', async () => {
  const app = await mount({ windowCapture: true });
  try {
    assert.deepEqual(app.web().props.source, { uri: site, method: 'GET' });
    await app.event('onLoadEnd');
    assert.ok(
      app.ports.injected.some((script) => script.includes('window-crop-v1')),
    );
    assert.deepEqual(app.ports.requests, []);
  } finally {
    await app.close();
  }
});
