import React, { useState, useMemo, useEffect } from 'react';
import { trackColumns } from './columnDefinitions';

const TrackTable = ({
    tracks,
    selectedIds,
    onToggleSelection,
    onToggleAll,
    onPlayTrack,
    nowPlayingId,
    isPlaying,
    pageSize: initialPageSize = 200,
    isStaging = false
}) => {
    const [sortConfig, setSortConfig] = useState({ key: 'popularity', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter columns based on context
    const activeColumns = useMemo(() => {
        return trackColumns.filter(col => !isStaging || !col.isExtra);
    }, [isStaging]);

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
                    aVal = a.feats[sortConfig.key];
                    bVal = b.feats[sortConfig.key];
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
            t.details.name.toLowerCase().includes(q) ||
            t.details.artists[0].name.toLowerCase().includes(q)
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

    const isAllSelected = tracks.length > 0 && tracks.every(t => selectedIds.has(t.id));
    const isSomeSelected = !isAllSelected && tracks.some(t => selectedIds.has(t.id));

    return (
        <div className="flex flex-col w-full">
            <div className="overflow-x-auto snap-x snap-mandatory scroll-pl-[528px]">
                <table className="google-visualization-table-table w-full border-collapse">
                    <thead>
                        <tr className="google-visualization-table-tr-head">
                            <th className="track-header-cell w-[48px] sticky left-0 z-30 bg-zinc-900 border-r border-zinc-800 snap-start snap-always">
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
                                    stickyClass = "sticky z-20 bg-zinc-900 border-r border-zinc-800";
                                    if (col.id === 'title') {
                                        style = { left: '48px', minWidth: '280px', maxWidth: '280px' };
                                    } else if (col.id === 'artist') {
                                        style = { left: '328px', minWidth: '200px', maxWidth: '200px' }; // 48 + 280
                                    }
                                }

                                return (
                                    <th
                                        key={col.id}
                                        className={`track-header-cell cursor-pointer hover:bg-zinc-800 transition-colors ${col.width || ''} ${stickyClass} snap-start snap-always`}
                                        style={style}
                                        onClick={() => requestSort(col.sortKey)}
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
                        {paginatedTracks.map((track, idx) => (
                            <tr key={track.id}
                                className={`group hover:bg-zinc-800/80 transition-colors ${idx % 2 === 0 ? 'google-visualization-table-tr-even bg-zinc-900' : 'google-visualization-table-tr-odd bg-zinc-950'} ${selectedIds.has(track.id) ? 'google-visualization-table-tr-sel bg-spotify-green/10' : ''}`}
                                onClick={(e) => {
                                    if (e.target.type !== 'checkbox' && !e.target.classList.contains('track-play')) {
                                        onToggleSelection(track.id, !selectedIds.has(track.id));
                                    }
                                }}
                            >
                                <td className="track-table-cell text-center! w-[48px] sticky left-0 z-10 bg-inherit group-hover:bg-zinc-800/80 transition-colors border-r border-zinc-800/50 snap-start snap-always">
                                    <input
                                        type="checkbox"
                                        className="track-select hidden"
                                        checked={selectedIds.has(track.id)}
                                        onChange={(e) => onToggleSelection(track.id, e.target.checked)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    {track.details.preview_url ? (
                                        <i
                                            className={`track-play fa ${nowPlayingId === track.id && isPlaying ? 'fa-pause text-spotify-green' : 'fa-play text-zinc-500'} hover:text-white cursor-pointer transition-colors`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onPlayTrack(track);
                                            }}
                                        ></i>
                                    ) : null}
                                </td>
                                {activeColumns.map((col, colIdx) => {
                                    let stickyClass = "";
                                    let style = {};
                                    if (col.sticky) {
                                        stickyClass = "sticky z-10 bg-inherit group-hover:bg-zinc-800/80 transition-colors border-r border-zinc-800/50";
                                        if (col.id === 'title') {
                                            style = { left: '48px', minWidth: '280px', maxWidth: '280px' };
                                        } else if (col.id === 'artist') {
                                            style = { left: '328px', minWidth: '200px', maxWidth: '200px' };
                                        }
                                    }
                                    return (
                                        <td
                                            key={col.id}
                                            className={`track-table-cell ${col.className || ''} text-${col.align === 'center' ? 'center!' : 'left'} ${stickyClass} snap-start snap-always`}
                                            style={style}
                                        >
                                            <div className="truncate">{col.render(track)}</div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
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
        </div>
    );
};

export default TrackTable;
