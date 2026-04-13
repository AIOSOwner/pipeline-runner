'use strict';

const fs = require('node:fs');
const { EXECUTION_MODEL } = require('./invoke-stage');
const path = require('node:path');
const { runBlackboxStage, getStageRuntimeDir } = require('./stage-runtime');
const { stableStringify } = require('./json-stable');
const { getDefaultStages } = require('./default-stages');
const {
  validateRequiredArtifacts,
  artifactsRelativeToRuntime,
  buildStageInputDocument,
  safeResolveUnder,
  resolveArtifactMap,
} = require('./pipeline-wiring');
const { validateProjectedFinalVideoMp4 } = require('./final-video-validate');

function isStageSucceeded(status) {
  const u = String(status).toUpperCase();
  return u === 'COMPLETED' || u === 'SUCCESS';
}

function statusForReport(status) {
  return isStageSucceeded(status) ? 'COMPLETED' : String(status).toUpperCase();
}

function projectFinalVideoToRuntimeRoot(runtimeRoot, finalStageDir, relativeFinalVideo) {
  const src = safeResolveUnder(finalStageDir, relativeFinalVideo);
  const dest = path.join(path.resolve(runtimeRoot), 'final_video.mp4');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return dest;
}

function writePipelineReport(runtimeRoot, trace, finalVideoRelative) {
  const reportPath = path.join(path.resolve(runtimeRoot), 'pipeline_report.json');
  const report = {
    overall_status: trace.every((s) => s.status === 'COMPLETED') ? 'COMPLETED' : 'FAILED',
    stages: trace.map((s) => ({
      stage_id: s.stage_id,
      status: s.status,
      artifacts: s.artifacts || {},
      timing_ms: 0,
    })),
    final_video_path: finalVideoRelative,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, stableStringify(report), 'utf8');
  return reportPath;
}

function runExplicitStagesPipeline(options) {
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
      const reportPath = writePipelineReport(runtimeRoot, trace, null);
      return {
        ok: false,
        executionModel: EXECUTION_MODEL,
        trace: trace.map((t) => ({ id: t.stage_id, ok: t.status === 'COMPLETED' })),
        failedStageId: stageId,
        stoppedAt: i,
        pipeline_report_path: reportPath,
      };
    }

    const stageDir = getStageRuntimeDir(runtimeRoot, stageId);
    const relArtifacts = artifactsRelativeToRuntime(runtimeRoot, stageDir, r.stageOutput.artifacts);
    trace.push({
      stage_id: stageId,
      status: statusForReport(r.stageOutput.status),
      artifacts: relArtifacts,
    });
  }

  const reportPath = writePipelineReport(runtimeRoot, trace, null);

  return {
    ok: true,
    executionModel: EXECUTION_MODEL,
    trace: trace.map((t) => ({ id: t.stage_id, ok: t.status === 'COMPLETED' })),
    pipeline_report_path: reportPath,
  };
}

