'use strict';

const fs = require('node:fs');
const { resolveWorkspacePaths } = require('../workspace/paths');

function ensureFinalVideoMp4(workspaceRootAbs) {
  const paths = resolveWorkspacePaths(workspaceRootAbs);
  const target = paths.artifacts.final_video;
  if (!fs.existsSync(target)) {
    throw new Error(`ensureFinalVideoMp4: missing required artifact: ${target}`);
  }
  return { exists: true, path: target };
}

module.exports = {
  ensureFinalVideoMp4,
};
