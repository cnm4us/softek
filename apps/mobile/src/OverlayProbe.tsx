import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  captureFile,
  clearCaptureFiles,
  CaptureFileError,
} from './capture-file';
import {
  captureOverlay,
  overlayAvailable,
  prepareOverlayCapture,
} from './overlay-capture';
import {
  OverlayComparison,
  type OverlayReason,
  type OverlaySample,
} from './overlay-comparison';
import { overlayFixture } from './overlay-fixture';
import { colors } from './theme';

// Separate build entry: no banking website, credentials, receiver or upload code.
export function OverlayProbe() {
  const view = useRef<ComponentRef<typeof View>>(null);
  const layout = useRef({ width: 0, height: 0 });
  const eligible = useRef(false);
  const samples = useRef<OverlaySample[]>([]);
  const [nativeReady, setNativeReady] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [active, setActive] = useState(false);
  const [review, setReview] = useState(false);
  const [testNumber, setTestNumber] = useState(0);
  const [reviewNumber, setReviewNumber] = useState(0);
  const [fixtureGeneration, setFixtureGeneration] = useState(0);
  const documentEpoch = useRef(0);
  const resetPending = useRef(false);
  const [status, setStatus] = useState('Preparing local comparison…');
  const [, redraw] = useState(0);
  const comparison = useRef<OverlayComparison | null>(null);
  comparison.current ??= new OverlayComparison({
    eligible: () => eligible.current && AppState.currentState === 'active',
    capture: async (method) => {
      if (method === 'Window candidate') return captureOverlay(view);
      try {
        const image = await captureFile(
          view,
          layout.current.width,
          layout.current.height,
        );
        return {
          ...image,
          width: 720,
          height: Math.round(
            (720 * layout.current.height) / layout.current.width,
          ),
        };
      } catch (e) {
        throw new Error(
          e instanceof CaptureFileError ? e.message : 'Baseline capture failed',
        );
      }
    },
    sample: (sample) => {
      samples.current.push(sample);
      while (samples.current.length > 8)
        samples.current.shift()!.image?.dispose();
      setStatus(
        `Pair ${sample.pair}: ${sample.method} ${sample.image ? 'saved locally' : 'failed'}.${sample.error ? ' ' + sample.error : ''}`,
      );
      redraw((n) => n + 1);
    },
    stopped: (reason) => {
      setActive(false);
      setStatus(reason + '. Review the latest four pairs.');
    },
  });
  function clear() {
    for (const s of samples.current) s.image?.dispose();
    samples.current = [];
  }
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        if (
          !overlayAvailable ||
          !clearCaptureFiles() ||
          !(await prepareOverlayCapture())
        )
          throw new Error();
        if (mounted) {
          setNativeReady(true);
          setStatus('Ready. Start the check, then submit the empty Goal name.');
        }
      } catch {
        if (mounted)
          setStatus(
            'Local candidate module or storage unavailable. Install the signed overlay-check build.',
          );
      }
    })();
    const listener = AppState.addEventListener('change', (next) => {
      if (next !== 'active') comparison.current?.stop('App left foreground');
    });
    return () => {
      mounted = false;
      eligible.current = false;
      comparison.current?.stop('Closed');
      listener.remove();
      clear();
    };
  }, []);
  function start() {
    clear();
    setTestNumber((n) => n + 1);
    eligible.current = true;
    setActive(true);
    setStatus(
      'Recording locally. Leave Goal name empty and tap Create goal; wait one second.',
    );
    comparison.current?.start();
  }
  function reset() {
    comparison.current?.stop('Cleared');
    eligible.current = false;
    clear();
    setActive(false);
    setReview(false);
    setPageReady(false);
    resetPending.current = true;
    documentEpoch.current++;
    setFixtureGeneration(documentEpoch.current);
    setStatus('Screenshots cleared. Resetting the empty form…');
    redraw((n) => n + 1);
  }
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && { opacity: 0.4 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Local tooltip comparison</Text>
      <Text style={styles.copy}>
        View baseline vs cropped window candidate. Nothing uploaded or saved to
        Photos. Candidate keyboard area is blanked.
      </Text>
      <View style={styles.actions}>
        {button(
          'Start local check',
          start,
          active || !nativeReady || !pageReady || review,
        )}
        {button('Stop', () => comparison.current?.stop(), !active)}
        {button(
          'Review',
          () => {
            setReviewNumber((n) => n + 1);
            setReview(true);
          },
          active || samples.current.length === 0,
        )}
        {button('Clear & reset', reset)}
      </View>
      <Text accessibilityRole="alert" style={styles.status}>
        {active ? '● Recording locally · ' : ''}
        {status}
      </Text>
      <View
        ref={view}
        collapsable={false}
        style={styles.content}
        onLayout={({ nativeEvent: { layout: size } }) => {
          layout.current = size;
        }}
      >
        <WebView
          key={fixtureGeneration}
          source={{ html: overlayFixture }}
          style={styles.content}
          incognito
          sharedCookiesEnabled={false}
          originWhitelist={['about:blank']}
          onShouldStartLoadWithRequest={(r) => r.url === 'about:blank'}
          onLoadStart={() => {
            if (fixtureGeneration !== documentEpoch.current) return;
            eligible.current = false;
            comparison.current?.stop('Fixture reloaded');
          }}
          onLoadEnd={() => {
            if (fixtureGeneration !== documentEpoch.current) return;
            eligible.current = true;
            setPageReady(true);
            if (resetPending.current) {
              resetPending.current = false;
              setStatus('Cleared. Empty form ready. Tap Start local check.');
            }
          }}
          onError={() => {
            if (fixtureGeneration !== documentEpoch.current) return;
            eligible.current = false;
            setPageReady(false);
            comparison.current?.stop('Fixture unavailable');
          }}
          onMessage={(event) => {
            if (
              fixtureGeneration !== documentEpoch.current ||
              event.nativeEvent.url !== 'about:blank' ||
              event.nativeEvent.data.length > 160
            )
              return;
            try {
              const m = JSON.parse(event.nativeEvent.data);
              if (
                m.type === 'softek-overlay-check' &&
                ['invalid', 'ui', 'content', 'scroll', 'viewport'].includes(
                  m.kind,
                )
              )
                comparison.current?.request(m.kind as OverlayReason);
            } catch {
              /* Ignore malformed fixture messages. */
            }
          }}
        />
      </View>
      <Modal
        visible={review}
        animationType="slide"
        onRequestClose={() => setReview(false)}
      >
        <SafeAreaView style={styles.screen}>
          <Text style={styles.title}>Local A/B screenshots</Text>
          <Text style={styles.copy}>
            Test {testNumber} · {samples.current.length} review entries, oldest
            first. Each pair has a baseline and a candidate. Starting a new test
            replaces these entries and restarts pair numbers at 1.
          </Text>
          <View style={styles.actions}>
            {button('Back to fixture', () => setReview(false))}
            {button('Clear & reset', reset)}
          </View>
          <ScrollView key={`${testNumber}-${reviewNumber}`}>
            {samples.current.map((s) => (
              <View
                style={styles.sample}
                key={`${testNumber}-${s.pair}-${s.method}`}
              >
                <Text style={styles.label}>
                  Test {testNumber} · Pair {s.pair} · {s.method} · {s.reason}
                </Text>
                {s.image ? (
                  <>
                    <Text style={styles.copy}>
                      {s.image.capturedAt} · {s.elapsedMs} ms elapsed{'\n'}
                      {s.image.width}×{s.image.height} · {s.image.bytes} bytes ·{' '}
                      {s.image.captureMs} ms{'\n'}
                      {s.method === 'Window candidate'
                        ? `Keyboard blanked: ${s.image.maskedKeyboard ? 'yes' : 'no'} · Anchored popover found: ${s.image.anchoredPopover ? 'yes' : 'no'}`
                        : 'Original referenced-view method'}
                    </Text>
                    <Image
                      source={{ uri: s.image.uri }}
                      style={{
                        width: '100%',
                        aspectRatio: s.image.width / s.image.height,
                      }}
                      resizeMode="contain"
                    />
                  </>
                ) : (
                  <Text style={styles.copy}>{s.error}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
    padding: 12,
    paddingBottom: 6,
  },
  copy: {
    fontSize: 13,
    color: colors.ink,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  status: {
    fontSize: 13,
    color: colors.ink,
    paddingHorizontal: 12,
    minHeight: 48,
    paddingBottom: 8,
  },
  content: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  button: { padding: 12, minHeight: 48, justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  sample: { paddingBottom: 20 },
  label: { padding: 12, fontSize: 16, fontWeight: '600', color: colors.ink },
});
