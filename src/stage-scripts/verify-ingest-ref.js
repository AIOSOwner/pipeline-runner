'use strict';

const fs = require('node:fs');
const path = require('node:path');

const expectedVideo = process.env.PIPELINE_VIDEO_PATH;
const refPath = process.env.PIPELINE_INPUT_VIDEO_REF;

if (!expectedVideo || !refPath) {
  process.stderr.write('verify-ingest-ref: missing PIPELINE_VIDEO_PATH or PIPELINE_INPUT_VIDEO_REF\n');
  process.exit(2);
}

const raw = fs.readFileSync(path.resolve(refPath), 'utf8');
const doc = JSON.parse(raw);
if (!doc || path.resolve(doc.video_path) !== path.resolve(expectedVideo)) {
  process.stderr.write('verify-ingest-ref: input_video_ref mismatch\n');
  process.exit(1);
}
