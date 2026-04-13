'use strict';

const { validatePipelineArtifacts, SCHEMA_VERSION } = require('./validate');
const { getWavDurationSeconds } = require('./wav-duration');
const {
  getTimelineEndSeconds,
  getTimelineSegmentCount,
  validateTimelineSegmentOrdering,
} = require('./timeline');
const { ffprobeAudioStreamCount } = require('./ffprobe');

module.exports = {
  validatePipelineArtifacts,
  SCHEMA_VERSION,
  getWavDurationSeconds,
  getTimelineEndSeconds,
  getTimelineSegmentCount,
  validateTimelineSegmentOrdering,
  ffprobeAudioStreamCount,
};
