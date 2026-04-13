'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runBlackboxStage } = require('../src/runner/stage-runtime');

function writeFakeStageScript(scriptPath, status = 'COMPLETED') {
  const script = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const inputArg = process.argv.find((a) => a.startsWith('--input_json='));
const outArg = process.argv.find((a) => a.startsWith('--output_dir='));
if (!inputArg || !outArg) {
  process.exit(2);
}
const inputPath = inputArg.slice('--input_json='.length);
const outputDir = outArg.slice('--output_dir='.length);
const inputDoc = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const stageOutput = {
  stage_id: inputDoc.stage_id || path.basename(outputDir),
  status: '${status}',
  artifacts: { echo_input: inputPath }
};
fs.writeFileSync(path.join(outputDir, 'stage_output.json'), JSON.stringify(stageOutput, null, 2));
`;
  fs.writeFileSync(scriptPath, script, 'utf8');
}

test('runBlackboxStage persists input.json and reads stage_output.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-stage-'));
  const stageScript = path.join(root, 'fake-stage.js');
  writeFakeStageScript(stageScript, 'COMPLETED');

  const input = { stage_id: 'ingest', video_path: '/tmp/video.mp4', z: 2, a: 1 };
  const result = runBlackboxStage({
    runtimeRoot: root,
    stageId: 'ingest',
    stageEntrypoint: stageScript,
    input,
  });

  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(path.join(root, 'stages', 'ingest', 'input.json')));
  assert.ok(fs.existsSync(path.join(root, 'stages', 'ingest', 'stage_output.json')));
  const persisted = JSON.parse(fs.readFileSync(path.join(root, 'stages', 'ingest', 'input.json'), 'utf8'));
  assert.deepEqual(persisted, input);
  assert.equal(result.stageOutput.status, 'COMPLETED');
});

test('runBlackboxStage fails when stage_output status is FAILED', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-stage-'));
  const stageScript = path.join(root, 'fake-stage-fail.js');
  writeFakeStageScript(stageScript, 'FAILED');

  const result = runBlackboxStage({
    runtimeRoot: root,
    stageId: 'transcript',
    stageEntrypoint: stageScript,
    input: { stage_id: 'transcript' },
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /FAILED/);
});

test('runBlackboxStage rejects stage_output when artifact values are not non-empty strings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-stage-'));
  const stageScript = path.join(root, 'bad-artifacts.js');
  const script = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const inputArg = process.argv.find((a) => a.startsWith('--input_json='));
const outArg = process.argv.find((a) => a.startsWith('--output_dir='));
const outputDir = outArg.slice('--output_dir='.length);
fs.writeFileSync(path.join(outputDir, 'stage_output.json'), JSON.stringify({
  status: 'COMPLETED',
  artifacts: { bad: 123 }
}));
`;
  fs.writeFileSync(stageScript, script, 'utf8');

  const result = runBlackboxStage({
    runtimeRoot: root,
    stageId: 'ingest',
    stageEntrypoint: stageScript,
    input: {},
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /non-empty string path/);
});

test('runBlackboxStage does not modify stage-produced artifact files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-stage-'));
  const stageScript = path.join(root, 'writes-payload.js');
  const script = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const inputArg = process.argv.find((a) => a.startsWith('--input_json='));
const outArg = process.argv.find((a) => a.startsWith('--output_dir='));
const outputDir = outArg.slice('--output_dir='.length);
const payload = path.join(outputDir, 'payload.bin');
fs.writeFileSync(payload, 'stage-owned-bytes', 'utf8');
const outPath = path.join(outputDir, 'stage_output.json');
fs.writeFileSync(outPath, JSON.stringify({
  status: 'COMPLETED',
  artifacts: { payload_path: payload }
}));
`;
  fs.writeFileSync(stageScript, script, 'utf8');

  const result = runBlackboxStage({
    runtimeRoot: root,
    stageId: 'ingest',
    stageEntrypoint: stageScript,
    input: {},
  });

  assert.equal(result.ok, true);
  const payloadPath = path.join(root, 'stages', 'ingest', 'payload.bin');
  assert.equal(fs.readFileSync(payloadPath, 'utf8'), 'stage-owned-bytes');
});
