'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { getStageRuntimeDir } = require('../src/runner/stage-runtime');

test('stage runtime directories are deterministic and isolated', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-ws-'));
  const ingest = getStageRuntimeDir(root, 'ingest');
  const transcript = getStageRuntimeDir(root, 'transcript');

  assert.equal(ingest, path.join(path.resolve(root), 'stages', 'ingest'));
  assert.equal(transcript, path.join(path.resolve(root), 'stages', 'transcript'));
  assert.notEqual(ingest, transcript);

  fs.mkdirSync(ingest, { recursive: true });
  fs.mkdirSync(transcript, { recursive: true });
  assert.ok(fs.existsSync(ingest));
  assert.ok(fs.existsSync(transcript));
});
