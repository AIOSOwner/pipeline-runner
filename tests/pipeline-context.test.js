'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveStagePaths, buildPipelineContext } = require('../src/runner/pipeline-context');

test('resolveStagePaths: all paths stay under workspace root', () => {
  const root = path.join('/tmp', 'pipeline-root');
  const paths = resolveStagePaths(root);
  assert.equal(paths.workspaceRoot, path.resolve(root));
  for (const value of Object.values(paths.stages)) {
    assert.ok(value.startsWith(path.resolve(root)));
  }
  assert.ok(paths.artifacts.video_reference.startsWith(path.resolve(root)));
  assert.ok(paths.artifacts.inputVideoRef.startsWith(path.resolve(root)));
  assert.equal(paths.artifacts.inputVideoRef, paths.artifacts.video_reference);
});

test('buildPipelineContext: resolves video and output dirs', () => {
  const ctx = buildPipelineContext('/tmp/video.mp4', '/tmp/workspace');
  assert.equal(ctx.videoPath, path.resolve('/tmp/video.mp4'));
  assert.equal(ctx.outputDir, path.resolve('/tmp/workspace'));
  assert.ok(ctx.paths.artifacts.video_reference.startsWith(ctx.outputDir));
});
