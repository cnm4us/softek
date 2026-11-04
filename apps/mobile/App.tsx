import { useEffect, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

  function clearTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function fail(message: string) {
    clearTimer();
    setCanGoBack(false);
    dispatch({ type: 'fail', message });
  }
  function start(url: string) {
    clearTimer();
    mainDocument.current = url;
    dispatch({ type: 'start' });
    timer.current = setTimeout(() => fail(CONNECTION_ERROR), LOAD_TIMEOUT_MS);
  }
  useEffect(() => clearTimer, []);

  function retry() {
    // Explicitly start a fresh GET at home; never replay a failed submission.
    clearTimer();
    setNotice('');
    setCanGoBack(false);
    setUri(SITE_URL);
    mainDocument.current = SITE_URL;
    setGeneration((value) => value + 1);
    dispatch({ type: 'retry' });
  }
  async function openBrowser(url: string) {
    if (destination(url) !== 'external') return;
    try {
      await Linking.openURL(url);
    } catch {
      setNotice('The link could not open. Please try again.');
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
          onPress={state.error ? retry : () => web.current?.reload()}
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
      <View style={styles.content}>
        {state.error ? (
          <View style={styles.error}>
            <Text accessibilityRole="header" style={styles.errorTitle}>
              Unable to open the demo
            </Text>
            <Text accessibilityRole="alert" style={styles.message}>
              {state.error}
            </Text>
            <Action label="Try again" onPress={retry} />
          </View>
        ) : (
          <WebView<unknown>
            key={generation}
            ref={web}
            source={{ uri }}
            style={styles.web}
            // Login belongs to this WebView's lifetime, not the next app launch.
            incognito
            sharedCookiesEnabled={false}
            // Handle every origin ourselves; otherwise WebView may hand rejected
            // schemes to the OS before our navigation policy can inspect them.
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(request) => {
              const action = navigationAction(request);
              if (action === 'open-browser') void openBrowser(request.url);
              return action === 'allow';
            }}
            javaScriptCanOpenWindowsAutomatically={false}
            onOpenWindow={({ nativeEvent: { targetUrl } }) => {
              if (destination(targetUrl) === 'internal') setUri(targetUrl);
              else void openBrowser(targetUrl);
            }}
            onNavigationStateChange={(navigation) =>
              setCanGoBack(navigation.canGoBack)
            }
            onLoadStart={({ nativeEvent }) => start(nativeEvent.url)}
            onLoadEnd={() => {
              clearTimer();
              dispatch({ type: 'finish' });
            }}
            onError={() => fail(CONNECTION_ERROR)}
            onHttpError={({ nativeEvent }) => {
              if (sameDocument(nativeEvent.url, mainDocument.current))
                fail(CONNECTION_ERROR);
            }}
            onContentProcessDidTerminate={() => fail(PROCESS_ERROR)}
            renderError={() => <View />}
            pullToRefreshEnabled={false}
            allowsBackForwardNavigationGestures
            contentInsetAdjustmentBehavior="never"
          />
        )}
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
      <Demo />
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
