import React, { useState, useMemo, useEffect, useRef } from 'react';
import { trackColumns } from './columnDefinitions';

const getBaseTrack = (track) => (track?.track && track?.track?.id ? track.track : track);
const getTrackId = (track) => track?.id || track?.track?.id || null;
const getTrackName = (track) => {
    const base = getBaseTrack(track);
    return base?.name || track?.details?.name || '';
};
const getTrackArtists = (track) => {
    const base = getBaseTrack(track);
    if (typeof base?.artists === 'string') return base.artists;
    const artists = Array.isArray(base?.artists)
        ? base.artists
        : (track?.details?.artists || []);
    return artists.map((a) => a?.name).filter(Boolean).join(', ');
};
const getPreviewUrl = (track) => {
    const base = getBaseTrack(track);
    return base?.preview_url || track?.details?.preview_url || null;
};
const getTrackImage = (track) => {
    const base = getBaseTrack(track);
    return base?.image_url || track?.details?.image_url || track?.image_url || null;
};

const TrackTable = ({
    tracks,
    selectedIds,
    onToggleSelection,
    onToggleAll,
    onPlayTrack,
    nowPlayingId,
    isPlaying,
    pageSize: initialPageSize = 50,
    isStaging = false
}) => {
    const [sortConfig, setSortConfig] = useState({ key: 'popularity', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredImage, setHoveredImage] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const tableScrollRef = useRef(null);

    // Filter and Reorder columns based on context and relevancy (sorting)
    const activeColumns = useMemo(() => {
        let cols = trackColumns.filter(col => !isStaging || !col.isExtra);

        // Rearrange by relevancy: move sorted column to the front of non-sticky section
        if (sortConfig.key) {
            const sortIdx = cols.findIndex(c => c.sortKey === sortConfig.key || c.id === sortConfig.key);
            if (sortIdx !== -1 && !cols[sortIdx].sticky) {
                const sortedCol = cols[sortIdx];
                const otherCols = cols.filter((_, i) => i !== sortIdx);
                const stickyCount = otherCols.filter(c => c.sticky).length;

                // Insert after sticky columns
                cols = [
                    ...otherCols.slice(0, stickyCount),
                    sortedCol,
                    ...otherCols.slice(stickyCount)
                ];
            }
        }
        return cols;
    }, [isStaging, sortConfig]);

    // Calculate total width of all sticky columns for scroll padding
    const totalStickyWidth = useMemo(() => {
        let width = 48; // Base checkbox/play column
        activeColumns.forEach(col => {
            if (col.sticky) {
                if (col.id === 'title') width += 280;
                else if (col.id === 'artist') width += 200;
            }
        });
        return width;
    }, [activeColumns]);

    // Sort tracks
    const sortedTracks = useMemo(() => {
        let sortableTracks = [...tracks];
        if (sortConfig.key) {
            const column = trackColumns.find(c => c.sortKey === sortConfig.key || c.id === sortConfig.key);

            sortableTracks.sort((a, b) => {
                let aVal, bVal;

                if (column && column.getValue) {
                    aVal = column.getValue(a);
                    bVal = column.getValue(b);
                } else {
                    // Fallback for keys that might not be in trackColumns but are in feats
                    aVal = a?.[sortConfig.key] ?? a?.feats?.[sortConfig.key];
                    bVal = b?.[sortConfig.key] ?? b?.feats?.[sortConfig.key];
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableTracks;
    }, [tracks, sortConfig]);

    // Filter tracks
    const filteredTracks = useMemo(() => {
        if (!searchQuery) return sortedTracks;
        const q = searchQuery.toLowerCase();
        return sortedTracks.filter(t =>
            getTrackName(t).toLowerCase().includes(q) ||
            getTrackArtists(t).toLowerCase().includes(q)
        );
    }, [sortedTracks, searchQuery]);

    // Pagination
    const paginatedTracks = useMemo(() => {
        const start = currentPage * pageSize;
        return filteredTracks.slice(start, start + pageSize);
    }, [filteredTracks, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredTracks.length / pageSize);

    // Reset page when search or tracks change
    useEffect(() => {
        setCurrentPage(0);
    }, [searchQuery, tracks.length]);

    // Keep sorted results anchored to the beginning of the scroll container.
    useEffect(() => {
        if (!tableScrollRef.current) return;
        tableScrollRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }, [sortConfig]);

    const requestSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <i className="fa fa-sort opacity-20 ml-2"></i>;
        return sortConfig.direction === 'asc'
            ? <i className="fa fa-sort-asc ml-2 text-spotify-green"></i>
            : <i className="fa fa-sort-desc ml-2 text-spotify-green"></i>;
    };

    const isAllSelected = tracks.length > 0 && tracks.every(t => selectedIds.has(getTrackId(t)));
    const isSomeSelected = !isAllSelected && tracks.some(t => selectedIds.has(getTrackId(t)));

    return (
        <div className="flex flex-col w-full">
            <div
                ref={tableScrollRef}
                className="overflow-x-auto snap-x snap-mandatory"
                style={{ scrollPaddingLeft: `${totalStickyWidth}px` }}
            >
                <table className="google-visualization-table-table w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="google-visualization-table-tr-head">
                            <th className="track-header-cell w-12 sticky left-0 z-30 bg-zinc-900 shadow-[1px_0_0_0_#2d2d2d] snap-start snap-always">
                                <div className="flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        className="header-select-all w-4 h-4 text-spotify-green bg-zinc-800 border-zinc-700 rounded focus:ring-spotify-green focus:ring-2 cursor-pointer"
                                        checked={isAllSelected}
                                        ref={el => el && (el.indeterminate = isSomeSelected)}
                                        onChange={(e) => onToggleAll(e.target.checked, tracks)}
                                    />
                                </div>
                            </th>
                            {activeColumns.map((col, colIdx) => {
                                // Calculate left offset for sticky columns
                                // Play column is 48px
                                // Title is 280px
                                // Artist is 200px
                                let stickyClass = "";
                                let style = {};
                                if (col.sticky) {
                                    stickyClass = "sticky z-20 bg-[#1a1a1a] shadow-[1px_0_0_0_#2d2d2d]";
                                    if (col.id === 'title') {
                                        style = { left: '48px', minWidth: '280px', maxWidth: '280px' };
                                    } else if (col.id === 'artist') {
                                        style = { left: '328px', minWidth: '200px', maxWidth: '200px' }; // 48 + 280
                                    }
                                }

                                return (
                                    <th
                                        key={col.id}
                                        className={`track-header-cell cursor-pointer hover:bg-zinc-800 transition-colors ${col.width || ''} ${stickyClass} ${col.sticky ? '' : 'snap-start snap-always'}`}
                                        style={style}
                                        onClick={() => requestSort(col.sortKey)}
                                        title={col.tooltip || col.label}
                                    >
                                        <div className={`flex items-center justify-${col.align === 'center' ? 'center' : 'start'}`}>
                                            {col.label} {getSortIcon(col.sortKey)}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedTracks.map((track, idx) => {
                            const rowId = getTrackId(track);
                            const isSelected = selectedIds.has(rowId);
                            const isEven = idx % 2 === 0;

                            // Use semi-transparent backgrounds with backdrop-blur for a "glass" effect
                            const baseBgClass = isEven ? 'bg-zinc-900/60' : 'bg-zinc-950/60';
                            const selectedBgClass = isSelected ? 'bg-spotify-green/10' : '';
                            const hoverBgClass = 'group-hover:bg-zinc-800/60';
                            const glassClass = 'backdrop-blur-md';

                            return (
                                <tr key={rowId || idx}
                                    className={`group transition-colors ${baseBgClass} ${selectedBgClass} ${hoverBgClass} ${isSelected ? 'google-visualization-table-tr-sel' : ''}`}
                                    onClick={(e) => {
                                        if (e.target.type !== 'checkbox' && !e.target.classList.contains('track-play')) {
                                            onToggleSelection(rowId, !selectedIds.has(rowId));
                                        }
                                    }}
                                >
                                    <td className={`track-table-cell text-center! w-12 sticky left-0 z-20 transition-colors ${baseBgClass} ${selectedBgClass} ${hoverBgClass} shadow-[1px_0_0_0_#242424]`}>
                                        <input
                                            type="checkbox"
                                            className="track-select hidden"
                                            checked={selectedIds.has(rowId)}
                                            onChange={(e) => onToggleSelection(rowId, e.target.checked)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        {getPreviewUrl(track) ? (
                                            <i
                                                className={`track-play fa ${nowPlayingId === rowId && isPlaying ? 'fa-pause text-spotify-green' : 'fa-play text-zinc-500'} hover:text-white cursor-pointer transition-colors`}
                                                onMouseEnter={(e) => {
                                                    const img = getTrackImage(track);
                                                    if (img) {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setHoveredImage(img);
                                                        // Center horizontally above the button (w-56 = 224px)
                                                        setHoverPosition({
                                                            x: rect.left + (rect.width / 2) - 112,
                                                            y: rect.top - 224 - 15
                                                        });
                                                    }
                                                }}
                                                onMouseMove={(e) => {
                                                    // Optional: make it follow mouse vertically if desired
                                                    // setHoverPosition(prev => ({ ...prev, y: e.clientY - 80 }));
                                                }}
                                                onMouseLeave={() => setHoveredImage(null)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPlayTrack(track.details ? track : {
                                                        ...track,
                                                        id: rowId,
                                                        details: {
                                                            ...(track.details || {}),
                                                            preview_url: getPreviewUrl(track)
                                                        }
                                                    });
                                                }}
                                            ></i>
                                        ) : null}
                                    </td>
                                    {activeColumns.map((col, colIdx) => {
                                        let stickyClass = "";
                                        let style = {};
                                        if (col.sticky) {
                                            stickyClass = `sticky z-10 transition-colors ${baseBgClass} ${selectedBgClass} ${hoverBgClass} shadow-[1px_0_0_0_#242424]`;
                                            if (col.id === 'title') {
                                                style = { left: '48px', minWidth: '280px', maxWidth: '280px' };
                                            } else if (col.id === 'artist') {
                                                style = { left: '328px', minWidth: '200px', maxWidth: '200px' };
                                            }
                                        }
                                        return (
                                            <td
                                                key={col.id}
                                                className={`track-table-cell ${col.className || ''} text-${col.align === 'center' ? 'center!' : 'left'} ${stickyClass} ${col.sticky ? '' : 'snap-start snap-always'}`}
                                                style={style}
                                            >
                                                <div className="truncate">{col.render(track)}</div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination UI */}
            <div className="google-visualization-table-div-page flex items-center justify-between p-4 border-t border-zinc-800">
                <div id="page-size-selector-container" className="flex items-center gap-2">
                    <span className="text-zinc-500 text-sm">Show:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(parseInt(e.target.value))}
                        className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-spotify-green"
                    >
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                        <option value="500">500</option>
                    </select>
                </div>

                <div className="text-zinc-500 text-xs font-semibold">
                    Showing {filteredTracks.length > 0 ? currentPage * pageSize + 1 : 0} to {Math.min((currentPage + 1) * pageSize, filteredTracks.length)} entries
                </div>

                <div className="flex items-center gap-1">
                    <button
                        className="pager-control-btn w-8 h-8 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => setCurrentPage(0)}
                        disabled={currentPage === 0}
                    >
                        <i className="fa fa-step-backward text-xs"></i>
                    </button>
                    <button
                        className="pager-control-btn w-8 h-8 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                        disabled={currentPage === 0}
                    >
                        <i className="fa fa-chevron-left text-xs"></i>
                    </button>

                    {/* Simplified page numbers */}
                    <div className="flex items-center gap-1 mx-2">
                        <span className="text-sm font-bold text-spotify-green">{currentPage + 1}</span>
                        <span className="text-sm text-zinc-500">/</span>
                        <span className="text-sm text-zinc-500">{totalPages || 1}</span>
                    </div>

                    <button
                        className="pager-control-btn w-8 h-8 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                        disabled={currentPage >= totalPages - 1}
                    >
                        <i className="fa fa-chevron-right text-xs"></i>
                    </button>
                    <button
                        className="pager-control-btn w-8 h-8 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => setCurrentPage(totalPages - 1)}
                        disabled={currentPage >= totalPages - 1}
                    >
                        <i className="fa fa-step-forward text-xs"></i>
                    </button>
                </div>
            </div>

            {/* Album Art Hover Preview (Modal-like) */}
            {hoveredImage && (
                <div
                    className="fixed z-9999 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{
                        left: `${hoverPosition.x}px`,
                        top: `${hoverPosition.y}px`,
                    }}
                >
                    <div className="relative">
                        {/* Glow effect */}
                        <div className="absolute -inset-1 bg-linear-to-r from-spotify-green to-emerald-500 rounded-xl blur opacity-25"></div>

                        {/* Main container */}
                        <div className="relative bg-zinc-900 ring-1 ring-white/10 rounded-xl overflow-hidden shadow-2xl">
                            <img
                                src={hoveredImage}
                                className="w-56 h-56 object-cover"
                                alt="Album Art Preview"
                                onError={(e) => e.target.style.display = 'none'}
                            />
                        </div>

                        {/* Triangle pointing down */}
                        <div
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 rotate-45 border-r border-b border-white/10 shadow-xl"
                        ></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrackTable;
