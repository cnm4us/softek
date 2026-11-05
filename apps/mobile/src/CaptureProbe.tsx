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
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaptureLoop, type Frame } from './capture-loop';
import {
  CaptureFileError,
  captureFile,
  clearCaptureFiles,
} from './capture-file';
import { colors } from './theme';

// This self-contained page has no network, login, real customer or upload code.
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><style>
*{box-sizing:border-box}body{margin:0;background:#f5f6f1;font:16px -apple-system,sans-serif;color:#183b31}header{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:3px solid #a84d31}h1{font-size:24px}button{background:white;border:1px solid #205747;border-radius:12px;min-height:48px;padding:12px;font:inherit;color:#205747}.card{background:white;border-radius:16px;margin:16px;padding:20px}#menu{display:none;position:fixed;inset:70px 15px auto;background:#fff;padding:24px;box-shadow:0 4px 30px #0004;border-radius:12px}#error{display:none;color:#8c342a;border:2px solid;margin:16px;padding:16px}small{display:block;padding:16px}</style></head><body>
<header><h1>Account Summary</h1><button onclick="document.getElementById('menu').style.display='block'">☰ Menu</button></header><small>LOCAL CAPTURE FIXTURE · Fictional data</small>
<section class="card"><h2>Everyday checking</h2><p>Available balance</p><strong>$1,234.56</strong></section><section class="card"><h2>Rainy day savings</h2><p>Available balance</p><strong>$4,321.00</strong></section>
<button style="margin:16px" onclick="document.getElementById('error').style.display='block'">Show sample error</button><div id="error">This fictional payment could not be completed. Please try again.</div>
${Array.from({ length: 20 }, (_, i) => `<section class="card">Fictional activity ${i + 1}<p>Sample purchase · $${i + 10}.00</p></section>`).join('')}
<div id="menu"><button onclick="document.getElementById('menu').style.display='none'">Close menu ×</button><p>Account Summary</p><p>Explore more ways to bank</p><p>Support</p></div></body></html>`;

export function CaptureProbe({ close }: { close?: () => void }) {
  const view = useRef<ComponentRef<typeof View>>(null);
  const layout = useRef({ width: 0, height: 0 });
  const eligible = useRef(false);
  const frames = useRef<Frame[]>([]);
  const count = useRef(0);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [review, setReview] = useState(false);
  const [status, setStatus] = useState('Ready for a local 20-second check.');
  const [failure, setFailure] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [, redraw] = useState(0);
  const loop = useRef<CaptureLoop | null>(null);
  if (!loop.current)
    loop.current = new CaptureLoop(
      {
        eligible: () => eligible.current && AppState.currentState === 'active',
        capture: async () => {
          try {
            return await captureFile(
              view,
              layout.current.width,
              layout.current.height,
            );
          } catch (error) {
            setFailure(
              error instanceof CaptureFileError
                ? error.message
                : 'Capture failed before a file was available.',
            );
            throw error;
          }
        },
        frame: (frame) => {
          frames.current.push(frame);
          if (frames.current.length > 8) frames.current.shift()!.dispose();
          count.current++;
          setStatus(
            `${count.current} screenshots captured · latest ${frame.bytes} bytes / ${frame.captureMs} ms`,
          );
        },
        stopped: (reason) => {
          setActive(false);
          setStatus(
            `${reason}. ${count.current} screenshots captured; latest eight kept for local review.`,
          );
        },
      },
      undefined,
      20,
    );
  useEffect(() => {
    if (!clearCaptureFiles())
      setFailure('Capture storage: local cache unavailable');
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') loop.current?.stop('App left foreground');
    });
    return () => {
      eligible.current = false;
      loop.current?.stop('Closed');
      subscription.remove();
      for (const frame of frames.current) frame.dispose();
    };
  }, []);
  const button = (label: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={action}
      style={[styles.button, disabled && { opacity: 0.4 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal animationType="slide" onRequestClose={() => close?.()}>
      <SafeAreaView style={styles.screen}>
        <Text style={styles.heading}>Local capture check</Text>
        <Text style={styles.copy}>
          One screenshot per second. Only this embedded fictional page is
          captured. Nothing is uploaded or saved to Photos.
        </Text>
        <View style={styles.actions}>
          {button(
            'Start check',
            () => {
              for (const frame of frames.current) frame.dispose();
              frames.current = [];
              count.current = 0;
              setFailure('');
              setDimensions('');
              eligible.current = true;
              setActive(true);
              setReview(false);
              setStatus(
                'Capturing once per second. Scroll, open the menu and show the sample error.',
              );
              loop.current?.start();
            },
            active || !ready || review,
          )}
          {button('Stop', () => loop.current?.stop(), !active)}
          {close && button('Close', close)}
        </View>
        <Text accessibilityRole="alert" style={styles.copy}>
          {active ? '● Recording locally · ' : ''}
          {status}
          {failure ? `\n${failure}` : ''}
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
            source={{ html }}
            incognito
            sharedCookiesEnabled={false}
            originWhitelist={['about:blank']}
            onShouldStartLoadWithRequest={(r) => r.url === 'about:blank'}
            onLoadEnd={() => {
              eligible.current = true;
              setReady(true);
            }}
            onError={() => {
              eligible.current = false;
              loop.current?.stop('Page unavailable');
            }}
          />
        </View>
        {button(
          'Review latest screenshots',
          () => {
            setReview(true);
            redraw((v) => v + 1);
          },
          active || frames.current.length === 0,
        )}
        {review && (
          <Modal animationType="slide" onRequestClose={() => setReview(false)}>
            <SafeAreaView style={styles.screen}>
              <Text style={styles.heading}>Local screenshots</Text>
              {dimensions ? (
                <Text style={styles.copy}>{dimensions}</Text>
              ) : null}
              {button('Back to check', () => setReview(false))}
              <ScrollView>
                {frames.current.map((frame) => (
                  <View key={frame.sequence} style={styles.sample}>
                    <Text style={styles.copy}>
                      Frame {frame.sequence} · {frame.capturedAt}
                      {'\n'}Elapsed {frame.elapsedMs} ms · capture{' '}
                      {frame.captureMs} ms · {frame.bytes} bytes
                    </Text>
                    <Image
                      source={{ uri: frame.uri }}
                      style={{
                        width: '100%',
                        aspectRatio:
                          layout.current.width / layout.current.height,
                      }}
                      resizeMode="contain"
                      onLoad={({ nativeEvent: { source } }) =>
                        setDimensions(
                          `Image: ${source.width} × ${source.height} physical pixels`,
                        )
                      }
                    />
                  </View>
                ))}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  heading: { fontSize: 22, fontWeight: '600', color: colors.ink, padding: 12 },
  copy: {
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  button: { padding: 12, minHeight: 48, justifyContent: 'center' },
  buttonText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  content: { flex: 1, backgroundColor: colors.surface },
  sample: { margin: 12, borderBottomWidth: 1, borderColor: colors.border },
});
