'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const { validatePipelineArtifacts } = require('../src/validation/validate');
const { ensureWorkspaceLayout } = require('../src/workspace/workspace');
const { resolveWorkspacePaths } = require('../src/workspace/paths');

function runFfmpeg(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed: ${r.stderr || r.stdout}`);
  }
}

function writeMinimalWav(filePath, durationSeconds, sampleRate = 48000) {
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  fs.writeFileSync(filePath, buf);
}

function makeOneAudioMp4(outPath, durationSeconds) {
  runFfmpeg([
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc=duration=${durationSeconds}:size=320x240:rate=30`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=440:sample_rate=48000:duration=${durationSeconds}`,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    outPath,
  ]);
}

function makeTwoAudioMp4(outPath, durationSeconds) {
  runFfmpeg([
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc=duration=${durationSeconds}:size=320x240:rate=30`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=440:sample_rate=48000:duration=${durationSeconds}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=880:sample_rate=48000:duration=${durationSeconds}`,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-map',
    '2:a',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    outPath,
  ]);
}

function writeFixtureWorkspace(root, { duration, timelineSegments, transcriptSegments, twoAudio }) {
  ensureWorkspaceLayout(root);
  const p = resolveWorkspacePaths(root);

  fs.writeFileSync(
    p.artifacts.timeline,
    JSON.stringify({
      end: duration,
      segments: timelineSegments.map(([start, end]) => ({ start, end })),
    }),
    'utf8',
  );
  fs.writeFileSync(
    p.artifacts.translated_transcript,
    JSON.stringify({ segments: transcriptSegments }),
    'utf8',
  );
  writeMinimalWav(p.artifacts.dubbed_audio, duration);
  if (twoAudio) {
    makeTwoAudioMp4(p.artifacts.final_video, duration);
  } else {
    makeOneAudioMp4(p.artifacts.final_video, duration);
  }
}

test('validatePipelineArtifacts: passes when all rules hold', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-val-'));
  writeFixtureWorkspace(root, {
    duration: 2,
    timelineSegments: [
      [0, 1],
      [1, 2],
    ],
    transcriptSegments: [{ id: 1 }, { id: 2 }],
    twoAudio: false,
  });

  const reportPath = path.join(root, 'validation_report.json');
  const result = validatePipelineArtifacts({
    workspaceRoot: root,
    validationReportPath: reportPath,
  });
  assert.equal(result.ok, true);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.validation.result, 'passed');
});

test('validatePipelineArtifacts: fails when dubbed duration != timeline end', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-val-'));
  writeFixtureWorkspace(root, {
    duration: 2,
    timelineSegments: [
      [0, 1],
      [1, 2],
    ],
    transcriptSegments: [{ id: 1 }, { id: 2 }],
    twoAudio: false,
  });
  const p = resolveWorkspacePaths(root);
  writeMinimalWav(p.artifacts.dubbed_audio, 0.5);

  const result = validatePipelineArtifacts({
    workspaceRoot: root,
    validationReportPath: path.join(root, 'validation_report.json'),
  });
  assert.equal(result.ok, false);
  assert.ok(result.report.errors.some((e) => /duration/i.test(e)));
});

test('validatePipelineArtifacts: fails when segment count mismatch', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-val-'));
  writeFixtureWorkspace(root, {
    duration: 2,
    timelineSegments: [
      [0, 1],
      [1, 2],
    ],
    transcriptSegments: [{ id: 1 }],
    twoAudio: false,
  });
  const result = validatePipelineArtifacts({
    workspaceRoot: root,
    validationReportPath: path.join(root, 'validation_report.json'),
  });
  assert.equal(result.ok, false);
  assert.ok(result.report.errors.some((e) => /segment count/i.test(e)));
});

test('validatePipelineArtifacts: fails when final video has multiple audio streams', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-val-'));
  writeFixtureWorkspace(root, {
    duration: 2,
    timelineSegments: [
      [0, 1],
      [1, 2],
    ],
    transcriptSegments: [{ id: 1 }, { id: 2 }],
    twoAudio: true,
  });
  const result = validatePipelineArtifacts({
    workspaceRoot: root,
    validationReportPath: path.join(root, 'validation_report.json'),
  });
  assert.equal(result.ok, false);
  assert.ok(result.report.errors.some((e) => /audio stream/i.test(e)));
});
