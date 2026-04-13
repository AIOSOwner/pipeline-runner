'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runWiredPipeline } = require('../src/runner/run-pipeline');
const {
  buildStageInputDocument,
  validateRequiredArtifacts,
  REQUIRED_ARTIFACTS,
} = require('../src/runner/pipeline-wiring');

test('buildStageInputDocument routes logical artifacts to absolute paths', () => {
  const ctx = {
    videoPath: '/tmp/video.mp4',
    targetLanguage: 'es',
    resolved: {
      ingest: {
        artifacts: {
          timeline_json: '/r/stages/ingest/timeline.json',
          audio_source_wav: '/r/stages/ingest/audio/source_full.wav',
        },
      },
      transcript: {
        artifacts: {
          transcript_json: '/r/stages/transcript/transcript.json',
          translated_transcript_json: '/r/stages/transcript/translated_transcript.json',
        },
      },
      dub_audio: {
        artifacts: {
          full_audio_wav: '/r/stages/dub_audio/full_audio.wav',
        },
      },
    },
  };

  assert.equal(buildStageInputDocument('ingest', ctx).inputs.video_path, '/tmp/video.mp4');
  const tr = buildStageInputDocument('transcript', ctx);
  assert.equal(tr.inputs.audio_path, ctx.resolved.ingest.artifacts.audio_source_wav);
  assert.equal(tr.inputs.target_language, 'es');
  const fin = buildStageInputDocument('final', ctx);
  assert.equal(fin.inputs.dubbed_audio_path, ctx.resolved.dub_audio.artifacts.full_audio_wav);
});

test('validateRequiredArtifacts fails when a required key is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-art-'));
  fs.writeFileSync(path.join(dir, 'timeline.json'), '{}');
  const r = validateRequiredArtifacts('ingest', dir, { timeline_json: 'timeline.json' });
  assert.equal(r.ok, false);
  assert.match(r.error, /audio_source_wav/);
});

test('runWiredPipeline runs five stub stages, validates artifacts, projects final_video.mp4', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-wire-'));
  const projectsRoot = path.join(tmp, 'projects');
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
  const finalVideo = path.join(runtimeRoot, 'final_video.mp4');
  assert.ok(fs.existsSync(finalVideo));
  const report = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'pipeline_report.json'), 'utf8'));
  assert.equal(report.overall_status, 'COMPLETED');
  assert.equal(report.final_video_path, 'final_video.mp4');
  assert.equal(report.stages.length, 5);
  assert.ok(REQUIRED_ARTIFACTS.ingest.every((k) => k in report.stages[0].artifacts));
});

test('runWiredPipeline fails when a stage omits a required artifact file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-wire-'));
  const projectsRoot = path.join(tmp, 'projects');
  const badStub = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const outArg = process.argv.find((a) => a.startsWith('--output_dir='));
const outputDir = outArg.slice('--output_dir='.length);
fs.writeFileSync(path.join(outputDir, 'stage_output.json'), JSON.stringify({
  status: 'SUCCESS',
  artifacts: { timeline_json: 'timeline.json' },
  error: null
}));
fs.writeFileSync(path.join(outputDir, 'timeline.json'), '{}');
`;
  const dir = path.join(projectsRoot, 'video-ingest-standardizer', 'src');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.js'), badStub, 'utf8');

  const video = path.join(tmp, 'in.mp4');
  fs.writeFileSync(video, 'mp4');

  const result = runWiredPipeline({
    runtimeRoot: path.join(tmp, 'runtime'),
    videoPath: video,
    targetLanguage: 'en',
    projectsRoot,
  });

  assert.equal(result.ok, false);
  assert.equal(result.failedStageId, 'ingest');
});
