'use strict';

const { invokeStage, EXECUTION_MODEL } = require('./runner/invoke-stage');
const { runBlackboxStage, getStageRuntimeDir, parseCliArg } = require('./runner/stage-runtime');
const { runPipeline } = require('./runner/run-pipeline');
const { getDefaultStages } = require('./runner/default-stages');
const { buildPipelineContext, resolveStagePaths } = require('./runner/pipeline-context');
const workspace = require('./workspace');
const validation = require('./validation');
const report = require('./report');

module.exports = {
  invokeStage,
  runBlackboxStage,
  getStageRuntimeDir,
  parseCliArg,
  EXECUTION_MODEL,
  runPipeline,
  getDefaultStages,
  buildPipelineContext,
  resolveStagePaths,
  ...workspace,
  ...validation,
  ...report,
};
