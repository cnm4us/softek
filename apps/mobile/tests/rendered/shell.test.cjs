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

async function mount() {
  const directory = mkdtempSync(join(tmpdir(), 'softek-native-test-'));
  const outfile = join(directory, 'app.cjs');
  const ports = { opened: [], back: 0, reload: 0, rejectBrowser: false };
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
      logLevel: 'silent',
      plugins: [
        {
          name: 'native-boundaries',
          setup(bundle) {
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
            View:'View', Text:'Text', Pressable:'Pressable', StatusBar:'StatusBar', ActivityIndicator:'ActivityIndicator',
            StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',top:0,right:0,bottom:0,left:0}},
            Linking:{openURL:async url=>{if(global.__softekNative.rejectBrowser)throw Error('unavailable');global.__softekNative.opened.push(url);}}
          };`
                    : args.path === 'react-native-safe-area-context'
                      ? `module.exports={SafeAreaProvider:'SafeAreaProvider',SafeAreaView:'SafeAreaView'};`
                      : `const R=require('react');module.exports={WebView:R.forwardRef((props,ref)=>{
            R.useImperativeHandle(ref,()=>({goBack:()=>global.__softekNative.back++,reload:()=>global.__softekNative.reload++}));
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
    assert.deepEqual(app.web().props.source, { uri: site });
    assert.equal(app.web().props.incognito, true);
    assert.equal(app.web().props.sharedCookiesEnabled, false);
    assert.equal(app.button('Back').props.disabled, true);
    assert.equal(app.web().props.onMessage, undefined);
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
    assert.equal(app.root.root.findAllByType('WebView').length, 0);
    assert.ok(app.button('Try again'));
    await Test.act(async () => app.button('Try again').props.onPress());
    assert.deepEqual(app.web().props.source, { uri: site });
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
  } finally {
    await app.close();
    t.mock.timers.reset();
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
    assert.deepEqual(app.web().props.source, { uri: site + 'about' });
    await app.event('onOpenWindow', {
      nativeEvent: { targetUrl: 'data:text/html,test' },
    });
    assert.deepEqual(app.web().props.source, { uri: site + 'about' });
    app.ports.rejectBrowser = true;
    await navigate('https://example.org/', 'click');
    assert.ok(app.button('Dismiss'));
  } finally {
    await app.close();
  }
});
