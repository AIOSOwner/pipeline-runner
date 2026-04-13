'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const { ensureWorkspaceLayout } = require('../src/workspace/workspace');
const { ensureFinalVideoMp4 } = require('../src/report/ensure-final-video');
const { buildPipelineReportDocument, writePipelineReportFile } = require('../src/report/pipeline-report');

function makeFinalVideo(outPath) {
  const r = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=320x240:rate=30',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=48000:duration=1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      outPath,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed: ${r.stderr || r.stdout}`);
  }
}

test('ensureFinalVideoMp4 verifies final_video exists and does not mutate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-rep-'));
  ensureWorkspaceLayout(dir);
  assert.throws(() => ensureFinalVideoMp4(dir), /missing required artifact/);
  const videoPath = path.join(dir, 'stages', 'final', 'final_video.mp4');
  makeFinalVideo(videoPath);
  const stat1 = fs.statSync(videoPath).mtimeMs;
  const verified = ensureFinalVideoMp4(dir);
  const stat2 = fs.statSync(videoPath).mtimeMs;
  assert.equal(verified.exists, true);
  assert.equal(stat1, stat2);
});

test('buildPipelineReportDocument contains stages, artifacts, timing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-rep-'));
  const doc = buildPipelineReportDocument({
    workspaceRoot: dir,
    pipelineOk: true,
    trace: [
      { id: 'a', ok: true },
      { id: 'b', ok: true },
    ],
    stageTimingsMs: [1, 2],
    ensureFinalVideo: { created: true, path: '/tmp/x.mp4' },
  });
  assert.equal(doc.artifact, 'pipeline_report');
  assert.equal(doc.pipeline_ok, true);
  assert.equal(doc.stages.length, 2);
  assert.equal(doc.stages[0].duration_ms, 1);
  assert.ok(doc.contracts_snapshot && doc.contracts_snapshot.artifact === 'contracts');
  assert.equal(doc.final_video_artifact.relative_path, 'stages/final/final_video.mp4');
  assert.ok(doc.timing_ms.total >= 0);
});

test('writePipelineReportFile is deterministic', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-rep-'));
  const reportPath = path.join(dir, 'pipeline_report.json');
  writePipelineReportFile({
    workspaceRoot: dir,
    reportPath,
    pipelineOk: false,
    trace: [{ id: 'x', ok: false }],
    stageTimingsMs: [0.5],
    ensureFinalVideo: { skipped: true, reason: 'pipeline_failed' },
  });
  const first = fs.readFileSync(reportPath, 'utf8');
  writePipelineReportFile({
    workspaceRoot: dir,
    reportPath,
    pipelineOk: false,
    trace: [{ id: 'x', ok: false }],
    stageTimingsMs: [0.5],
    ensureFinalVideo: { skipped: true, reason: 'pipeline_failed' },
  });
  assert.equal(fs.readFileSync(reportPath, 'utf8'), first);
});

test('pipeline report stays deterministic across different roots', () => {
  const root1 = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-det-1-'));
  const root2 = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-det-2-'));
  const report1 = path.join(root1, 'pipeline_report.json');
  const report2 = path.join(root2, 'pipeline_report.json');

  writePipelineReportFile({
    workspaceRoot: root1,
    reportPath: report1,
    pipelineOk: true,
    trace: [{ id: 'stage_a', ok: true }],
    stageTimingsMs: [0],
    ensureFinalVideo: { exists: true, path: path.join(root1, 'stages', 'final', 'final_video.mp4') },
  });
  writePipelineReportFile({
    workspaceRoot: root2,
    reportPath: report2,
    pipelineOk: true,
    trace: [{ id: 'stage_a', ok: true }],
    stageTimingsMs: [0],
    ensureFinalVideo: { exists: true, path: path.join(root2, 'stages', 'final', 'final_video.mp4') },
  });

  const h1 = crypto.createHash('sha256').update(fs.readFileSync(report1)).digest('hex');
  const h2 = crypto.createHash('sha256').update(fs.readFileSync(report2)).digest('hex');
  assert.equal(h1, h2);
});
