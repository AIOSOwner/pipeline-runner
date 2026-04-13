'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPipeline } = require('../src/runner/run-pipeline');
const { invokeStage, EXECUTION_MODEL } = require('../src/runner/invoke-stage');
const { getDefaultStages } = require('../src/runner/default-stages');

test('runPipeline: executes stages in deterministic order', () => {
  const order = [];
  const out = path.join(os.tmpdir(), 'pr-order');
  const result = runPipeline({
    videoPath: path.join(os.tmpdir(), 'in.mp4'),
    outputDir: out,
    stages: [
      {
        id: 'first',
        run: (ctx) => {
          order.push('first');
          assert.ok(ctx.paths.artifacts.inputVideoRef.startsWith(ctx.outputDir));
          return { ok: true };
        },
      },
      {
        id: 'second',
        run: () => {
          order.push('second');
          return { ok: true };
        },
      },
      {
        id: 'final_artifact',
        run: (ctx) => {
          order.push('final_artifact');
          fs.mkdirSync(path.dirname(ctx.paths.artifacts.final_video), { recursive: true });
          fs.writeFileSync(ctx.paths.artifacts.final_video, 'final');
          return { ok: true };
        },
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.executionModel, EXECUTION_MODEL);
  assert.deepEqual(order, ['first', 'second', 'final_artifact']);
  assert.ok(fs.existsSync(out));
  assert.ok(Array.isArray(result.stage_timings_ms));
  assert.equal(result.stage_timings_ms.length, 3);
  assert.ok(result.pipeline_report_path);
  const report = JSON.parse(fs.readFileSync(result.pipeline_report_path, 'utf8'));
  assert.equal(report.artifact, 'pipeline_report');
  assert.ok(report.timing_ms && report.timing_ms.total >= 0);
  assert.ok(Array.isArray(report.stages));
  assert.ok(fs.existsSync(path.join(out, 'stages', 'final', 'final_video.mp4')));
});

test('runPipeline: fail-fast stops before later stages', () => {
  const order = [];
  const result = runPipeline({
    videoPath: path.join(os.tmpdir(), 'in.mp4'),
    outputDir: path.join(os.tmpdir(), 'pr-fail'),
    stages: [
      { id: 'ok', run: () => (order.push('ok'), { ok: true }) },
      { id: 'fail', run: () => (order.push('fail'), { ok: false }) },
      { id: 'later', run: () => (order.push('later'), { ok: true }) },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.failedStageId, 'fail');
  assert.equal(result.stoppedAt, 1);
  assert.deepEqual(order, ['ok', 'fail']);
  assert.ok(result.pipeline_report_path);
  const report = JSON.parse(fs.readFileSync(result.pipeline_report_path, 'utf8'));
  assert.equal(report.pipeline_ok, false);
});

test('runPipeline: materializes workspace layout and contracts mapping', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-workspace-'));
  const video = path.join(dir, 'in.mp4');
  const out = path.join(dir, 'runtime');
  fs.writeFileSync(video, Buffer.from([1, 2, 3]));

  const result = runPipeline({
    videoPath: video,
    outputDir: out,
    stages: getDefaultStages(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.failedStageId, 'ensure_final_video');
  for (const stageId of ['ingest', 'transcript', 'dubbing', 'subtitle', 'final']) {
    assert.ok(fs.existsSync(path.join(out, 'stages', stageId)));
  }

  const contractsPath = path.join(out, 'contracts.json');
  assert.ok(fs.existsSync(contractsPath));
  const contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
  assert.equal(contracts.artifact, 'contracts');
  assert.equal(contracts.artifacts.video_reference.relative_path, 'stages/ingest/input_video_ref.json');
  assert.equal(contracts.artifacts.audio.relative_path, 'stages/ingest/audio/source_full.wav');
  assert.equal(contracts.artifacts.timeline.relative_path, 'stages/ingest/timeline.json');
  assert.equal(
    contracts.artifacts.translated_transcript.relative_path,
    'stages/transcript/translated_transcript.json',
  );
  assert.equal(contracts.artifacts.dubbed_audio.relative_path, 'stages/dubbing/dubbed_audio/full.wav');
  assert.equal(contracts.artifacts.subtitle.relative_path, 'stages/subtitle/subtitles_translated.srt');
  const pipelineReportPath = path.join(out, 'pipeline_report.json');
  assert.ok(fs.existsSync(pipelineReportPath));
  const pipelineReport = JSON.parse(fs.readFileSync(pipelineReportPath, 'utf8'));
  assert.equal(pipelineReport.pipeline_ok, false);
  assert.equal(pipelineReport.final_video_artifact.relative_path, 'stages/final/final_video.mp4');
  assert.ok(!fs.existsSync(path.join(out, 'stages', 'final', 'final_video.mp4')));
});

test('invokeStage: subprocess stages use single spawn-sync model', () => {
  const result = invokeStage({
    command: process.execPath,
    args: ['-e', 'process.stdout.write("x")'],
  });
  assert.equal(result.ok, true);
  assert.equal(result.stdout.trim(), 'x');
});
