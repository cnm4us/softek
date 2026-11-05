import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { SITE_URL } from './navigation';
import type { Frame } from './capture-loop';
import type { RecordingPorts } from './recording-controller';

export const recordingRequest: RecordingPorts['request'] = async (
  session,
  endpoint,
  body,
  parent,
) => {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  if (parent.aborted) abort.abort();
  parent.addEventListener('abort', cancel);
  const timer = setTimeout(cancel, 8000);
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.credential}`,
    };
    let data: FormData | string;
    if (endpoint === 'frames') {
      const frame = body as Frame;
      const form = new FormData();
      form.append('image', new File(frame.uri));
      form.append(
        'metadata',
        JSON.stringify({
          sequence: frame.sequence,
          capturedAt: frame.capturedAt,
          elapsedMs: frame.elapsedMs,
          captureMs: frame.captureMs,
        }),
      );
      data = form;
    } else {
      headers['Content-Type'] = 'application/json';
      data = JSON.stringify(body);
    }
    const reply = await fetch(
      `${SITE_URL}api/recordings/${encodeURIComponent(session.id)}/${endpoint}`,
      {
        method: 'POST',
        headers,
        body: data,
        signal: abort.signal,
        redirect: 'error',
        credentials: 'omit',
      },
    );
    // Drain the small acknowledgement/error body before reusing the connection.
    await reply.arrayBuffer();
    return { ok: reply.ok, status: reply.status };
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', cancel);
  }
};
