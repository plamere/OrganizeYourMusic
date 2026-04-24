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
    const [lastClickedId, setLastClickedId] = useState(null);
    const [draggedColId, setDraggedColId] = useState(null);
    const [dropTargetColId, setDropTargetColId] = useState(null);
    const [dropSide, setDropSide] = useState(null); // 'left' or 'right'
    const [autoScrollDir, setAutoScrollDir] = useState(null); // 'left', 'right', or null
    const [scrollVelocity, setScrollVelocity] = useState(0);
    const tableScrollRef = useRef(null);
    const scrollIntervalRef = useRef(null);

    const storageKey = isStaging ? 'oym_column_order_staging' : 'oym_column_order_main';
    
    // Load/Save Column Order
    const [columnOrder, setColumnOrder] = useState(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return trackColumns.map(c => c.id);
            }
        }
        return trackColumns.map(c => c.id);
    });

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(columnOrder));
    }, [columnOrder, storageKey]);

    // Handle Reset Event from legacy UI
    useEffect(() => {
        const handleReset = () => {
            const defaultOrder = trackColumns.map(c => c.id);
            setColumnOrder(defaultOrder);
            localStorage.removeItem(storageKey);
        };
        window.addEventListener('oym_reset_columns', handleReset);
        return () => window.removeEventListener('oym_reset_columns', handleReset);
    }, [storageKey]);

    // Filter and Reorder columns based on context and relevancy (sorting)
    const activeColumns = useMemo(() => {
        // First, get the base set of columns
        let cols = trackColumns.filter(col => !isStaging || !col.isExtra);

        // Sort them according to columnOrder
        cols.sort((a, b) => {
            const indexA = columnOrder.indexOf(a.id);
            const indexB = columnOrder.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        // Handle dynamic sticky offsets
        let currentLeft = 48; // Base checkbox/play column
        return cols.map(col => {
            if (col.sticky) {
                const width = col.id === 'title' ? 240 : (col.id === 'artist' ? 200 : 150);
                const colWithOffset = { ...col, stickyLeft: currentLeft, widthPx: width };
                currentLeft += width;
                return colWithOffset;
            }
            return col;
        });
    }, [isStaging, columnOrder]);

    // Calculate total width of all sticky columns for scroll padding
    const totalStickyWidth = useMemo(() => {
        let width = 48; // Base checkbox/play column
        activeColumns.forEach(col => {
            if (col.sticky) {
                width += col.widthPx || 0;
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
        setLastClickedId(null);
    }, [searchQuery, tracks.length, sortConfig]);

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

    // Auto-scroll Effect
    useEffect(() => {
        if (!autoScrollDir || !tableScrollRef.current) {
            if (scrollIntervalRef.current) cancelAnimationFrame(scrollIntervalRef.current);
            return;
        }

        const scroll = () => {
            if (!tableScrollRef.current) return;
            const delta = autoScrollDir === 'right' ? scrollVelocity : -scrollVelocity;
            tableScrollRef.current.scrollLeft += delta;
            scrollIntervalRef.current = requestAnimationFrame(scroll);
        };

        scrollIntervalRef.current = requestAnimationFrame(scroll);
        return () => {
            if (scrollIntervalRef.current) cancelAnimationFrame(scrollIntervalRef.current);
        };
    }, [autoScrollDir, scrollVelocity]);

    // Drag and Drop Handlers
    const onDragStart = (e, colId) => {
        setDraggedColId(colId);
        e.dataTransfer.effectAllowed = 'move';
        // HTML5 DND sometimes needs this to work well
        e.dataTransfer.setData('text/plain', colId);
        
        // Custom ghost image if needed, but browser default is okay for now
    };

    const onDragOver = (e, colId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Auto-scroll detection
        if (tableScrollRef.current) {
            const rect = tableScrollRef.current.getBoundingClientRect();
            const threshold = 100;
            const x = e.clientX;

            if (x > rect.right - threshold) {
                setAutoScrollDir('right');
                const dist = rect.right - x;
                const velocity = Math.max(2, (1 - Math.max(0, dist) / threshold) * 20);
                setScrollVelocity(velocity);
            } else if (x < rect.left + threshold) {
                setAutoScrollDir('left');
                const dist = x - rect.left;
                const velocity = Math.max(2, (1 - Math.max(0, dist) / threshold) * 20);
                setScrollVelocity(velocity);
            } else {
                setAutoScrollDir(null);
                setScrollVelocity(0);
            }
        }

        // Drop position detection
        if (colId && colId !== draggedColId) {
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            const side = e.clientX < midpoint ? 'left' : 'right';
            
            setDropTargetColId(colId);
            setDropSide(side);
        } else if (colId === draggedColId) {
            setDropTargetColId(null);
            setDropSide(null);
        }
    };

    const onDrop = (e, targetColId) => {
        e.preventDefault();
        setAutoScrollDir(null);
        
        if (!draggedColId || !targetColId || draggedColId === targetColId) {
            clearDragState();
            return;
        }

        const newOrder = [...columnOrder];
        const draggedIdx = newOrder.indexOf(draggedColId);
        let targetIdx = newOrder.indexOf(targetColId);

        if (draggedIdx !== -1 && targetIdx !== -1) {
            // Remove from old position
            newOrder.splice(draggedIdx, 1);
            
            // Re-calculate target index after removal
            targetIdx = newOrder.indexOf(targetColId);
            const finalIdx = dropSide === 'right' ? targetIdx + 1 : targetIdx;
            
            newOrder.splice(finalIdx, 0, draggedColId);
            setColumnOrder(newOrder);
        }
        clearDragState();
    };

    const clearDragState = () => {
        setDraggedColId(null);
        setDropTargetColId(null);
        setDropSide(null);
        setAutoScrollDir(null);
    };

    return (
        <div className="flex flex-col w-full">
            <div
                ref={tableScrollRef}
                onDragOver={(e) => onDragOver(e, null)}
                onDrop={clearDragState}
                className={`overflow-x-auto ${draggedColId ? '' : 'snap-x snap-mandatory'}`}
                style={{ scrollPaddingLeft: `${totalStickyWidth}px` }}
            >
                <table className="google-visualization-table-table w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="google-visualization-table-tr-head">
                            <th 
                                className="track-header-cell w-12 sticky left-0 bg-[#1a1a1a] shadow-[1px_0_0_0_#2d2d2d] snap-start snap-always box-border"
                                style={{ minWidth: '48px', maxWidth: '48px', top: 0, zIndex: 30 }}
                            >
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
                                let stickyClass = "";
                                let style = {};
                                if (col.sticky) {
                                    stickyClass = "sticky bg-[#1a1a1a] shadow-[1px_0_0_0_#2d2d2d]";
                                    style = { 
                                        left: `${col.stickyLeft}px`, 
                                        minWidth: `${col.widthPx}px`, 
                                        maxWidth: `${col.widthPx}px`,
                                        top: 0,
                                        zIndex: 30
                                    };
                                }

                                const isDragging = draggedColId === col.id;
                                const isDropTarget = dropTargetColId === col.id;

                                return (
                                    <th
                                        key={col.id}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, col.id)}
                                        onDragOver={(e) => onDragOver(e, col.id)}
                                        onDrop={(e) => onDrop(e, col.id)}
                                        onDragEnd={clearDragState}
                                        className={`track-header-cell cursor-pointer hover:bg-zinc-800 transition-all duration-200 ${col.width || ''} ${stickyClass} ${col.sticky ? '' : 'snap-start snap-always'} ${isDragging ? 'opacity-30 bg-zinc-800 shadow-inner' : ''} relative`}
                                        style={style}
                                        onClick={() => requestSort(col.sortKey)}
                                        title={col.tooltip || col.label}
                                    >
                                        <div className={`flex items-center justify-${col.align === 'center' ? 'center' : 'start'} pointer-events-none transition-transform ${isDragging ? 'scale-95' : ''}`}>
                                            {col.label} {getSortIcon(col.sortKey)}
                                        </div>
                                        
                                        {/* Drop Indicator */}
                                        {isDropTarget && (
                                            <div className={`absolute top-0 bottom-0 w-1 bg-spotify-green shadow-[0_0_8px_rgba(29,185,84,0.8)] z-50 pointer-events-none animate-pulse ${dropSide === 'left' ? 'left-0' : 'right-0'}`} />
                                        )}
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

                            // Opaque backgrounds to ensure sticky columns hide content behind them
                            const baseBgClass = isEven ? 'bg-[#18181b]' : 'bg-[#121212]';
                            const selectedBgClass = isSelected ? 'bg-[#1db954]/20' : '';
                            const hoverBgClass = 'group-hover:bg-[#2a2a2a]';

                            // Sticky cells must have the same opaque background as the row to cover scrolling content
                            // We use explicit hex colors for the composite state to ensure 100% opacity
                            const stickyBgClass = isSelected 
                                ? (isEven ? 'bg-[#223629]' : 'bg-[#1a2d21]') // Composite of green overlay + base
                                : baseBgClass;
                            const stickyHoverBgClass = 'group-hover:bg-[#2a2a2a]';

                            return (
                                <tr key={rowId || idx}
                                    className={`group transition-colors select-none ${baseBgClass} ${selectedBgClass} ${hoverBgClass} ${isSelected ? 'google-visualization-table-tr-sel' : ''}`}
                                    onClick={(e) => {
                                        const rowId = getTrackId(track);
                                        const isSelectionAction = e.target.type === 'checkbox' || e.target.closest('.track-play') === null;
                                        
                                        if (isSelectionAction && e.target.type !== 'checkbox') {
                                            if (e.shiftKey && lastClickedId) {
                                                const lastIdx = filteredTracks.findIndex(t => getTrackId(t) === lastClickedId);
                                                const currentIdx = filteredTracks.findIndex(t => getTrackId(t) === rowId);
                                                
                                                if (lastIdx !== -1 && currentIdx !== -1) {
                                                    const start = Math.min(lastIdx, currentIdx);
                                                    const end = Math.max(lastIdx, currentIdx);
                                                    const rangeIds = filteredTracks.slice(start, end + 1).map(t => getTrackId(t));
                                                    const newState = !selectedIds.has(rowId);
                                                    onToggleSelection(rangeIds, newState);
                                                    setLastClickedId(rowId);
                                                    return;
                                                }
                                            }
                                            onToggleSelection(rowId, !selectedIds.has(rowId));
                                            setLastClickedId(rowId);
                                        }
                                    }}
                                >
                                    <td 
                                        className={`track-table-cell text-center! w-12 sticky left-0 transition-colors group-hover:bg-[#2a2a2a]! shadow-[1px_0_0_0_#2d2d2d] box-border`}
                                        style={{ 
                                            minWidth: '48px', 
                                            maxWidth: '48px', 
                                            zIndex: 20,
                                            backgroundColor: isSelected 
                                                ? (isEven ? '#223629' : '#1a2d21') 
                                                : (isEven ? '#18181b' : '#121212')
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            className="track-select hidden"
                                            checked={selectedIds.has(rowId)}
                                            onChange={() => {}} // Handled by onClick for shift support
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const rowId = getTrackId(track);
                                                const newState = !selectedIds.has(rowId);

                                                if (e.shiftKey && lastClickedId) {
                                                    const lastIdx = filteredTracks.findIndex(t => getTrackId(t) === lastClickedId);
                                                    const currentIdx = filteredTracks.findIndex(t => getTrackId(t) === rowId);

                                                    if (lastIdx !== -1 && currentIdx !== -1) {
                                                        const start = Math.min(lastIdx, currentIdx);
                                                        const end = Math.max(lastIdx, currentIdx);
                                                        const rangeIds = filteredTracks.slice(start, end + 1).map(t => getTrackId(t));
                                                        onToggleSelection(rangeIds, newState);
                                                        setLastClickedId(rowId);
                                                        return;
                                                    }
                                                }
                                                onToggleSelection(rowId, newState);
                                                setLastClickedId(rowId);
                                            }}
                                        />
                                        {getPreviewUrl(track) ? (
                                            <i
                                                className={`track-play fa ${nowPlayingId === rowId && isPlaying ? 'fa-pause text-spotify-green' : 'fa-play text-zinc-500'} hover:text-white cursor-pointer transition-colors`}
                                                onMouseEnter={(e) => {
                                                    const img = getTrackImage(track);
                                                    if (img) {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setHoveredImage(img);
                                                        
                                                        // Detect if sidebar is closed (hidden or narrow)
                                                        const sidebar = document.getElementById('sidebar');
                                                        const isSidebarClosed = sidebar?.classList.contains('hidden') || sidebar?.offsetWidth < 100;
                                                        
                                                        if (isSidebarClosed) {
                                                            // Position to the right of the button
                                                            setHoverPosition({
                                                                x: rect.right + 15,
                                                                y: rect.top + (rect.height / 2) - 112,
                                                                side: 'right'
                                                            });
                                                        } else {
                                                            // Center horizontally above the button (w-56 = 224px)
                                                            setHoverPosition({
                                                                x: rect.left + (rect.width / 2) - 112,
                                                                y: rect.top - 224 - 15,
                                                                side: 'top'
                                                            });
                                                        }
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
                                        let stickyStyle = col.sticky ? { 
                                            left: `${col.stickyLeft}px`, 
                                            minWidth: `${col.widthPx}px`, 
                                            maxWidth: `${col.widthPx}px`,
                                            zIndex: 20,
                                            boxShadow: '1px 0 0 0 #2d2d2d'
                                        } : { zIndex: 1 };

                                        if (col.sticky) {
                                            // Handle background in style to ensure it overrides and stays opaque
                                            const bgColor = isSelected 
                                                ? (isEven ? '#223629' : '#1a2d21') 
                                                : (isEven ? '#18181b' : '#121212');
                                            stickyStyle.backgroundColor = bgColor;
                                        }

                                        return (
                                            <td
                                                key={col.id}
                                                className={`track-table-cell ${col.className || ''} text-${col.align === 'center' ? 'center!' : 'left'} ${col.sticky ? 'sticky transition-colors group-hover:bg-[#2a2a2a]!' : 'snap-start snap-always'}`}
                                                style={stickyStyle}
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
            <div className="google-visualization-table-div-page flex items-center justify-between p-2 border-t border-zinc-800">
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
                    className={`fixed z-9999 pointer-events-none animate-in fade-in duration-200 ${hoverPosition.side === 'right' ? 'slide-in-from-left-2' : 'slide-in-from-bottom-2'}`}
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

                        {/* Triangle indicator */}
                        {hoverPosition.side === 'right' ? (
                            <div
                                className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-zinc-900 rotate-45 border-l border-b border-white/10 shadow-xl"
                            ></div>
                        ) : (
                            <div
                                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 rotate-45 border-r border-b border-white/10 shadow-xl"
                            ></div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrackTable;
