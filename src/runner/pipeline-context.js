'use strict';

const path = require('node:path');
const { resolveWorkspacePaths } = require('../workspace/paths');

function resolveStagePaths(workspaceRoot) {
  const resolved = resolveWorkspacePaths(path.resolve(workspaceRoot));
  return {
    ...resolved,
    artifacts: {
      ...resolved.artifacts,
      inputVideoRef: resolved.artifacts.video_reference,
    },
  };
}

function buildPipelineContext(videoPath, outputDir) {
  const outputDirAbs = path.resolve(outputDir);
  return {
    videoPath: path.resolve(videoPath),
    outputDir: outputDirAbs,
    paths: resolveStagePaths(outputDirAbs),
  };
}

module.exports = {
  resolveStagePaths,
  buildPipelineContext,
};
