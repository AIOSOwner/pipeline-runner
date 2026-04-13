'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildContractsDocument } = require('../workspace/contracts');
const { RELATIVE_ARTIFACTS } = require('../workspace/constants');

const SCHEMA_VERSION = '1.0.0';

function sortKeysDeep(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortKeysDeep(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

function normalizeEnsureFinalVideo(ensureFinalVideo, workspaceRoot) {
  if (!ensureFinalVideo || typeof ensureFinalVideo !== 'object') {
    return { skipped: true };
  }
  const normalized = { ...ensureFinalVideo };
  if (typeof normalized.path === 'string') {
    normalized.relative_path = path.relative(workspaceRoot, normalized.path).replaceAll('\\', '/');
    delete normalized.path;
  }
  return normalized;
}

function buildPipelineReportDocument(options) {
  const { workspaceRoot, pipelineOk, trace, stageTimingsMs, ensureFinalVideo } = options;
  const root = path.resolve(workspaceRoot);
  const stages = trace.map((item, index) => ({
    duration_ms: stageTimingsMs[index] != null ? stageTimingsMs[index] : null,
    id: item.id,
    ok: item.ok,
  }));
  const total = stageTimingsMs.reduce((acc, ms) => acc + (Number.isFinite(ms) ? ms : 0), 0);

  return {
    artifact: 'pipeline_report',
    schema_version: SCHEMA_VERSION,
    pipeline_ok: pipelineOk,
    stages,
    timing_ms: {
      per_stage: stageTimingsMs.slice(),
      total: Math.round(total * 1000) / 1000,
    },
    contracts_snapshot: buildContractsDocument(root),
    ensure_final_video: normalizeEnsureFinalVideo(ensureFinalVideo, root),
    final_video_artifact: {
      relative_path: RELATIVE_ARTIFACTS.final_video,
    },
  };
}

function writePipelineReportFile(options) {
  const {
    workspaceRoot,
    reportPath: reportPathOpt,
    pipelineOk,
    trace,
    stageTimingsMs,
    ensureFinalVideo,
  } = options;

  const root = path.resolve(workspaceRoot);
  const reportPath = reportPathOpt ? path.resolve(reportPathOpt) : path.join(root, 'pipeline_report.json');
  const document = buildPipelineReportDocument({
    workspaceRoot: root,
    pipelineOk,
    trace,
    stageTimingsMs,
    ensureFinalVideo,
  });

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, stableStringify(document), 'utf8');
  return { reportPath, document };
}

module.exports = {
  SCHEMA_VERSION,
  buildPipelineReportDocument,
  writePipelineReportFile,
};
