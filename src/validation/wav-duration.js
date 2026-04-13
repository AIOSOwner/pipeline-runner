'use strict';

const fs = require('node:fs');

function getWavDurationSeconds(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 44) {
    throw new Error('WAV file too small');
  }
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF WAVE file');
  }

  let offset = 12;
  let sampleRate = null;
  let channels = null;
  let bitsPerSample = null;
  let audioFormat = null;
  let dataSize = null;

  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (id === 'fmt ') {
      audioFormat = buf.readUInt16LE(chunkStart);
      channels = buf.readUInt16LE(chunkStart + 2);
      sampleRate = buf.readUInt32LE(chunkStart + 4);
      bitsPerSample = buf.readUInt16LE(chunkStart + 14);
    } else if (id === 'data') {
      dataSize = size;
      break;
    }
    offset = chunkStart + size + (size % 2);
  }

  if (audioFormat !== 1) {
    throw new Error(`Unsupported WAV format: ${audioFormat}`);
  }
  if (!sampleRate || !channels || !bitsPerSample || dataSize == null) {
    throw new Error('WAV missing required fmt/data chunks');
  }

  const bytesPerFrame = (channels * bitsPerSample) / 8;
  const frames = dataSize / bytesPerFrame;
  return frames / sampleRate;
}

module.exports = {
  getWavDurationSeconds,
};
