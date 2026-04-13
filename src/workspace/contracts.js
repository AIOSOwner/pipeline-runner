'use strict';

const { ARTIFACT_HANDOFFS, ARTIFACT_STAGE, RELATIVE_ARTIFACTS, SCHEMA_VERSION } = require('./constants');

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

function buildContractsDocument() {
  const artifacts = {};
  for (const id of Object.keys(RELATIVE_ARTIFACTS).sort()) {
    artifacts[id] = {
      stage: ARTIFACT_STAGE[id],
      relative_path: RELATIVE_ARTIFACTS[id],
    };
  }

  return {
    artifact: 'contracts',
    schema_version: SCHEMA_VERSION,
    stages: ['dubbing', 'final', 'ingest', 'subtitle', 'transcript'],
    artifacts,
    handoffs: ARTIFACT_HANDOFFS.slice(),
  };
}

module.exports = {
  buildContractsDocument,
  stableStringify,
};
