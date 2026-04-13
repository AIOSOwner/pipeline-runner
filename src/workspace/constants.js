'use strict';

const RELATIVE_STAGES = {
  ingest: 'stages/ingest',
  transcript: 'stages/transcript',
  dubbing: 'stages/dubbing',
  subtitle: 'stages/subtitle',
  final: 'stages/final',
};

const RELATIVE_ARTIFACTS = {
  video_reference: 'stages/ingest/input_video_ref.json',
  audio: 'stages/ingest/audio/source_full.wav',
  timeline: 'stages/ingest/timeline.json',
  translated_transcript: 'stages/transcript/translated_transcript.json',
  dubbed_audio: 'stages/dubbing/dubbed_audio/full.wav',
  subtitle: 'stages/subtitle/subtitles_translated.srt',
  final_video: 'stages/final/final_video.mp4',
};

const ARTIFACT_STAGE = {
  video_reference: 'ingest',
  audio: 'ingest',
  timeline: 'ingest',
  translated_transcript: 'transcript',
  dubbed_audio: 'dubbing',
  subtitle: 'subtitle',
  final_video: 'final',
};

const ARTIFACT_HANDOFFS = [
  { artifact: 'video_reference', from_stage: 'ingest', to_stage: 'transcript' },
  { artifact: 'timeline', from_stage: 'ingest', to_stage: 'transcript' },
  { artifact: 'audio', from_stage: 'ingest', to_stage: 'transcript' },
  { artifact: 'translated_transcript', from_stage: 'transcript', to_stage: 'dubbing' },
  { artifact: 'dubbed_audio', from_stage: 'dubbing', to_stage: 'subtitle' },
  { artifact: 'subtitle', from_stage: 'subtitle', to_stage: 'final' },
];

const SCHEMA_VERSION = '1.0.0';

module.exports = {
  RELATIVE_STAGES,
  RELATIVE_ARTIFACTS,
  ARTIFACT_STAGE,
  ARTIFACT_HANDOFFS,
  SCHEMA_VERSION,
};
