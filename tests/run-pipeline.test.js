'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { stableStringify } = require('../src/runner/json-stable');
const { runPipeline } = require('../src/runner/run-pipeline');

function writeStageScript(scriptPath, status = 'COMPLETED', markerName = null) {
  const script = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const inputArg = process.argv.find((a) => a.startsWith('--input_json='));
const outArg = process.argv.find((a) => a.startsWith('--output_dir='));
if (!inputArg || !outArg) process.exit(2);
const inputPath = inputArg.slice('--input_json='.length);
const outputDir = outArg.slice('--output_dir='.length);
${markerName ? `fs.writeFileSync(path.join(outputDir, '${markerName}'), 'ran');` : ''}
const doc = {
  stage_id: path.basename(outputDir),
  status: '${status}',
  artifacts: { artifact_path: path.join(outputDir, 'artifact.txt') }
};
fs.writeFileSync(path.join(outputDir, 'stage_output.json'), JSON.stringify(doc, null, 2));
`;
  fs.writeFileSync(scriptPath, script, 'utf8');
}

test('runPipeline executes stages in order and writes report', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-run-'));
  const s1 = path.join(root, 's1.js');
  const s2 = path.join(root, 's2.js');
  writeStageScript(s1, 'COMPLETED');
  writeStageScript(s2, 'COMPLETED');

  const result = runPipeline({
    runtimeRoot: root,
    stages: [
      { stage_id: 'ingest', entrypoint: s1, input: { a: 1 } },
      { stage_id: 'transcript', entrypoint: s2, input: { b: 2 } },
    ],
  });

  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(path.join(root, 'stages', 'ingest', 'input.json')));
  assert.ok(fs.existsSync(path.join(root, 'stages', 'ingest', 'stage_output.json')));
  assert.ok(fs.existsSync(path.join(root, 'stages', 'transcript', 'input.json')));
  assert.ok(fs.existsSync(path.join(root, 'stages', 'transcript', 'stage_output.json')));
  const report = JSON.parse(fs.readFileSync(path.join(root, 'pipeline_report.json'), 'utf8'));
  assert.equal(report.overall_status, 'COMPLETED');
  assert.equal(report.stages.length, 2);
});

test('runPipeline fails fast when a stage reports FAILED', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-run-'));
  const s1 = path.join(root, 's1.js');
  const s2 = path.join(root, 's2.js');
  const s3 = path.join(root, 's3.js');
  writeStageScript(s1, 'COMPLETED', 'marker1');
  writeStageScript(s2, 'FAILED', 'marker2');
  writeStageScript(s3, 'COMPLETED', 'marker3');

  const result = runPipeline({
    runtimeRoot: root,
    stages: [
      { stage_id: 'ingest', entrypoint: s1, input: {} },
      { stage_id: 'transcript', entrypoint: s2, input: {} },
      { stage_id: 'subtitle', entrypoint: s3, input: {} },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.failedStageId, 'transcript');
  assert.ok(fs.existsSync(path.join(root, 'stages', 'ingest', 'marker1')));
  assert.ok(fs.existsSync(path.join(root, 'stages', 'transcript', 'marker2')));
  assert.ok(!fs.existsSync(path.join(root, 'stages', 'subtitle', 'marker3')));
});

test('runPipeline fails when stage_output.json is missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-run-'));
  const script = path.join(root, 'bad-stage.js');
  fs.writeFileSync(
    script,
    `'use strict'; process.exit(0);`,
    'utf8',
  );

  const result = runPipeline({
    runtimeRoot: root,
    stages: [{ stage_id: 'ingest', entrypoint: script, input: {} }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.failedStageId, 'ingest');
});

test('pipeline_report.json uses stable key ordering (deterministic serialization)', () => {
  const a = stableStringify({ z: 1, a: { y: 2, b: 3 } });
  const b = stableStringify({ a: { b: 3, y: 2 }, z: 1 });
  assert.equal(a, b);
});

test('runPipeline writes identical pipeline_report bytes for identical trace data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-run-'));
  const s1 = path.join(root, 's1.js');
  writeStageScript(s1, 'COMPLETED');

  const result = runPipeline({
    runtimeRoot: root,
    stages: [{ stage_id: 'ingest', entrypoint: s1, input: { k: 1 } }],
  });

  assert.equal(result.ok, true);
  const reportPath = path.join(root, 'pipeline_report.json');
  const h1 = crypto.createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex');

  fs.unlinkSync(reportPath);
  const result2 = runPipeline({
    runtimeRoot: root,
    stages: [{ stage_id: 'ingest', entrypoint: s1, input: { k: 1 } }],
  });

  assert.equal(result2.ok, true);
  const h2 = crypto.createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex');
  assert.equal(h1, h2);
});
