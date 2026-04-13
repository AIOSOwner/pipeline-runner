'use strict';

const path = require('node:path');
const { invokeStage } = require('./invoke-stage');

function getDefaultStages() {
  const bootstrapScript = path.join(__dirname, '..', 'stage-scripts', 'bootstrap-ingest.js');
  const verifyScript = path.join(__dirname, '..', 'stage-scripts', 'verify-ingest-ref.js');

  return [
    {
      id: 'ingest_bootstrap',
      run: (ctx) =>
        invokeStage({
          command: process.execPath,
          args: [bootstrapScript],
          env: {
            PIPELINE_VIDEO_PATH: ctx.videoPath,
            PIPELINE_OUTPUT_DIR: ctx.outputDir,
          },
        }),
    },
    {
      id: 'ingest_verify_ref',
      run: (ctx) =>
        invokeStage({
          command: process.execPath,
          args: [verifyScript],
          env: {
            PIPELINE_VIDEO_PATH: ctx.videoPath,
            PIPELINE_INPUT_VIDEO_REF: ctx.paths.artifacts.video_reference,
          },
        }),
    },
  ];
}

module.exports = {
  getDefaultStages,
};