function runWiredPipeline(options) {
  const { runtimeRoot, videoPath, targetLanguage, projectsRoot } = options || {};
  if (!runtimeRoot) {
    throw new Error('runWiredPipeline: runtimeRoot is required');
  }
  if (!videoPath || typeof videoPath !== 'string') {
    throw new Error('runWiredPipeline: videoPath is required');
  }
  if (!targetLanguage || typeof targetLanguage !== 'string') {
    throw new Error('runWiredPipeline: targetLanguage is required');
  }

  const wiredStages = (() => {
    if (!projectsRoot) {
      return getDefaultStages();
    }
    const base = path.resolve(projectsRoot);
    return [
      { stage_id: 'ingest', entrypoint: path.join(base, 'video-ingest-standardizer', 'src', 'index.js'), input: {} },
      { stage_id: 'transcript', entrypoint: path.join(base, 'audio-transcript-transformer', 'src', 'index.js'), input: {} },
      { stage_id: 'subtitle', entrypoint: path.join(base, 'subtitle-video-rebuilder', 'src', 'index.js'), input: {} },
      { stage_id: 'dub_audio', entrypoint: path.join(base, 'dubbed-audio-rebuilder', 'src', 'index.js'), input: {} },
      { stage_id: 'final', entrypoint: path.join(base, 'video-final-composer', 'src', 'index.js'), input: {} },
    ];
  })();

  fs.mkdirSync(path.resolve(runtimeRoot, 'stages'), { recursive: true });
  const trace = [];
  const ctx = { videoPath, targetLanguage, resolved: {} };

  for (let i = 0; i < wiredStages.length; i++) {
    const def = wiredStages[i];
    const stageId = def.stage_id;
    const input = buildStageInputDocument(stageId, ctx);
    const r = runBlackboxStage({
      runtimeRoot,
      stageId,
      stageEntrypoint: def.entrypoint,
      input,
    });

    const stageDir = getStageRuntimeDir(runtimeRoot, stageId);

    if (!r.ok) {
      trace.push({ stage_id: stageId, status: 'FAILED', artifacts: {}, error: r.error });
      const reportPath = writePipelineReport(runtimeRoot, trace, null);
      return {
        ok: false,
        executionModel: EXECUTION_MODEL,
        trace: trace.map((t) => ({ id: t.stage_id, ok: t.status === 'COMPLETED' })),
        failedStageId: stageId,
        stoppedAt: i,
        pipeline_report_path: reportPath,
      };
    }

    const v = validateRequiredArtifacts(stageId, stageDir, r.stageOutput.artifacts);
    if (!v.ok) {
      trace.push({ stage_id: stageId, status: 'FAILED', artifacts: {}, error: v.error });
      const reportPath = writePipelineReport(runtimeRoot, trace, null);
      return {
        ok: false,
        executionModel: EXECUTION_MODEL,
        trace: trace.map((t) => ({ id: t.stage_id, ok: t.status === 'COMPLETED' })),
        failedStageId: stageId,
        stoppedAt: i,
        pipeline_report_path: reportPath,
      };
    }

    const absArtifacts = resolveArtifactMap(stageDir, r.stageOutput.artifacts);
    ctx.resolved[stageId] = { artifacts: absArtifacts };

    const relArtifacts = artifactsRelativeToRuntime(runtimeRoot, stageDir, r.stageOutput.artifacts);
    trace.push({
      stage_id: stageId,
      status: statusForReport(r.stageOutput.status),
      artifacts: relArtifacts,
    });

    if (stageId === 'final') {
      projectFinalVideoToRuntimeRoot(runtimeRoot, stageDir, r.stageOutput.artifacts.final_video_mp4);
      const fv = validateProjectedFinalVideoMp4(runtimeRoot);
      if (!fv.ok) {
        trace.pop();
        trace.push({
          stage_id: 'final',
          status: 'FAILED',
          artifacts: relArtifacts,
          error: fv.error,
        });
        const reportPath = writePipelineReport(runtimeRoot, trace, null);
        return {
          ok: false,
          executionModel: EXECUTION_MODEL,
          trace: trace.map((t) => ({ id: t.stage_id, ok: t.status === 'COMPLETED' })),
          failedStageId: 'final',
          stoppedAt: i,
          pipeline_report_path: reportPath,
        };
      }
    }
  }

  const reportPath = writePipelineReport(runtimeRoot, trace, 'final_video.mp4');

  return {
    ok: true,
    executionModel: EXECUTION_MODEL,
    trace: trace.map((t) => ({ id: t.stage_id, ok: t.status === 'COMPLETED' })),
    pipeline_report_path: reportPath,
  };
}

function runPipeline(options) {
  if (options && Array.isArray(options.stages)) {
    return runExplicitStagesPipeline(options);
  }
  return runWiredPipeline(options);
}

module.exports = {
  runPipeline,
  runExplicitStagesPipeline,
  runWiredPipeline,
};
