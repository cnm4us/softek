import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageGeometry, imageBounds } from '../apps/mobile/src/page-context.js';
import {
  pageGeometrySchema,
  imageBoundsSchema,
} from '../apps/api/src/page-context.js';
import { pageWeb, pageBounds } from './page-context-fixtures.js';
test('mobile and receiver agree on strictly bounded page metadata, without arbitrary input fields', () => {
  assert.ok(pageGeometry(pageWeb));
  assert.ok(pageGeometrySchema.safeParse(pageWeb).success);
  for (const bad of [
    { ...pageWeb, inputValue: 'private' },
    { ...pageWeb, documentHeight: Infinity },
    { ...pageWeb, version: 2 },
    { ...pageWeb, layout: 0 },
    { ...pageWeb, clientWidth: 0.5 },
    { ...pageWeb, documentHeight: 0.5 },
    { ...pageWeb, layer: 'keyboard' },
  ]) {
    assert.equal(pageGeometry(bad), null);
    assert.equal(pageGeometrySchema.safeParse(bad).success, false);
  }
  assert.ok(imageBounds(pageBounds));
  assert.ok(imageBoundsSchema.safeParse(pageBounds).success);
  for (const bad of [
    { ...pageBounds, excluded: [] },
    { ...pageBounds, valid: { ...pageBounds.valid, height: 1200 } },
    { ...pageBounds, width: 4000 },
    { ...pageBounds, excluded: [{ x: 0, y: 700, width: 720, height: 399 }] },
  ]) {
    assert.equal(imageBounds(bad), null);
    assert.equal(imageBoundsSchema.safeParse(bad).success, false);
  }
});
