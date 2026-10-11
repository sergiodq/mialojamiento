import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../css/material3.css', import.meta.url), 'utf8');

test('Material 3 stylesheet defines mobile navigation, drawer and FAB', () => {
  for (const selector of ['.m3-bottom-nav', '.m3-drawer', '.m3-fab']) {
    assert.match(css, new RegExp(selector.replace('.', '\\.')));
  }
});

test('phone layout reserves safe area and prevents page overflow', () => {
  assert.match(css, /@media\s*\(max-width:\s*599px\)/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test('primary mobile controls meet Material touch sizes', () => {
  assert.match(css, /--m3-touch:\s*48px/);
  assert.match(css, /--m3-control:\s*56px/);
  assert.match(css, /--m3-fab-size:\s*56px/);
});

test('mobile tables are rendered as cards instead of horizontal tables', () => {
  assert.match(css, /\.m3-responsive-table thead\{display:none/);
  assert.match(css, /\.m3-responsive-table tbody tr\{display:grid/);
});
