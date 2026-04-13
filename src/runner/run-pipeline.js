'use strict';

const fs = require('node:fs');
const { EXECUTION_MODEL } = require('./invoke-stage');
const { buildPipelineContext } = require('./pipeline-context');
const { ensureWorkspaceLayout, writeContractsFile } = require('../workspace/workspace');
const { ensureFinalVideoMp4 } = require('../report/ensure-final-video');
const { writePipelineReportFile } = require('../report/pipeline-report');

function runPipeline(options) {
  const { videoPath, outputDir, stages, pipelineReportPath } = options || {};
  if (!videoPath) {
    throw new Error('runPipeline: videoPath is required');
  }
  if (!outputDir) {
    throw new Error('runPipeline: outputDir is required');
  }
  if (!Array.isArray(stages)) {
    throw new Error('runPipeline: stages must be an array');
  }

  const ctx = buildPipelineContext(videoPath, outputDir);
  fs.mkdirSync(ctx.outputDir, { recursive: true });
  ensureWorkspaceLayout(ctx.outputDir);
  writeContractsFile(ctx.outputDir);

  const trace = [];
  const stageTimingsMs = [];
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (!stage || typeof stage.run !== 'function') {
      throw new Error(`runPipeline: invalid stage at index ${i}`);
    }
    const id = stage.id ? String(stage.id) : `stage_${i}`;
    const result = stage.run(ctx);
    stageTimingsMs.push(0);
    const ok = Boolean(result && (result.ok === true || result.status === 0));
    trace.push({ id, ok });
    if (!ok) {
      const { reportPath } = writePipelineReportFile({
        workspaceRoot: ctx.outputDir,
        reportPath: pipelineReportPath,
        pipelineOk: false,
        trace,
        stageTimingsMs,
        ensureFinalVideo: { skipped: true, reason: 'pipeline_failed' },
      });
      return {
        ok: false,
        executionModel: EXECUTION_MODEL,
        trace,
        failedStageId: id,
        stoppedAt: i,
        stage_timings_ms: stageTimingsMs,
        pipeline_report_path: reportPath,
      };
    }
  }

  let ensureFinalVideo;
  try {
    ensureFinalVideo = ensureFinalVideoMp4(ctx.outputDir);
  } catch (err) {
    const { reportPath } = writePipelineReportFile({
      workspaceRoot: ctx.outputDir,
      reportPath: pipelineReportPath,
      pipelineOk: false,
      trace,
      stageTimingsMs,
      ensureFinalVideo: {
        skipped: true,
        error: err && err.message ? err.message : String(err),
      },
    });
    return {
      ok: false,
      executionModel: EXECUTION_MODEL,
      trace,
      failedStageId: 'ensure_final_video',
      stage_timings_ms: stageTimingsMs,
      pipeline_report_path: reportPath,
    };
  }

  const { reportPath } = writePipelineReportFile({
    workspaceRoot: ctx.outputDir,
    reportPath: pipelineReportPath,
    pipelineOk: true,
    trace,
    stageTimingsMs,
    ensureFinalVideo,
  });

  return {
    ok: true,
    executionModel: EXECUTION_MODEL,
    trace,
    stage_timings_ms: stageTimingsMs,
    pipeline_report_path: reportPath,
    ensure_final_video: ensureFinalVideo,
  };
}

module.exports = {
  runPipeline,
};
