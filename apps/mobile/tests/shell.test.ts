import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  destination,
  navigationAction,
  sameDocument,
  SITE_URL,
} from '../src/navigation';
import {
  initialLoad,
  loadState,
  CONNECTION_ERROR,
  PROCESS_ERROR,
} from '../src/load-state';

test('owned routes preserve the exact HTTPS origin, including default port normalization', () => {
  for (const url of [
    SITE_URL,
    `${SITE_URL}accounts/checking`,
    'https://demo.bawebtech.com:443/explore?search=coin#item',
  ]) {
    assert.equal(navigationAction({ url, navigationType: 'other' }), 'allow');
  }
});

test('lookalike hosts, different ports and external redirects cannot replace the banking view', () => {
  for (const url of [
    'https://demo.bawebtech.com.evil.example/',
    'https://demo.bawebtech.com:444/',
    'https://evil.example/?next=https://demo.bawebtech.com',
  ]) {
    assert.equal(destination(url), 'external');
    assert.equal(navigationAction({ url, navigationType: 'other' }), 'block');
    assert.equal(
      navigationAction({ url, navigationType: 'click' }),
      'open-browser',
    );
  }
});

test('unexpected schemes, malformed destinations and embedded credentials never open', () => {
  for (const url of [
    'http://demo.bawebtech.com/',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,hello',
    'tel:1234',
    'about:blank',
    'invalid',
    'https://user:password@demo.bawebtech.com/',
    'https://user@evil.example/',
  ]) {
    assert.equal(destination(url), 'blocked');
    assert.equal(navigationAction({ url, navigationType: 'click' }), 'block');
  }
});

test('subframe requests do not launch a browser or interfere with resource navigation', () => {
  assert.equal(
    navigationAction({ url: 'about:blank', isTopFrame: false }),
    'allow',
  );
  assert.equal(
    navigationAction({
      url: 'https://example.com/',
      isTopFrame: false,
      navigationType: 'click',
    }),
    'allow',
  );
});

test('main-document errors are distinguished from resource and API URLs', () => {
  assert.equal(
    sameDocument(`${SITE_URL}explore#item`, `${SITE_URL}explore`),
    true,
  );
  assert.equal(
    sameDocument(`${SITE_URL}api/state`, `${SITE_URL}explore`),
    false,
  );
  assert.equal(sameDocument('invalid', SITE_URL), false);
});

test('loadEnd cannot hide an HTTP, connection, timeout or terminated-process failure', () => {
  for (const message of [CONNECTION_ERROR, PROCESS_ERROR]) {
    const failed = loadState(initialLoad, { type: 'fail', message });
    assert.deepEqual(loadState(failed, { type: 'finish' }), {
      loading: false,
      error: message,
    });
    assert.deepEqual(loadState(failed, { type: 'retry' }), initialLoad);
  }
});

test('successful loading finishes and an explicit new navigation starts loading again', () => {
  const finished = loadState(initialLoad, { type: 'finish' });
  assert.deepEqual(finished, { loading: false, error: null });
  assert.deepEqual(loadState(finished, { type: 'start' }), initialLoad);
});
