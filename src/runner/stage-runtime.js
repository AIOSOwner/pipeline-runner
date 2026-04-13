'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { invokeStage } = require('./invoke-stage');
const { stableStringify } = require('./json-stable');

function getStageRuntimeDir(runtimeRoot, stageId) {
  return path.join(path.resolve(runtimeRoot), 'stages', String(stageId));
}

function parseCliArg(argv, name) {
  const prefix = `${name}=`;
  for (const arg of argv) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return null;
}

function validateStageOutputDocument(doc, stageId) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error(`stage_output invalid for ${stageId}: must be an object`);
  }
  if (typeof doc.status !== 'string' || doc.status.length === 0) {
    throw new Error(`stage_output invalid for ${stageId}: missing status`);
  }
  if (!doc.artifacts || typeof doc.artifacts !== 'object' || Array.isArray(doc.artifacts)) {
    throw new Error(`stage_output invalid for ${stageId}: missing artifacts object`);
  }

  const artifactKeys = Object.keys(doc.artifacts);
  for (const key of artifactKeys) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error(`stage_output invalid for ${stageId}: artifact keys must be non-empty strings`);
    }
    const v = doc.artifacts[key];
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error(`stage_output invalid for ${stageId}: artifact "${key}" must be a non-empty string path`);
    }
  }
}

function runBlackboxStage(options) {
  const { runtimeRoot, stageId, stageEntrypoint, input } = options || {};
  if (!runtimeRoot || !stageId || !stageEntrypoint) {
    throw new Error('runBlackboxStage: runtimeRoot, stageId, and stageEntrypoint are required');
  }

  const stageDir = getStageRuntimeDir(runtimeRoot, stageId);
  fs.mkdirSync(stageDir, { recursive: true });
  const inputPath = path.join(stageDir, 'input.json');
  fs.writeFileSync(inputPath, stableStringify(input || {}), 'utf8');

  const cmd = invokeStage({
    command: process.execPath,
    args: [stageEntrypoint, `--input_json=${inputPath}`, `--output_dir=${stageDir}`],
    cwd: path.resolve(runtimeRoot, '..'),
  });
  if (!cmd.ok) {
    return {
      ok: false,
      stageId,
      stageDir,
      inputPath,
      error: `stage command failed: ${(cmd.stderr || cmd.stdout || '').trim() || 'unknown'}`,
    };
  }

  const outputPath = path.join(stageDir, 'stage_output.json');
  if (!fs.existsSync(outputPath)) {
    return { ok: false, stageId, stageDir, inputPath, error: 'stage_output.json is missing' };
  }

  let outputDoc;
  try {
    outputDoc = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } catch (err) {
    return { ok: false, stageId, stageDir, inputPath, error: `stage_output.json malformed: ${String(err.message || err)}` };
  }

  try {
    validateStageOutputDocument(outputDoc, stageId);
  } catch (err) {
    return { ok: false, stageId, stageDir, inputPath, error: String(err.message || err) };
  }

  if (String(outputDoc.status).toUpperCase() === 'FAILED') {
    return { ok: false, stageId, stageDir, inputPath, stageOutput: outputDoc, error: 'stage reported FAILED' };
  }

  return {
    ok: true,
    stageId,
    stageDir,
    inputPath,
    outputPath,
    stageOutput: outputDoc,
  };
}

module.exports = {
  getStageRuntimeDir,
  runBlackboxStage,
  parseCliArg,
};
