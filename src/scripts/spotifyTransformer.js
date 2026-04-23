const KEY_LABELS = {
  0: 'C',
  1: 'C#',
  2: 'D',
  3: 'D#',
  4: 'E',
  5: 'F',
  6: 'F#',
  7: 'G',
  8: 'G#',
  9: 'A',
  10: 'A#',
  11: 'B',
};

const AUDIO_FEATURE_FIELDS = [
  'danceability',
  'energy',
  'valence',
  'tempo',
  'loudness',
  'speechiness',
  'acousticness',
  'instrumentalness',
  'liveness',
  'key',
  'mode',
  'time_signature',
];

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function toNullableString(value) {
  const trimmed = cleanString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function durationLabel(ms) {
  const totalMs = toNumberOrNull(ms);
  if (totalMs == null || totalMs < 0) return '0:00';

  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getReleaseYear(releaseDate) {
  const releaseText = cleanString(releaseDate);
  const year = Number.parseInt(releaseText.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function findTrackObjects(payload) {
  const out = [];

  asArray(payload).forEach((entry) => {
    if (!entry) return;

    if (entry.track && entry.track.id) {
      out.push({
        track: entry.track,
        addedAt: entry.added_at ?? null,
        lastPlayedAt: entry.played_at ?? null,
        contextType: entry.context?.type ?? null,
        contextName: null,
      });
      return;
    }

    if (entry.id && entry.album) {
      out.push({
        track: entry,
        addedAt: null,
        lastPlayedAt: null,
        contextType: null,
        contextName: null,
      });
    }
  });

  return out;
}

function collectTrackEntries(input) {
  if (!input) return [];

  const out = [];

  if (Array.isArray(input)) {
    return findTrackObjects(input);
  }

  if (input.track && input.track.id) {
    return findTrackObjects([input]);
  }

  if (input.id && input.album) {
    return findTrackObjects([input]);
  }

  if (Array.isArray(input.items)) {
    out.push(...findTrackObjects(input.items));
  }

  if (Array.isArray(input.tracks)) {
    out.push(...findTrackObjects(input.tracks));
  }

  if (input.tracks && Array.isArray(input.tracks.items)) {
    out.push(...findTrackObjects(input.tracks.items));
  }

  if (input.savedTracks) {
    out.push(...collectTrackEntries(input.savedTracks));
  }

  if (input.recentlyPlayed) {
    out.push(...collectTrackEntries(input.recentlyPlayed));
  }

  if (input.track) {
    out.push(...collectTrackEntries(input.track));
  }

  return out;
}

function normalizeAudioFeatures(audioFeaturesInput) {
  const map = new Map();

  const register = (item) => {
    if (!item || !item.id) return;
    map.set(item.id, item);
  };

  asArray(audioFeaturesInput).forEach((payload) => {
    if (!payload) return;

    if (Array.isArray(payload)) {
      payload.forEach(register);
      return;
    }

    if (payload.id) {
      register(payload);
    }

    if (Array.isArray(payload.audio_features)) {
      payload.audio_features.forEach(register);
    }
  });

  return map;
}

function buildBaseTrack(track) {
  const artistObjects = asArray(track?.artists).filter(Boolean);
  const artistNames = artistObjects
    .map((artist) => cleanString(artist.name))
    .filter(Boolean);

  const artistIds = artistObjects
    .map((artist) => toNullableString(artist.id))
    .filter(Boolean);

  const releaseDate = toNullableString(track?.album?.release_date);

  return {
    id: cleanString(track?.id),
    name: cleanString(track?.name),
    artists: artistNames.join(', '),
    artist_ids: artistIds,
    album: cleanString(track?.album?.name),
    album_id: cleanString(track?.album?.id),
    image_url: toNullableString(track?.album?.images?.[0]?.url),
    duration_ms: toNumberOrNull(track?.duration_ms) ?? 0,
    duration_label: durationLabel(track?.duration_ms),
    explicit: Boolean(track?.explicit),
    popularity: toNumberOrNull(track?.popularity) ?? 0,
    release_date: releaseDate,
    release_year: getReleaseYear(releaseDate),
    track_number: toNumberOrNull(track?.track_number) ?? 0,
    disc_number: toNumberOrNull(track?.disc_number) ?? 0,
    isrc: toNullableString(track?.external_ids?.isrc),
    danceability: null,
    energy: null,
    valence: null,
    tempo: null,
    loudness: null,
    speechiness: null,
    acousticness: null,
    instrumentalness: null,
    liveness: null,
    key: null,
    key_label: null,
    mode: null,
    mode_label: null,
    time_signature: null,
    last_played_at: null,
    added_at: null,
    context_type: null,
    context_name: null,
  };
}

function applyAudioFeatures(baseTrack, audioFeature) {
  if (!audioFeature) return;

  AUDIO_FEATURE_FIELDS.forEach((field) => {
    baseTrack[field] = toNumberOrNull(audioFeature[field]);
  });

  const keyValue = baseTrack.key;
  const modeValue = baseTrack.mode;

  baseTrack.key_label = Number.isInteger(keyValue) && keyValue in KEY_LABELS
    ? KEY_LABELS[keyValue]
    : null;

  if (modeValue === 0) {
    baseTrack.mode_label = 'Minor';
  } else if (modeValue === 1) {
    baseTrack.mode_label = 'Major';
  } else {
    baseTrack.mode_label = null;
  }
}

function mergeUserFields(baseTrack, entry) {
  if (entry.addedAt != null) {
    baseTrack.added_at = cleanString(entry.addedAt) || baseTrack.added_at;
  }

  if (entry.lastPlayedAt != null) {
    const playedAt = cleanString(entry.lastPlayedAt);
    if (!baseTrack.last_played_at || playedAt > baseTrack.last_played_at) {
      baseTrack.last_played_at = playedAt || baseTrack.last_played_at;
    }
  }

  if (entry.contextType != null) {
    baseTrack.context_type = cleanString(entry.contextType) || baseTrack.context_type;
  }

  if (entry.contextName != null) {
    baseTrack.context_name = cleanString(entry.contextName) || baseTrack.context_name;
  }
}

function normalizeTrackObject(track) {
  if (!track || !track.id) return null;
  const normalized = buildBaseTrack(track);
  return normalized.id ? normalized : null;
}

/**
 * Normalize mixed Spotify payloads to a flat, UI-ready track array.
 *
 * @param {object|array} input Spotify payload(s). Supports tracks, saved tracks, and recently played schemas.
 * @param {object|array|null} [audioFeaturesInput] Audio-features payload(s) from /v1/audio-features/{id} or /v1/audio-features?ids=...
 * @returns {Array<object>} Flat track objects unique by id.
 */
export function normalizeSpotifyTracks(input, audioFeaturesInput = null) {
  const entries = collectTrackEntries(input);
  const audioFeatureMap = normalizeAudioFeatures(audioFeaturesInput || input?.audioFeatures || input?.audio_features);
  const byId = new Map();

  entries.forEach((entry) => {
    const base = normalizeTrackObject(entry.track);
    if (!base) return;

    const existing = byId.get(base.id);
    const normalized = existing || base;

    if (!existing) {
      const matchingAudioFeatures = audioFeatureMap.get(base.id);
      applyAudioFeatures(normalized, matchingAudioFeatures);
      byId.set(base.id, normalized);
    }

    mergeUserFields(normalized, entry);
  });

  return Array.from(byId.values()).map((track) => ({
    ...track,
    artists: cleanString(track.artists),
    name: cleanString(track.name),
    album: cleanString(track.album),
    album_id: cleanString(track.album_id),
    release_date: track.release_date ?? null,
    added_at: track.added_at ?? null,
    last_played_at: track.last_played_at ?? null,
    context_type: track.context_type ?? null,
    context_name: track.context_name ?? null,
    image_url: track.image_url ?? null,
    isrc: track.isrc ?? null,
  }));
}

export default normalizeSpotifyTracks;
