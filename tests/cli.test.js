'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const cliPath = path.join(__dirname, '..', 'src', 'cli.js');

test('CLI requires --video, --target-language and --output-dir', () => {
  const result = spawnSync(process.execPath, [cliPath], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
});
