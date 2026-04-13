'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STAGE_ORDER = ['ingest', 'transcript', 'subtitle', 'dub_audio', 'final'];

const REQUIRED_ARTIFACTS = {
  ingest: ['timeline_json', 'audio_source_wav'],
  transcript: ['transcript_json', 'translated_transcript_json'],
  subtitle: ['subtitles_original_srt', 'subtitles_translated_srt'],
  dub_audio: ['full_audio_wav'],
  final: ['final_video_mp4', 'composition_report_json', 'manifest_json'],
};

function safeResolveUnder(stageDir, relativePath) {
  const base = path.resolve(stageDir);
  const resolved = path.resolve(base, relativePath);
  const rel = path.relative(base, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`artifact path escapes stage directory: ${relativePath}`);
  }
  return resolved;
}

function resolveArtifactMap(stageDir, artifacts) {
  const absolute = {};
  for (const key of Object.keys(artifacts).sort()) {
    const rel = artifacts[key];
    if (typeof rel !== 'string' || rel.length === 0) {
      throw new Error(`artifact "${key}" must be a non-empty string`);
    }
    absolute[key] = safeResolveUnder(stageDir, rel);
  }
  return absolute;
}

function validateRequiredArtifacts(stageId, stageDir, artifacts) {
  const required = REQUIRED_ARTIFACTS[stageId];
  if (!required) {
    throw new Error(`unknown stage_id for validation: ${stageId}`);
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(artifacts, key)) {
      return { ok: false, error: `missing required artifact key "${key}" for stage ${stageId}` };
    }
    const rel = artifacts[key];
    try {
      const abs = safeResolveUnder(stageDir, rel);
      if (!fs.existsSync(abs)) {
        return {
          ok: false,
          error: `missing file for artifact "${key}" at ${abs}`,
        };
      }
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }
  return { ok: true };
}

function artifactsRelativeToRuntime(runtimeRoot, stageDir, artifacts) {
  const root = path.resolve(runtimeRoot);
  const out = {};
  for (const key of Object.keys(artifacts).sort()) {
    const abs = safeResolveUnder(stageDir, artifacts[key]);
    out[key] = path.relative(root, abs).replace(/\\/g, '/');
  }
  return out;
}

function buildStageInputDocument(stageId, ctx) {
  const { videoPath, targetLanguage, resolved } = ctx;

  if (stageId === 'ingest') {
    return {
      inputs: {
        video_path: videoPath,
      },
    };
  }

  if (stageId === 'transcript') {
    const ing = resolved.ingest;
    return {
      inputs: {
        audio_path: ing.artifacts.audio_source_wav,
        timeline_path: ing.artifacts.timeline_json,
        target_language: targetLanguage,
      },
    };
  }

  if (stageId === 'subtitle') {
    const ing = resolved.ingest;
    const tr = resolved.transcript;
    return {
      inputs: {
        video_path: videoPath,
        timeline_path: ing.artifacts.timeline_json,
        transcript_path: tr.artifacts.transcript_json,
        translated_transcript_path: tr.artifacts.translated_transcript_json,
      },
    };
  }

  if (stageId === 'dub_audio') {
    const ing = resolved.ingest;
    const tr = resolved.transcript;
    return {
      inputs: {
        timeline_path: ing.artifacts.timeline_json,
        translated_transcript_path: tr.artifacts.translated_transcript_json,
      },
    };
  }

  if (stageId === 'final') {
    const ing = resolved.ingest;
    const dub = resolved.dub_audio;
    return {
      inputs: {
        video_path: videoPath,
        timeline_path: ing.artifacts.timeline_json,
        dubbed_audio_path: dub.artifacts.full_audio_wav,
      },
    };
  }

  throw new Error(`buildStageInputDocument: unsupported stage ${stageId}`);
}

module.exports = {
  STAGE_ORDER,
  REQUIRED_ARTIFACTS,
  safeResolveUnder,
  resolveArtifactMap,
  validateRequiredArtifacts,
  artifactsRelativeToRuntime,
  buildStageInputDocument,
};
