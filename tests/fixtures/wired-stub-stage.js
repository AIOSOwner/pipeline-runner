'use strict';

const fs = require('node:fs');
const path = require('node:path');

const inputArg = process.argv.find((a) => a.startsWith('--input_json='));
const outArg = process.argv.find((a) => a.startsWith('--output_dir='));
if (!inputArg || !outArg) process.exit(2);

const outputDir = outArg.slice('--output_dir='.length);
const stageId = path.basename(outputDir);

function writeJson(rel, body) {
  const p = path.join(outputDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body, null, 2), 'utf8');
}

function touch(rel, body = 'x') {
  const p = path.join(outputDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

const artifacts = {};

if (stageId === 'ingest') {
  writeJson('timeline.json', {});
  touch('audio/source_full.wav', 'wav');
  artifacts.timeline_json = 'timeline.json';
  artifacts.audio_source_wav = 'audio/source_full.wav';
} else if (stageId === 'transcript') {
  writeJson('transcript.json', {});
  writeJson('translated_transcript.json', {});
  artifacts.transcript_json = 'transcript.json';
  artifacts.translated_transcript_json = 'translated_transcript.json';
} else if (stageId === 'subtitle') {
  touch('subtitles_original.srt', '1\n');
  touch('subtitles_translated.srt', '1\n');
  artifacts.subtitles_original_srt = 'subtitles_original.srt';
  artifacts.subtitles_translated_srt = 'subtitles_translated.srt';
} else if (stageId === 'dub_audio') {
  touch('full_audio.wav', 'wav');
  artifacts.full_audio_wav = 'full_audio.wav';
} else if (stageId === 'final') {
  const mp4 = Buffer.alloc(12);
  mp4.writeUInt32BE(12, 0);
  mp4.write('ftyp', 4);
  mp4.write('isom', 8);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'final_video.mp4'), mp4);
  writeJson('composition_report.json', {});
  writeJson('manifest.json', {});
  artifacts.final_video_mp4 = 'final_video.mp4';
  artifacts.composition_report_json = 'composition_report.json';
  artifacts.manifest_json = 'manifest.json';
} else {
  process.exit(3);
}

fs.writeFileSync(
  path.join(outputDir, 'stage_output.json'),
  JSON.stringify({ status: 'SUCCESS', artifacts, error: null }, null, 2),
  'utf8',
);
