'use strict';

const fs = require('node:fs');
const path = require('node:path');

const videoPath = process.env.PIPELINE_VIDEO_PATH;
const outputDir = process.env.PIPELINE_OUTPUT_DIR;

if (!videoPath || !outputDir) {
  process.stderr.write('bootstrap-ingest: missing PIPELINE_VIDEO_PATH or PIPELINE_OUTPUT_DIR\n');
  process.exit(2);
}

const ingestDir = path.join(path.resolve(outputDir), 'stages', 'ingest');
const audioDir = path.join(ingestDir, 'audio');
const refPath = path.join(ingestDir, 'input_video_ref.json');

fs.mkdirSync(audioDir, { recursive: true });
fs.writeFileSync(refPath, `${JSON.stringify({ video_path: path.resolve(videoPath) }, null, 2)}\n`, 'utf8');
