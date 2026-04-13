'use strict';

const fs = require('node:fs');
const path = require('node:path');

function validateProjectedFinalVideoMp4(runtimeRoot) {
  const p = path.join(path.resolve(runtimeRoot), 'final_video.mp4');
  if (!fs.existsSync(p)) {
    return { ok: false, error: `final_video.mp4 missing at ${p}` };
  }
  const st = fs.statSync(p);
  if (!st.isFile()) {
    return { ok: false, error: 'final_video.mp4 is not a regular file' };
  }
  if (st.size === 0) {
    return { ok: false, error: 'final_video.mp4 is empty' };
  }
  if (st.size < 12) {
    return { ok: false, error: 'final_video.mp4 is too small to be a valid MP4 (ISO BMFF)' };
  }

  const fd = fs.openSync(p, 'r');
  try {
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    const ftyp = buf.slice(4, 8).toString('ascii');
    if (ftyp !== 'ftyp') {
      return {
        ok: false,
        error: 'final_video.mp4 is invalid: expected ISO BMFF ftyp at offset 4',
      };
    }
  } finally {
    fs.closeSync(fd);
  }

  return { ok: true };
}

module.exports = {
  validateProjectedFinalVideoMp4,
};
