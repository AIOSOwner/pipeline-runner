'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runWiredPipeline } = require('../src/runner/run-pipeline');
const { validateProjectedFinalVideoMp4 } = require('../src/runner/final-video-validate');

function installStubProjects(projectsRoot) {
  const stub = path.join(__dirname, 'fixtures', 'wired-stub-stage.js');
  for (const name of [
    'video-ingest-standardizer',
    'audio-transcript-transformer',
    'subtitle-video-rebuilder',
    'dubbed-audio-rebuilder',
    'video-final-composer',
  ]) {
    const dir = path.join(projectsRoot, name, 'src');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(stub, path.join(dir, 'index.js'));
  }
}

test('e2e stub: two successful runs produce identical pipeline_report.json', () => {
  const hash = (root) =>
    crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'pipeline_report.json'))).digest('hex');

  const makeRun = () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-e2e-'));
    const projectsRoot = path.join(tmp, 'projects');
    installStubProjects(projectsRoot);
    const video = path.join(tmp, 'in.mp4');
    fs.writeFileSync(video, 'mp4');
    const runtimeRoot = path.join(tmp, 'runtime');
    const result = runWiredPipeline({
      runtimeRoot,
      videoPath: video,
      targetLanguage: 'en',
      projectsRoot,
    });
    assert.equal(result.ok, true);
    return { runtimeRoot, hash: hash(runtimeRoot) };
  };

  const a = makeRun();
  const b = makeRun();
  assert.equal(a.hash, b.hash);
});

test('e2e stub: pipeline_report lists five stages with stage_id, status, and artifacts', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-e2e-'));
  const projectsRoot = path.join(tmp, 'projects');
  installStubProjects(projectsRoot);
  const video = path.join(tmp, 'in.mp4');
  fs.writeFileSync(video, 'mp4');
  const runtimeRoot = path.join(tmp, 'runtime');

  const result = runWiredPipeline({
    runtimeRoot,
    videoPath: video,
    targetLanguage: 'fr',
    projectsRoot,
  });

  assert.equal(result.ok, true);
  const report = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'pipeline_report.json'), 'utf8'));
  assert.equal(report.stages.length, 5);
  const ids = report.stages.map((s) => s.stage_id);
  assert.deepEqual(ids, ['ingest', 'transcript', 'subtitle', 'dub_audio', 'final']);
  for (const s of report.stages) {
    assert.ok(s.stage_id);
    assert.equal(s.status, 'COMPLETED');
    assert.ok(s.artifacts && typeof s.artifacts === 'object');
  }
});

test('runWiredPipeline fails final validation when projected final_video.mp4 is empty', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-e2e-'));
  const projectsRoot = path.join(tmp, 'projects');
  installStubProjects(projectsRoot);

  const badFinal = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const outArg = process.argv.find((a) => a.startsWith('--output_dir='));
const outputDir = outArg.slice('--output_dir='.length);
function writeJson(rel, body) {
  const p = path.join(outputDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(body, null, 2), 'utf8');
}
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'final_video.mp4'), '');
writeJson('composition_report.json', {});
writeJson('manifest.json', {});
fs.writeFileSync(path.join(outputDir, 'stage_output.json'), JSON.stringify({
  status: 'SUCCESS',
  artifacts: {
    final_video_mp4: 'final_video.mp4',
    composition_report_json: 'composition_report.json',
    manifest_json: 'manifest.json'
  },
  error: null
}, null, 2));
`;
  const dir = path.join(projectsRoot, 'video-final-composer', 'src');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.js'), badFinal, 'utf8');

  const video = path.join(tmp, 'in.mp4');
  fs.writeFileSync(video, 'mp4');

  const result = runWiredPipeline({
    runtimeRoot: path.join(tmp, 'runtime'),
    videoPath: video,
    targetLanguage: 'en',
    projectsRoot,
  });

  assert.equal(result.ok, false);
  assert.equal(result.failedStageId, 'final');
});

test('validateProjectedFinalVideoMp4 rejects non-mp4 magic', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-e2e-'));
  fs.writeFileSync(path.join(root, 'final_video.mp4'), 'not-an-mp4-file');
  const v = validateProjectedFinalVideoMp4(root);
  assert.equal(v.ok, false);
  assert.match(v.error, /ftyp/);
});
