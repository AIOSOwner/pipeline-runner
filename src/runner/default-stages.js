'use strict';

const path = require('node:path');

function getDefaultStages() {
  const projectsRoot = path.resolve(__dirname, '..', '..', '..');

  return [
    {
      stage_id: 'ingest',
      entrypoint: path.join(projectsRoot, 'video-ingest-standardizer', 'src', 'index.js'),
      input: {},
    },
    {
      stage_id: 'transcript',
      entrypoint: path.join(projectsRoot, 'audio-transcript-transformer', 'src', 'index.js'),
      input: {},
    },
    {
      stage_id: 'subtitle',
      entrypoint: path.join(projectsRoot, 'subtitle-video-rebuilder', 'src', 'index.js'),
      input: {},
    },
    {
      stage_id: 'dub_audio',
      entrypoint: path.join(projectsRoot, 'dubbed-audio-rebuilder', 'src', 'index.js'),
      input: {},
    },
    {
      stage_id: 'final',
      entrypoint: path.join(projectsRoot, 'video-final-composer', 'src', 'index.js'),
      input: {},
    },
  ];
}

module.exports = {
  getDefaultStages,
};
