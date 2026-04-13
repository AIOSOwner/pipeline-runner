'use strict';

const { spawnSync } = require('node:child_process');

function ffprobeAudioStreamCount(filePath) {
  const r = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'a',
      '-show_entries',
      'stream=index',
      '-of',
      'csv=p=0',
      filePath,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`ffprobe failed: ${r.stderr || r.stdout || 'unknown error'}`);
  }
  return String(r.stdout)
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0).length;
}

module.exports = {
  ffprobeAudioStreamCount,
};
