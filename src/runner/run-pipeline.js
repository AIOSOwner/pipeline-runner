'use strict';

const fs = require('node:fs');
const { EXECUTION_MODEL } = require('./invoke-stage');
const path = require('node:path');
const { runBlackboxStage } = require('./stage-runtime');
const { stableStringify } = require('./json-stable');

function writePipelineReport(runtimeRoot, trace) {
  const reportPath = path.join(path.resolve(runtimeRoot), 'pipeline_report.json');
  const report = {
    overall_status: trace.every((s) => s.status === 'COMPLETED') ? 'COMPLETED' : 'FAILED',
    stages: trace.map((s) => ({
      stage_id: s.stage_id,
      status: s.status,
      artifacts: s.artifacts || {},
      timing_ms: 0,
    })),
    final_video_path: null,
  };
  for (const stage of trace) {
    if (stage.artifacts && typeof stage.artifacts.final_video_path === 'string') {
      report.final_video_path = stage.artifacts.final_video_path;
    }
  }
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, stableStringify(report), 'utf8');
  return reportPath;
}

function runPipeline(options) {
  const { runtimeRoot, stages } = options || {};
  if (!runtimeRoot) {
    throw new Error('runPipeline: runtimeRoot is required');
  }
  if (!Array.isArray(stages)) {
    throw new Error('runPipeline: stages must be an array');
  }

  fs.mkdirSync(path.resolve(runtimeRoot, 'stages'), { recursive: true });
  const trace = [];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (!stage || typeof stage !== 'object') {
      throw new Error(`runPipeline: invalid stage at index ${i}`);
    }
    const stageId = stage.stage_id ? String(stage.stage_id) : `stage_${i}`;
    if (!stage.entrypoint || typeof stage.entrypoint !== 'string') {
      throw new Error(`runPipeline: stage ${stageId} missing entrypoint`);
    }

    const input = stage.input && typeof stage.input === 'object' ? stage.input : {};
    const r = runBlackboxStage({
      runtimeRoot,
      stageId,
      stageEntrypoint: stage.entrypoint,
      input,
    });

    if (!r.ok) {
      trace.push({ stage_id: stageId, status: 'FAILED', artifacts: {}, error: r.error });
      const reportPath = writePipelineReport(runtimeRoot, trace);
      return {
        ok: false,
        executionModel: EXECUTION_MODEL,
        trace: trace.map((t) => ({ id: t.stage_id, ok: t.status === 'COMPLETED' })),
        failedStageId: stageId,
        stoppedAt: i,
        pipeline_report_path: reportPath,
      };
    }

    trace.push({
      stage_id: stageId,
      status: String(r.stageOutput.status).toUpperCase(),
      artifacts: r.stageOutput.artifacts,
    });
  }

  const reportPath = writePipelineReport(runtimeRoot, trace);

  return {
    ok: true,
    executionModel: EXECUTION_MODEL,
    trace: trace.map((t) => ({ id: t.stage_id, ok: t.status === 'COMPLETED' })),
    pipeline_report_path: reportPath,
  };
}

module.exports = {
  runPipeline,
};
