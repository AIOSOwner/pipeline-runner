'use strict';

const fs = require('node:fs');
const { runPipeline } = require('./runner/run-pipeline');
const { getDefaultStages } = require('./runner/default-stages');

function parseArgs(argv) {
  let videoPath = null;
  let outputDir = null;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--video' || arg === '-v') {
      videoPath = argv[++i] || null;
    } else if (arg === '--output-dir' || arg === '-o') {
      outputDir = argv[++i] || null;
    }
  }
  return { videoPath, outputDir };
}

function main(argv = process.argv) {
  const { videoPath, outputDir } = parseArgs(argv);
  if (!videoPath || !outputDir) {
    process.stderr.write('Usage: pipeline-runner --video <path> --output-dir <path>\n');
    return 2;
  }

  try {
    fs.accessSync(videoPath, fs.constants.R_OK);
  } catch {
    process.stderr.write(`Video is not readable: ${videoPath}\n`);
    return 2;
  }

  const result = runPipeline({
    videoPath,
    outputDir,
    stages: getDefaultStages(),
  });

  if (!result.ok) {
    process.stderr.write(`Pipeline failed at stage: ${result.failedStageId || 'unknown'}\n`);
    return 1;
  }

  process.stdout.write('Pipeline completed.\n');
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = {
  main,
  parseArgs,
};
