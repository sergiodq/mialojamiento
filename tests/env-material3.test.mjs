import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../env.js', import.meta.url), 'utf8');

test('env bootstrap loads Material 3 stylesheet and UI module globally', () => {
  assert.match(source, /css\/material3\.css/);
  assert.match(source, /js\/material3-ui\.js/);
  assert.match(source, /type\s*=\s*['"]module['"]/);
});
