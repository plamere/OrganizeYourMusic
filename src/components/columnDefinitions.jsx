
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
        getValue: (track) => track.details.name,
        render: (track) => track.details.name,
        className: 'font-medium text-white',
        sticky: true,
        width: 'w-[280px]'
    },
    {
        id: 'artist',
        label: 'Artist',
        sortKey: 'artist',
        align: 'left',
        getValue: (track) => track.details.artists[0]?.name || '-',
        render: (track) => track.details.artists[0]?.name || '-',
        className: 'text-zinc-400',
        sticky: true,
        width: 'w-[200px]'
    },
    {
        id: 'genre',
        label: 'Genre',
        sortKey: 'topGenre',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.topGenre || '',
        render: (track) => track.feats.topGenre || '-',
        className: 'text-zinc-400'
    },
    {
        id: 'year',
        label: 'Year',
        sortKey: 'year',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.year,
        render: (track) => track.feats.year > 0 ? track.feats.year : '-',
        className: 'text-zinc-400'
    },
    {
        id: 'date_added',
        label: 'Added',
        sortKey: 'date_added',
        align: 'center',
        isExtra: true,
        getValue: (track) => new Date(track.feats.date_added).getTime(),
        render: (track) => formatDate(track.feats.date_added),
        className: 'text-zinc-400'
    },
    {
        id: 'tempo',
        label: 'BPM',
        sortKey: 'tempo',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.tempo,
        render: (track) => Math.round(track.feats.tempo) || '-',
        className: 'text-zinc-400'
    },
    {
        id: 'energy',
        label: 'Energy',
        sortKey: 'energy',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.energy,
        render: (track) => `${Math.round(track.feats.energy * 100)}%`,
        className: 'text-zinc-400'
    },
    {
        id: 'danceability',
        label: 'Dance',
        sortKey: 'danceability',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.danceability,
        render: (track) => `${Math.round(track.feats.danceability * 100)}%`,
        className: 'text-zinc-400'
    },
    {
        id: 'loudness',
        label: 'dB',
        sortKey: 'loudness',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.loudness,
        render: (track) => Math.round(track.feats.loudness),
        className: 'text-zinc-400'
    },
    {
        id: 'valence',
        label: 'Val',
        sortKey: 'valence',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.valence,
        render: (track) => `${Math.round(track.feats.valence * 100)}%`,
        className: 'text-zinc-400'
    },
    {
        id: 'duration',
        label: 'Dur',
        sortKey: 'duration_ms',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.duration_ms,
        render: (track) => formatDuration(track.feats.duration_ms),
        className: 'text-zinc-400'
    },
    {
        id: 'popularity',
        label: 'Pop',
        sortKey: 'popularity',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.popularity,
        render: (track) => track.feats.popularity,
        className: 'text-zinc-400'
    },
    {
        id: 'play_count',
        label: 'Plays',
        sortKey: 'play_count',
        align: 'center',
        isExtra: true,
        getValue: (track) => track.feats.play_count || 0,
        render: (track) => track.feats.play_count || 0,
        className: 'text-zinc-400'
    }
];
