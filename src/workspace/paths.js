'use strict';

const path = require('node:path');
const { RELATIVE_STAGES, RELATIVE_ARTIFACTS } = require('./constants');

function resolveWorkspacePaths(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  const stages = {};
  for (const [k, rel] of Object.entries(RELATIVE_STAGES)) {
    stages[k] = path.join(root, rel);
  }

  const artifacts = {};
  for (const [k, rel] of Object.entries(RELATIVE_ARTIFACTS)) {
    artifacts[k] = path.join(root, rel);
  }

  return {
    workspaceRoot: root,
    stages,
    artifacts,
  };
}

module.exports = {
  resolveWorkspacePaths,
};
