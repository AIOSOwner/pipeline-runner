'use strict';

const { invokeStage, EXECUTION_MODEL } = require('./runner/invoke-stage');
const { runBlackboxStage, getStageRuntimeDir, parseCliArg } = require('./runner/stage-runtime');
const { runPipeline, runWiredPipeline, runExplicitStagesPipeline } = require('./runner/run-pipeline');
const pipelineWiring = require('./runner/pipeline-wiring');
const { validateProjectedFinalVideoMp4 } = require('./runner/final-video-validate');
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
  runWiredPipeline,
  runExplicitStagesPipeline,
  pipelineWiring,
  validateProjectedFinalVideoMp4,
  getDefaultStages,
  buildPipelineContext,
  resolveStagePaths,
  ...workspace,
  ...validation,
  ...report,
};
