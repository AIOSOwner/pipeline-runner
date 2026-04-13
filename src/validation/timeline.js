'use strict';

function getTimelineEndSeconds(doc) {
  if (!doc || typeof doc !== 'object') {
    throw new Error('timeline must be an object');
  }
  if (typeof doc.end === 'number' && Number.isFinite(doc.end)) {
    return doc.end;
  }
  if (Array.isArray(doc.segments) && doc.segments.length > 0) {
    const last = doc.segments[doc.segments.length - 1];
    if (last && typeof last.end === 'number' && Number.isFinite(last.end)) {
      return last.end;
    }
  }
  throw new Error('timeline end is missing');
}

function getTimelineSegmentCount(doc) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.segments)) {
    return 0;
  }
  return doc.segments.length;
}

function validateTimelineSegmentOrdering(doc) {
  if (!doc || typeof doc !== 'object') {
    return { ok: false, error: 'timeline not an object' };
  }
  if (!Array.isArray(doc.segments)) {
    return { ok: false, error: 'timeline.segments missing' };
  }
  let prevStart = null;
  for (let i = 0; i < doc.segments.length; i++) {
    const s = doc.segments[i];
    if (!s || typeof s !== 'object') {
      return { ok: false, error: `timeline.segments[${i}] invalid` };
    }
    if (typeof s.start !== 'number' || typeof s.end !== 'number') {
      return { ok: false, error: `timeline.segments[${i}] start/end missing` };
    }
    if (s.start > s.end) {
      return { ok: false, error: `timeline.segments[${i}] start > end` };
    }
    if (prevStart != null && s.start < prevStart) {
      return { ok: false, error: 'timeline segments not ordered by start' };
    }
    prevStart = s.start;
  }
  return { ok: true };
}

module.exports = {
  getTimelineEndSeconds,
  getTimelineSegmentCount,
  validateTimelineSegmentOrdering,
};
