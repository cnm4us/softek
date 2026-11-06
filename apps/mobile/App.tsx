import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  CONNECTION_ERROR,
  initialLoad,
  LOAD_TIMEOUT_MS,
  loadState,
  PROCESS_ERROR,
} from './src/load-state';
import {
  destination,
  navigationAction,
  sameDocument,
  SITE_URL,
} from './src/navigation';
import { colors } from './src/theme';
import { captureFile, clearCaptureFiles } from './src/capture-file';
import { RecordingController } from './src/recording-controller';
import { recordingRequest } from './src/recording-request';
import { CaptureProbe } from './src/CaptureProbe';
import { OverlayProbe } from './src/OverlayProbe';
import {
  captureOverlay,
  overlayAvailable,
  prepareOverlayCapture,
} from './src/overlay-capture';

function Action({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Demo() {
  const web = useRef<WebView<unknown>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainDocument = useRef(SITE_URL);
  const [state, dispatch] = useReducer(loadState, initialLoad);
  const [canGoBack, setCanGoBack] = useState(false);
  const [uri, setUri] = useState(SITE_URL);
  const [generation, setGeneration] = useState(0);
  const [notice, setNotice] = useState('');
  const failed = useRef(false);
  const replaceOnRetry = useRef(false);
  const retryCount = useRef(0);
  const captureView = useRef<ComponentRef<typeof View>>(null);
  const layout = useRef({ width: 0, height: 0 });
  const recorder = useRef<RecordingController | null>(null);
  const windowStorage = useRef<Promise<boolean> | null>(null);
  recorder.current ??= new RecordingController({
    pageContext: process.env.EXPO_PUBLIC_PAGE_CONTEXT === '1',
    capture: () =>
      captureFile(captureView, layout.current.width, layout.current.height),
    ...(process.env.EXPO_PUBLIC_WINDOW_CAPTURE === '1' && overlayAvailable
      ? {
          windowCapture: async () => {
            if (!(await windowStorage.current))
              throw new Error('Window capture storage unavailable');
            return captureOverlay(captureView);
          },
        }
      : {}),
    inject: (script) => web.current?.injectJavaScript(script),
    request: recordingRequest,
  });

  function clearTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function fail(message: string, replaceView = false) {
    failed.current = true;
    replaceOnRetry.current ||= replaceView;
    recorder.current?.navigate();
    clearTimer();
    setCanGoBack(false);
    dispatch({ type: 'fail', message });
  }
  function start(url: string) {
    failed.current = false;
    recorder.current?.navigate();
    clearTimer();
    mainDocument.current = url;
    dispatch({ type: 'start' });
    timer.current = setTimeout(() => fail(CONNECTION_ERROR), LOAD_TIMEOUT_MS);
  }
  useEffect(() => clearTimer, []);
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_WINDOW_CAPTURE === '1' && overlayAvailable) {
      windowStorage.current = prepareOverlayCapture().catch(() => {
        setNotice(
          'Native tooltip capture storage is unavailable. Page capture remains available.',
        );
        return false;
      });
    }
    if (!clearCaptureFiles())
      setNotice('Screen recording storage is unavailable.');
    recorder.current?.appState(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', (next) =>
      recorder.current?.appState(next === 'active'),
    );
    return () => {
      listener.remove();
      recorder.current?.dispose();
    };
  }, []);

  function retry() {
    // Keep the temporary cookie store for connection recovery. Change the URL
    // because WKWebView ignores an identical source URL; always issue a fresh
    // GET at home instead of replaying a failed form/navigation submission.
    recorder.current?.navigate();
    clearTimer();
    failed.current = false;
    setNotice('');
    setCanGoBack(false);
    const target = new URL(SITE_URL);
    target.searchParams.set('_softek_retry', String(++retryCount.current));
    setUri(target.href);
    mainDocument.current = target.href;
    if (replaceOnRetry.current) {
      setGeneration((value) => value + 1);
      replaceOnRetry.current = false;
    }
    dispatch({ type: 'retry' });
    timer.current = setTimeout(() => fail(CONNECTION_ERROR), LOAD_TIMEOUT_MS);
  }
  async function openBrowser(url: string) {
    if (destination(url) !== 'external') return;
    recorder.current?.appState(false);
    try {
      await Linking.openURL(url);
    } catch {
      setNotice('The link could not open. Please try again.');
    } finally {
      recorder.current?.appState(AppState.currentState === 'active');
    }
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.toolbar}>
        <Action
          label="Back"
          disabled={!canGoBack || Boolean(state.error)}
          onPress={() => web.current?.goBack()}
        />
        <Text accessibilityRole="header" style={styles.title}>
          Softek POC
        </Text>
        <Action
          label="Reload"
          onPress={
            state.error
              ? retry
              : () => {
                  recorder.current?.navigate();
                  web.current?.reload();
                }
          }
        />
      </View>
      {notice ? (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.message}>
            {notice}
          </Text>
          <Action label="Dismiss" onPress={() => setNotice('')} />
        </View>
      ) : null}
      <View
        ref={captureView}
        collapsable={false}
        style={styles.content}
        onLayout={({ nativeEvent: { layout: size } }) => {
          layout.current = size;
        }}
      >
        <View
          style={styles.web}
          accessibilityElementsHidden={Boolean(state.error)}
          importantForAccessibility={
            state.error ? 'no-hide-descendants' : 'auto'
          }
          pointerEvents={state.error ? 'none' : 'auto'}
        >
          <WebView<unknown>
            key={generation}
            ref={web}
            source={{ uri, method: 'GET' }}
            style={styles.web}
            // Login belongs to this WebView's lifetime, not the next app launch.
            incognito
            sharedCookiesEnabled={false}
            // Handle every origin ourselves; otherwise WebView may hand rejected
            // schemes to the OS before our navigation policy can inspect them.
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(request) => {
              const action = navigationAction(request);
              if (request.isTopFrame !== false && action === 'allow')
                recorder.current?.route(request.url);
              if (action === 'open-browser') void openBrowser(request.url);
              return action === 'allow';
            }}
            javaScriptCanOpenWindowsAutomatically={false}
            onOpenWindow={({ nativeEvent: { targetUrl } }) => {
              if (destination(targetUrl) === 'internal') setUri(targetUrl);
              else void openBrowser(targetUrl);
            }}
            onNavigationStateChange={(navigation) => {
              setCanGoBack(navigation.canGoBack);
              if (navigation.url) recorder.current?.route(navigation.url);
            }}
            onMessage={({ nativeEvent }) =>
              recorder.current?.receive(nativeEvent.url, nativeEvent.data)
            }
            onLoadStart={({ nativeEvent }) => start(nativeEvent.url)}
            onLoadEnd={() => {
              clearTimer();
              dispatch({ type: 'finish' });
              if (!failed.current)
                web.current?.injectJavaScript(recorder.current!.bootstrap());
            }}
            onError={() => fail(CONNECTION_ERROR)}
            onHttpError={({ nativeEvent }) => {
              if (sameDocument(nativeEvent.url, mainDocument.current))
                fail(CONNECTION_ERROR);
            }}
            onContentProcessDidTerminate={() => fail(PROCESS_ERROR, true)}
            renderError={() => <View />}
            pullToRefreshEnabled={false}
            allowsBackForwardNavigationGestures
            contentInsetAdjustmentBehavior="never"
          />
        </View>
        {state.error ? (
          <View style={[styles.error, StyleSheet.absoluteFill]}>
            <Text accessibilityRole="header" style={styles.errorTitle}>
              Unable to open the demo
            </Text>
            <Text accessibilityRole="alert" style={styles.message}>
              {state.error}
            </Text>
            <Action label="Try again" onPress={retry} />
          </View>
        ) : null}
        {state.loading && !state.error ? (
          <View
            style={styles.loading}
            accessibilityLabel="Loading demo"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.message}>Opening demo…</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {process.env.EXPO_PUBLIC_OVERLAY_CHECK === '1' ? (
        <OverlayProbe />
      ) : process.env.EXPO_PUBLIC_CAPTURE_CHECK === '1' ? (
        <CaptureProbe />
      ) : (
        <Demo />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.ink, fontWeight: '600', fontSize: 16, flexShrink: 1 },
  action: {
    minHeight: 48,
    minWidth: 64,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.35 },
  pressed: { backgroundColor: colors.border, borderRadius: 8 },
  content: { flex: 1, backgroundColor: colors.surface },
  web: { flex: 1, backgroundColor: colors.background },
  loading: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.background,
  },
  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 16,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
  },
  message: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  notice: { padding: 12, backgroundColor: colors.background },
});
