'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const cliPath = path.join(__dirname, '..', 'src', 'cli.js');

test('CLI: requires --video and --output-dir', () => {
  const result = spawnSync(process.execPath, [cliPath], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
});

test('CLI: fails when final_video artifact is not produced by stages', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-cli-'));
  const video = path.join(dir, 'in.mp4');
  const out = path.join(dir, 'workspace');
  fs.writeFileSync(video, Buffer.from([1, 2, 3]));

  const result = spawnSync(
    process.execPath,
    [cliPath, '--video', video, '--output-dir', out],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.ok(fs.existsSync(path.join(out, 'stages', 'ingest', 'input_video_ref.json')));
  assert.ok(fs.existsSync(path.join(out, 'contracts.json')));
  assert.ok(fs.existsSync(path.join(out, 'pipeline_report.json')));
  assert.ok(!fs.existsSync(path.join(out, 'stages', 'final', 'final_video.mp4')));
});
