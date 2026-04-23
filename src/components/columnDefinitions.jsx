
/**
 * Utility to format track duration from milliseconds to mm:ss
 */
export const formatDuration = (ms) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Utility to format dates to YYYY-MM-DD
 */
export const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
};

const asNumber = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
};

const getBaseTrack = (track) => (track?.track && track?.track?.id ? track.track : track);

const getTopLevelMeta = (track, key) => {
    if (track && Object.prototype.hasOwnProperty.call(track, key)) return track[key];
    return null;
};

const hasValue = (val) => val !== null && val !== undefined && val !== '';

const getName = (track) => {
    const base = getBaseTrack(track);
    return base?.name || track?.details?.name || '-';
};

const getArtists = (track) => {
    const base = getBaseTrack(track);

    if (typeof base?.artists === 'string') return base.artists;

    const artists = Array.isArray(base?.artists)
        ? base.artists
        : (track?.details?.artists || []);

    return artists.map((a) => a?.name).filter(Boolean).join(', ') || '-';
};

const getPrimaryArtist = (track) => {
    const base = getBaseTrack(track);

    if (typeof base?.artists === 'string') {
        return base.artists.split(',').map((s) => s.trim()).filter(Boolean)[0] || '-';
    }

    if (Array.isArray(base?.artists) && base.artists.length > 0) {
        return base.artists[0]?.name || '-';
    }

    return track?.details?.artists?.[0]?.name || '-';
};

const getField = (track, key) => {
    if (track && Object.prototype.hasOwnProperty.call(track, key) && hasValue(track[key])) {
        return track[key];
    }

    const base = getBaseTrack(track);

    if (base && Object.prototype.hasOwnProperty.call(base, key) && hasValue(base[key])) {
        return base[key];
    }

    if (track?.feats && Object.prototype.hasOwnProperty.call(track.feats, key) && hasValue(track.feats[key])) {
        return track.feats[key];
    }

    if (base?.feats && Object.prototype.hasOwnProperty.call(base.feats, key) && hasValue(base.feats[key])) {
        return base.feats[key];
    }

    if (key === 'isrc') {
        const topLevelIsrc = track?.external_ids?.isrc;
        if (hasValue(topLevelIsrc)) return topLevelIsrc;

        const baseIsrc = base?.external_ids?.isrc;
        if (hasValue(baseIsrc)) return baseIsrc;
    }

    return track?.feats?.[key] ?? base?.feats?.[key];
};

const getAlbumName = (track) => {
    const base = getBaseTrack(track);
    if (typeof base?.album === 'string') return base.album;
    return base?.album?.name || '-';
};

const getAlbumReleaseDate = (track) => {
    const base = getBaseTrack(track);
    return base?.release_date || base?.album?.release_date || null;
};

const getAlbumYear = (track) => {
    const base = getBaseTrack(track);
    if (base?.release_year) return base.release_year;

    const date = getAlbumReleaseDate(track);
    if (!date) return null;
    const parsed = Number.parseInt(String(date).slice(0, 4), 10);
    return Number.isFinite(parsed) ? parsed : null;
};

const getAddedAt = (track) => {
    const base = getBaseTrack(track);
    return getTopLevelMeta(track, 'added_at') || base?.added_at || track?.feats?.date_added || null;
};

const getLastPlayedAt = (track) => {
    const base = getBaseTrack(track);
    return (
        getTopLevelMeta(track, 'played_at') ||
        base?.last_played_at ||
        getTopLevelMeta(track, 'added_at') ||
        base?.added_at ||
        track?.feats?.date_added ||
        null
    );
};

const getContextType = (track) => {
    const base = getBaseTrack(track);
    let source = null;
    if (track?.feats?.sources instanceof Set && track.feats.sources.size > 0) {
        source = Array.from(track.feats.sources)[0];
    } else if (Array.isArray(track?.feats?.sources) && track.feats.sources.length > 0) {
        source = track.feats.sources[0];
    }

    return base?.context_type || getTopLevelMeta(track, 'context')?.type || source || track?.feats?.source || null;
};

const getGenres = (track) => {
    const genres = getField(track, 'genres');
    if (genres instanceof Set) {
        return Array.from(genres)[0] || '-';
    }
    if (Array.isArray(genres)) {
        return genres[0] || '-';
    }
    return getField(track, 'topGenre') || '-';
};

const getPercentLabel = (val) => {
    const n = asNumber(val);
    return n === null ? '-' : `${Math.round(n * 100)}%`;
};

const getNumberLabel = (val) => {
    const n = asNumber(val);
    return n === null ? '-' : Math.round(n);
};

