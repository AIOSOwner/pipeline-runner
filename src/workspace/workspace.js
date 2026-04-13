'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolveWorkspacePaths } = require('./paths');
const { buildContractsDocument, stableStringify } = require('./contracts');

function ensureWorkspaceLayout(workspaceRoot) {
  const paths = resolveWorkspacePaths(workspaceRoot);
  fs.mkdirSync(paths.workspaceRoot, { recursive: true });

  for (const stageDir of Object.values(paths.stages)) {
    fs.mkdirSync(stageDir, { recursive: true });
  }

  for (const artifactPath of Object.values(paths.artifacts)) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  }

  return paths;
}

function writeContractsFile(workspaceRoot) {
  const paths = resolveWorkspacePaths(workspaceRoot);
  const doc = buildContractsDocument();
  const outPath = path.join(paths.workspaceRoot, 'contracts.json');
  fs.writeFileSync(outPath, stableStringify(doc), 'utf8');
  return outPath;
}

module.exports = {
  ensureWorkspaceLayout,
  writeContractsFile,
};
