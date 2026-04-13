'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolveWorkspacePaths } = require('../workspace/paths');
const { getWavDurationSeconds } = require('./wav-duration');
const {
  getTimelineEndSeconds,
  getTimelineSegmentCount,
  validateTimelineSegmentOrdering,
} = require('./timeline');
const { ffprobeAudioStreamCount } = require('./ffprobe');

const SCHEMA_VERSION = '1.0.0';
const EPS = 1e-3;

function sortKeysDeep(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortKeysDeep(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function validatePipelineArtifacts(options) {
  const { workspaceRoot, validationReportPath, finalVideoPath } = options || {};
  if (!workspaceRoot) {
    throw new Error('validatePipelineArtifacts: workspaceRoot is required');
  }
  if (!validationReportPath) {
    throw new Error('validatePipelineArtifacts: validationReportPath is required');
  }

  const root = path.resolve(workspaceRoot);
  const paths = resolveWorkspacePaths(root);
  const finalVideo = finalVideoPath ? path.resolve(finalVideoPath) : paths.artifacts.final_video;

  const checks = {};
  const errors = [];

  let timelineDoc = null;
  let transcriptDoc = null;

  if (!exists(paths.artifacts.timeline)) {
    checks.timeline_readable = { ok: false, error: 'missing timeline.json' };
    errors.push('timeline.json missing');
  } else {
    try {
      timelineDoc = JSON.parse(fs.readFileSync(paths.artifacts.timeline, 'utf8'));
      checks.timeline_readable = { ok: true };
    } catch (err) {
      checks.timeline_readable = { ok: false, error: String(err.message || err) };
      errors.push('timeline.json parse failed');
    }
  }

  if (!exists(paths.artifacts.translated_transcript)) {
    checks.translated_transcript_readable = { ok: false, error: 'missing translated_transcript.json' };
    errors.push('translated_transcript.json missing');
  } else {
    try {
      transcriptDoc = JSON.parse(fs.readFileSync(paths.artifacts.translated_transcript, 'utf8'));
      checks.translated_transcript_readable = { ok: true };
    } catch (err) {
      checks.translated_transcript_readable = { ok: false, error: String(err.message || err) };
      errors.push('translated_transcript.json parse failed');
    }
  }

  const orderCheck = timelineDoc ? validateTimelineSegmentOrdering(timelineDoc) : { ok: false, error: 'no timeline' };
  checks.timeline_consistency = orderCheck;
  if (!orderCheck.ok) {
    errors.push(`timeline consistency failed: ${orderCheck.error}`);
  }

  let audioDuration = null;
  if (!exists(paths.artifacts.dubbed_audio)) {
    checks.dubbed_audio_readable = { ok: false, error: 'missing dubbed audio' };
    errors.push('dubbed audio missing');
  } else {
    try {
      audioDuration = getWavDurationSeconds(paths.artifacts.dubbed_audio);
      checks.dubbed_audio_readable = { ok: true };
      checks.dubbed_audio_duration_seconds = { ok: true, value: audioDuration };
    } catch (err) {
      checks.dubbed_audio_readable = { ok: false, error: String(err.message || err) };
      errors.push(`dubbed audio unreadable: ${String(err.message || err)}`);
    }
  }

  let timelineEnd = null;
  if (timelineDoc) {
    try {
      timelineEnd = getTimelineEndSeconds(timelineDoc);
      checks.timeline_end_seconds = { ok: true, value: timelineEnd };
    } catch (err) {
      checks.timeline_end_seconds = { ok: false, error: String(err.message || err) };
      errors.push(`timeline end invalid: ${String(err.message || err)}`);
    }
  }

  if (audioDuration != null && timelineEnd != null) {
    const ok = Math.abs(audioDuration - timelineEnd) <= EPS;
    checks.dubbed_audio_matches_timeline_end = {
      ok,
      dubbed_audio_seconds: audioDuration,
      timeline_end_seconds: timelineEnd,
      tolerance: EPS,
    };
    if (!ok) {
      errors.push('dubbed audio duration does not equal timeline end');
    }
  } else {
    checks.dubbed_audio_matches_timeline_end = { ok: false, error: 'comparison unavailable' };
  }

  if (timelineDoc && transcriptDoc) {
    const timelineCount = getTimelineSegmentCount(timelineDoc);
    const transcriptCount = Array.isArray(transcriptDoc.segments) ? transcriptDoc.segments.length : 0;
    const ok = timelineCount === transcriptCount;
    checks.segment_count_preserved = {
      ok,
      timeline_segment_count: timelineCount,
      translated_transcript_segment_count: transcriptCount,
    };
    if (!ok) {
      errors.push('translated transcript segment count mismatch');
    }
  } else {
    checks.segment_count_preserved = { ok: false, error: 'missing timeline or transcript data' };
  }

  if (!exists(finalVideo)) {
    checks.final_video_readable = { ok: false, error: 'missing final video' };
    errors.push('final video missing');
  } else {
    try {
      const audioStreams = ffprobeAudioStreamCount(finalVideo);
      const ok = audioStreams === 1;
      checks.final_video_single_audio_stream = { ok, audio_stream_count: audioStreams };
      if (!ok) {
        errors.push(`final video must contain exactly one audio stream (got ${audioStreams})`);
      }
    } catch (err) {
      checks.final_video_single_audio_stream = { ok: false, error: String(err.message || err) };
      errors.push(`ffprobe failed for final video: ${String(err.message || err)}`);
    }
  }

  const ok = errors.length === 0;
  const report = {
    artifact: 'validation_report',
    schema_version: SCHEMA_VERSION,
    workspace_root: root,
    validation: { ok, result: ok ? 'passed' : 'failed' },
    checks,
    errors,
  };

  const out = path.resolve(validationReportPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(report), 'utf8');
  return { ok, report };
}

module.exports = {
  validatePipelineArtifacts,
  SCHEMA_VERSION,
};