/**
 * Column definitions for the TrackTable.
 * Each column has:
 * - id: unique identifier
 * - label: display text for header
 * - sortKey: the key used for sorting (if it matches a property in track.feats)
 * - align: text alignment ('left', 'center', 'right')
 * - getValue: function to get the raw value for sorting/filtering
 * - render: function to render the cell content (React component or string)
 * - className: additional CSS classes for the cell
 * - isExtra: if true, only shown when NOT in staging mode
 */
export const trackColumns = [
    {
        id: 'title',
        label: 'Title',
        sortKey: 'title',
        align: 'left',
        getValue: (track) => getName(track),
        render: (track) => getName(track),
        className: 'font-medium text-white',
        sticky: true,
        width: 'w-[280px]',
        tooltip: 'The name of the track'
    },
    // {
    //     id: 'artist',
    //     label: 'Artist',
    //     sortKey: 'artist',
    //     align: 'left',
    //     getValue: (track) => getPrimaryArtist(track),
    //     render: (track) => getPrimaryArtist(track),
    //     className: 'text-zinc-400',
    //     sticky: true,
    //     width: 'w-[200px]',
    //     tooltip: 'The primary artist of the track'
    // },
    {
        id: 'artists',
        label: 'Artists',
        sortKey: 'artists',
        align: 'left',
        isExtra: true,
        getValue: (track) => getArtists(track),
        render: (track) => getArtists(track),
        className: 'text-zinc-400',
        tooltip: 'All artists associated with the track'
    },
    {
        id: 'album',
        label: 'Album',
        sortKey: 'album',
        align: 'left',
        isExtra: true,
        getValue: (track) => getAlbumName(track),
        render: (track) => getAlbumName(track),
        className: 'text-zinc-400',
        tooltip: 'The album the track belongs to'
    },
    {
        id: 'genres',
        label: 'Genres',
        sortKey: 'genres',
        align: 'left',
        isExtra: true,
        getValue: (track) => getGenres(track),
        render: (track) => getGenres(track),
        className: 'text-zinc-400',
        tooltip: 'All genre classifications associated with the track'
    },
    {
        id: 'year',
        label: 'Year',
        sortKey: 'year',
        align: 'center',
        isExtra: true,
        getValue: (track) => getAlbumYear(track) || track?.year || track?.feats?.year || -1,
        render: (track) => {
            const val = getAlbumYear(track) || track?.year || track?.feats?.year;
            return val > 0 ? val : '-';
        },
        className: 'text-zinc-400',
        tooltip: 'The year the recording was released'
    },
    {
        id: 'release_date',
        label: 'Rel Date',
        sortKey: 'release_date',
        align: 'center',
        isExtra: true,
        getValue: (track) => getAlbumReleaseDate(track) || '',
        render: (track) => formatDate(getAlbumReleaseDate(track)),
        className: 'text-zinc-400',
        tooltip: 'The full release date'
    },
    {
        id: 'date_added',
        label: 'Added',
        sortKey: 'date_added',
        align: 'center',
        isExtra: true,
        getValue: (track) => {
            const val = getAddedAt(track);
            return val ? new Date(val).getTime() : 0;
        },
        render: (track) => formatDate(getAddedAt(track)),
        className: 'text-zinc-400',
        tooltip: 'The date the track was added to your collection'
    },
    {
        id: 'last_played_at',
        label: 'Played',
        sortKey: 'last_played_at',
        align: 'center',
        isExtra: true,
        getValue: (track) => {
            const val = getLastPlayedAt(track);
            return val ? new Date(val).getTime() : 0;
        },
        render: (track) => formatDate(getLastPlayedAt(track)),
        className: 'text-zinc-400',
        tooltip: 'The last time you played this track'
    },
    {
        id: 'context_type',
        label: 'Ctx',
        sortKey: 'context_type',
        align: 'center',
        isExtra: true,
        getValue: (track) => getContextType(track) || '-',
        render: (track) => getContextType(track) || '-',
        className: 'text-zinc-400',
        tooltip: 'The context in which the track was found'
    },
    {
        id: 'explicit',
        label: 'Exp',
        sortKey: 'explicit',
        align: 'center',
        isExtra: true,
        getValue: (track) => track?.explicit ?? track?.feats?.explicit,
        render: (track) => {
            const val = track?.explicit ?? track?.feats?.explicit;
            return val === true ? 'Yes' : val === false ? 'No' : '-';
        },
        className: 'text-zinc-400',
        tooltip: 'Whether the track contains explicit content'
    },
    {
        id: 'track_number',
        label: 'Trk',
        sortKey: 'track_number',
        align: 'center',
        isExtra: true,
        getValue: (track) => asNumber(getField(track, 'track_number')) ?? -1,
        render: (track) => getField(track, 'track_number') ?? '-',
        className: 'text-zinc-400',
        tooltip: 'The position of the track on the album'
    },
    {
        id: 'disc_number',
        label: 'Dsc',
        sortKey: 'disc_number',
        align: 'center',
        isExtra: true,
        getValue: (track) => asNumber(getField(track, 'disc_number')) ?? -1,
        render: (track) => getField(track, 'disc_number') ?? '-',
        className: 'text-zinc-400',
        tooltip: 'The disc number on the album'
    },
    {
        id: 'tempo',
        label: 'BPM',
        sortKey: 'tempo',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'tempo') ?? 0,
        render: (track) => getNumberLabel(getField(track, 'tempo')),
        className: 'text-zinc-400',
        tooltip: 'Beats Per Minute (Tempo)'
    },
    {
        id: 'energy',
        label: 'Eng',
        sortKey: 'energy',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'energy') ?? 0,
        render: (track) => getPercentLabel(getField(track, 'energy')),
        className: 'text-zinc-400',
        tooltip: 'Measures intensity and activity'
    },
    {
        id: 'danceability',
        label: 'Dnc',
        sortKey: 'danceability',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'danceability') ?? 0,
        render: (track) => getPercentLabel(getField(track, 'danceability')),
        className: 'text-zinc-400',
        tooltip: 'How suitable a track is for dancing'
    },
    {
        id: 'loudness',
        label: 'dB',
        sortKey: 'loudness',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'loudness') ?? -Infinity,
        render: (track) => getNumberLabel(getField(track, 'loudness')),
        className: 'text-zinc-400',
        tooltip: 'Overall loudness in decibels (dB)'
    },
    {
        id: 'valence',
        label: 'Val',
        sortKey: 'valence',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'valence') ?? 0,
        render: (track) => getPercentLabel(getField(track, 'valence')),
        className: 'text-zinc-400',
        tooltip: 'Musical positiveness (happiness)'
    },
    {
        id: 'speechiness',
        label: 'Spc',
        sortKey: 'speechiness',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'speechiness') ?? 0,
        render: (track) => getPercentLabel(getField(track, 'speechiness')),
        className: 'text-zinc-400',
        tooltip: 'Presence of spoken words'
    },
    {
        id: 'acousticness',
        label: 'Acst',
        sortKey: 'acousticness',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'acousticness') ?? 0,
        render: (track) => getPercentLabel(getField(track, 'acousticness')),
        className: 'text-zinc-400',
        tooltip: 'Likelihood the track is acoustic'
    },
    {
        id: 'instrumentalness',
        label: 'Inst',
        sortKey: 'instrumentalness',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'instrumentalness') ?? 0,
        render: (track) => getPercentLabel(getField(track, 'instrumentalness')),
        className: 'text-zinc-400',
        tooltip: 'Likelihood the track contains no vocals'
    },
    {
        id: 'liveness',
        label: 'Live',
        sortKey: 'liveness',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'liveness') ?? 0,
        render: (track) => getPercentLabel(getField(track, 'liveness')),
        className: 'text-zinc-400',
        tooltip: 'Likelihood the track was recorded live'
    },
    {
        id: 'key_label',
        label: 'Key',
        sortKey: 'key_label',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'key_label') || '-',
        render: (track) => getField(track, 'key_label') || '-',
        className: 'text-zinc-400',
        tooltip: 'The estimated musical key of the track'
    },
    {
        id: 'mode_label',
        label: 'Mod',
        sortKey: 'mode_label',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'mode_label') || '-',
        render: (track) => getField(track, 'mode_label') || '-',
        className: 'text-zinc-400',
        tooltip: 'Musical scale (Major or Minor)'
    },
    {
        id: 'time_signature',
        label: 'TS',
        sortKey: 'time_signature',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'time_signature') ?? -1,
        render: (track) => getField(track, 'time_signature') ?? '-',
        className: 'text-zinc-400',
        tooltip: 'Number of beats in each bar'
    },
    {
        id: 'duration',
        label: 'Dur',
        sortKey: 'duration_ms',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'duration_ms') ?? 0,
        render: (track) => formatDuration(getField(track, 'duration_ms')),
        className: 'text-zinc-400',
        tooltip: 'The length of the track'
    },
    {
        id: 'popularity',
        label: 'Pop',
        sortKey: 'popularity',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'popularity') ?? -1,
        render: (track) => getField(track, 'popularity') ?? '-',
        className: 'text-zinc-400',
        tooltip: 'Popularity of the track (0-100)'
    },
    {
        id: 'isrc',
        label: 'ISRC',
        sortKey: 'isrc',
        align: 'center',
        isExtra: true,
        getValue: (track) => getField(track, 'isrc') || '-',
        render: (track) => getField(track, 'isrc') || '-',
        className: 'text-zinc-400',
        tooltip: 'International Standard Recording Code'
    }
];
