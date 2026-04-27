import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { trackColumns } from './columnDefinitions';
import Tooltip from './Tooltip';

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
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [searchQuery] = useState('');
    const [hoveredImage, setHoveredImage] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [lastClickedId, setLastClickedId] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const [hiddenColumns, setHiddenColumns] = useState(() => {
        const saved = localStorage.getItem('oym_hidden_columns');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.warn("Failed to parse hidden columns:", e);
            }
        }
        return [];
    });

    useEffect(() => {
        localStorage.setItem('oym_hidden_columns', JSON.stringify(hiddenColumns));
    }, [hiddenColumns]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Column Drag and Drop State
    const [draggedColId, setDraggedColId] = useState(null);
    const [dropTargetColId, setDropTargetColId] = useState(null);
    const [dropSide, setDropSide] = useState(null); // 'left' or 'right'

    // Row Drag and Drop State
    const [draggedRowId, setDraggedRowId] = useState(null);
    const [dropTargetRowId, setDropTargetRowId] = useState(null);
    const [rowDropSide, setRowDropSide] = useState(null); // 'top' or 'bottom'

    const [autoScrollDir, setAutoScrollDir] = useState(null); // 'left', 'right', or null
    const [scrollVelocity, setScrollVelocity] = useState(0);
    const tableScrollRef = useRef(null);
    const scrollIntervalRef = useRef(null);

    useEffect(() => {
        console.log("[TrackTable] Component Mounted with", tracks?.length, "tracks");
    }, []);

    const storageKey = isStaging ? 'oym_column_order_staging' : 'oym_column_order_main';

    // Load/Save Column Order
    // Load/Save Column Order with robust fallback
    const [columnOrder, setColumnOrder] = useState(() => {
        const defaultOrder = trackColumns.map(c => c.id);
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (e) {
                console.warn("Failed to parse saved column order:", e);
            }
        }
        return defaultOrder;
    });

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(columnOrder));
    }, [columnOrder, storageKey]);

    useEffect(() => {
        const handleReset = () => {
            const defaultOrder = trackColumns.map(c => c.id);
            setColumnOrder(defaultOrder);
            localStorage.removeItem(storageKey);
        };
        window.addEventListener('oym_reset_columns', handleReset);
        return () => window.removeEventListener('oym_reset_columns', handleReset);
    }, [storageKey]);

    useEffect(() => {
        const handleResetRows = () => {
            setManualRowOrder(tracks.map(t => getTrackId(t)));
        };
        window.addEventListener('oym_reset_rows', handleResetRows);
        return () => window.removeEventListener('oym_reset_rows', handleResetRows);
    }, [tracks]);

    // Manual Row Order State
    const manualOrderStorageKey = isStaging ? 'oym_manual_row_order_staging' : 'oym_manual_row_order_main';
    const [manualRowOrder, setManualRowOrder] = useState(() => {
        const saved = localStorage.getItem(manualOrderStorageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (e) {
                console.warn("Failed to parse manual row order:", e);
            }
        }
        return tracks.map(t => getTrackId(t));
    });

    // Sync manualRowOrder with tracks prop
    useEffect(() => {
        if (!tracks || tracks.length === 0) return;

        const trackIds = tracks.map(t => getTrackId(t));
        const currentIdSet = new Set(trackIds);

        setManualRowOrder(prev => {
            // Filter out IDs that are no longer in the input tracks
            const filteredPrev = prev.filter(id => currentIdSet.has(id));
            const filteredSet = new Set(filteredPrev);
            // Add new IDs that are not in the manual order yet
            const addedIds = trackIds.filter(id => !filteredSet.has(id));

            if (addedIds.length === 0 && filteredPrev.length === prev.length) {
                return prev;
            }
            return [...filteredPrev, ...addedIds];
        });
    }, [tracks]);

    useEffect(() => {
        localStorage.setItem(manualOrderStorageKey, JSON.stringify(manualRowOrder));
    }, [manualRowOrder, manualOrderStorageKey]);

    // Filter and Reorder columns based on context and relevancy (sorting)
    const activeColumns = useMemo(() => {
        // First, get the base set of columns
        let cols = trackColumns.filter(col => {
            const isStagingHidden = isStaging && col.isExtra;
            const isUserHidden = hiddenColumns.includes(col.id);
            return !isStagingHidden && !isUserHidden;
        });

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
                let width = 120;
                if (col.id === 'title') width = 250;
                else if (col.id === 'artist') width = 180;
                else if (col.id === 'index') width = 48;

                const colWithOffset = { ...col, stickyLeft: currentLeft, widthPx: width };
                currentLeft += width;
                return colWithOffset;
            }
            return col;
        });
    }, [isStaging, columnOrder, hiddenColumns]);

    // Calculate total width of all sticky columns for scroll padding
    const totalStickyWidth = useMemo(() => {
        let width = 48; // Base checkbox/play column
        activeColumns.forEach(col => {
            if (col.sticky) {
                width += col.width || 0;
            }
        });
        return width;
    }, [activeColumns]);

    // Sort tracks
    const sortedTracks = useMemo(() => {
        if (!sortConfig.key) {
            // Restore manual order
            const trackMap = new Map();
            tracks.forEach(t => {
                const id = getTrackId(t);
                if (id) trackMap.set(id, t);
            });

            return manualRowOrder
                .map(id => trackMap.get(id))
                .filter(Boolean);
        }

        let sortableTracks = [...tracks];
        const column = trackColumns.find(c => c.sortKey === sortConfig.key || c.id === sortConfig.key);

        sortableTracks.sort((a, b) => {
            let aVal, bVal;

            if (column && column.getValue) {
                aVal = column.getValue(a);
                bVal = column.getValue(b);
            } else {
                aVal = a?.[sortConfig.key] ?? a?.feats?.[sortConfig.key];
                bVal = b?.[sortConfig.key] ?? b?.feats?.[sortConfig.key];
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sortableTracks;
    }, [tracks, sortConfig, manualRowOrder]);

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


    const requestSort = (key) => {
        let direction = 'asc';
        let newKey = key;

        if (sortConfig.key === key) {
            if (sortConfig.direction === 'asc') {
                direction = 'desc';
            } else if (sortConfig.direction === 'desc') {
                newKey = null; // None state
            }
        }
        setSortConfig({ key: newKey, direction });
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
        if (!draggedColId) return;
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

    // Row Drag and Drop Handlers
    const onRowDragStart = (e, rowId) => {
        if (sortConfig.key) return;
        setDraggedRowId(rowId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', rowId);
    };

    const onRowDragOver = (e, rowId) => {
        if (!draggedRowId || sortConfig.key) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (rowId && rowId !== draggedRowId) {
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const side = e.clientY < midpoint ? 'top' : 'bottom';
            setDropTargetRowId(rowId);
            setRowDropSide(side);
        } else {
            setDropTargetRowId(null);
            setRowDropSide(null);
        }
    };

    const onRowDrop = (e, targetRowId) => {
        if (sortConfig.key) return;
        e.preventDefault();

        if (!draggedRowId || !targetRowId || draggedRowId === targetRowId) {
            clearRowDragState();
            return;
        }

        const newOrder = [...manualRowOrder];
        const draggedIdx = newOrder.indexOf(draggedRowId);
        let targetIdx = newOrder.indexOf(targetRowId);

        if (draggedIdx !== -1 && targetIdx !== -1) {
            newOrder.splice(draggedIdx, 1);
            targetIdx = newOrder.indexOf(targetRowId);
            const finalIdx = rowDropSide === 'bottom' ? targetIdx + 1 : targetIdx;
            newOrder.splice(finalIdx, 0, draggedRowId);
            setManualRowOrder(newOrder);
        }
        clearRowDragState();
    };

    const clearRowDragState = () => {
        setDraggedRowId(null);
        setDropTargetRowId(null);
        setRowDropSide(null);
    };

    const clearDragState = () => {
        setDraggedColId(null);
        setDropTargetColId(null);
        setDropSide(null);
        setAutoScrollDir(null);
    };

    return (
        <div className="flex flex-col w-full">
            {/* Portal for Hide Columns Button */}
            {typeof document !== 'undefined' && document.getElementById('playlist-actions-container') && createPortal(
                <div className="relative inline-block" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm h-7 ${isDropdownOpen ? 'bg-spotify-green text-black border-spotify-green' : 'bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white border-white/5'}`}
                    >
                        <i className="fa fa-columns text-[10px]"></i>
                        <span>Columns</span>
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute left-0 top-full mt-2 z-1000 w-64 max-h-[70vh] overflow-y-auto bg-[#181818] border border-zinc-800 rounded-xl shadow-2xl p-3 custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Display Columns
                                </div>
                                <button
                                    onClick={() => {
                                        if (hiddenColumns.length > 0) {
                                            setHiddenColumns([]);
                                        } else {
                                            const allOptionalIds = trackColumns
                                                .filter(c => c.id !== 'title' && c.id !== 'artist' && c.id !== 'index')
                                                .map(c => c.id);
                                            setHiddenColumns(allOptionalIds);
                                        }
                                    }}
                                    className="text-[9px] font-bold text-spotify-green hover:underline uppercase tracking-wider"
                                >
                                    Toggle
                                </button>
                            </div>
                            <div className="space-y-1">
                                {trackColumns.map(col => {
                                    const isHidden = hiddenColumns.includes(col.id);
                                    const isStagingExtra = isStaging && col.isExtra;
                                    const isLocked = col.id === 'title' || col.id === 'artist' || col.id === 'index';

                                    if (isStagingExtra) return null;

                                    return (
                                        <label
                                            key={col.id}
                                            className={`flex items-center gap-3 p-2 rounded-lg transition-all ${isHidden ? 'opacity-50 grayscale-[0.5]' : 'bg-white/5'} ${isLocked ? 'cursor-default' : 'cursor-pointer hover:bg-white/10'} group`}
                                        >
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="peer appearance-none w-4 h-4 rounded border border-zinc-700 checked:bg-spotify-green checked:border-spotify-green bg-zinc-800 transition-all cursor-pointer disabled:cursor-default"
                                                    checked={!isHidden}
                                                    disabled={isLocked}
                                                    onChange={() => {
                                                        if (isLocked) return;
                                                        if (isHidden) {
                                                            setHiddenColumns(hiddenColumns.filter(id => id !== col.id));
                                                        } else {
                                                            setHiddenColumns([...hiddenColumns, col.id]);
                                                        }
                                                    }}
                                                />
                                                <i className={`fa ${isLocked ? 'fa-lock text-zinc-500' : 'fa-check text-black'} absolute text-[10px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity`}></i>
                                            </div>
                                            <span className={`text-xs font-semibold transition-colors ${!isHidden ? 'text-white' : 'text-zinc-500'} group-hover:text-white flex items-center gap-2`}>
                                                {col.label}
                                                {isLocked && <span className="text-[8px] opacity-50 uppercase tracking-tighter">(Required)</span>}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>,
                document.getElementById('playlist-actions-container')
            )}


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
                                className="track-header-cell w-12 sticky left-0 bg-spotify-base shadow-[1px_0_0_0_rgba(255,255,255,0.05)] snap-start snap-always box-border"
                                style={{
                                    minWidth: '48px',
                                    maxWidth: '48px',
                                    top: 0,
                                    zIndex: 35,
                                    transform: 'translateZ(0)',
                                    opacity: 1
                                }}
                            >
                                <div className="flex items-center justify-center relative">
                                    <input
                                        type="checkbox"
                                        className="peer appearance-none w-4 h-4 text-spotify-green bg-zinc-800 border border-zinc-700 rounded checked:bg-spotify-green checked:border-spotify-green focus:ring-0 cursor-pointer transition-all"
                                        checked={isAllSelected}
                                        ref={el => el && (el.indeterminate = isSomeSelected)}
                                        onChange={(e) => onToggleAll(e.target.checked, tracks)}
                                    />
                                    <i className={`fa ${isSomeSelected ? 'fa-minus' : 'fa-check'} absolute text-[10px] text-black opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity`}></i>
                                </div>
                            </th>
                            {activeColumns.map((col) => {
                                let stickyClass = "";
                                let style = {
                                    zIndex: 30,
                                    transform: 'translateZ(0)',
                                    opacity: 1
                                };
                                if (col.sticky) {
                                    stickyClass = "sticky bg-[#121212] shadow-[1px_0_0_0_rgba(255,255,255,0.05)]";
                                    style = {
                                        ...style,
                                        left: `${col.stickyLeft}px`,
                                        minWidth: `${col.widthPx}px`,
                                        maxWidth: `${col.widthPx}px`,
                                        top: 0,
                                        zIndex: 35
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
                                        className={`track-header-cell cursor-pointer hover:bg-zinc-800 transition-all duration-200 snap-start snap-always ${col.width || ''} ${stickyClass} ${isDragging ? 'opacity-30 bg-zinc-800 shadow-inner' : ''} relative`}
                                        style={{ ...style }}
                                        onClick={() => requestSort(col.sortKey)}
                                    >
                                        <Tooltip text={col.tooltip || col.label}>
                                            <div className={`flex items-center justify-${col.align === 'center' ? 'center' : 'start'} pointer-events-none transition-transform ${isDragging ? 'scale-95' : ''}`}>
                                                {col.label} {getSortIcon(col.sortKey)}
                                            </div>
                                        </Tooltip>

                                        {/* Drop Indicator */}
                                        {isDropTarget && (
                                            <div className={`absolute top-0 bottom-0 w-[2px] bg-spotify-green shadow-[0_0_8px_rgba(29,185,84,0.8)] z-50 pointer-events-none animate-pulse ${dropSide === 'left' ? 'left-0' : 'right-0'}`} />
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
                            // We use exact opaque colors that match the blended result of green overlay on base
                            // Base: Even #18181b, Odd #121212
                            // Selection: #1db954 at 20% opacity
                            // Hover: #2a2a2a

                            const rowBg = isSelected
                                ? (isEven ? '#193826' : '#14331f')
                                : (isEven ? '#18181b' : '#121212');

                            const rowHoverBg = isSelected
                                ? '#274732' // Composite of #2a2a2a and green@20%
                                : '#2a2a2a';

                            const isDraggingRow = draggedRowId === rowId;

                            const stickyStyleBase = {
                                zIndex: 25,
                                transform: 'translateZ(0)',
                                opacity: isDraggingRow ? 0.3 : 1,
                                boxShadow: '1px 0 0 0 rgba(255,255,255,0.05)',
                                backgroundColor: rowBg
                            };

                            return (
                                <tr key={rowId || idx}
                                    draggable={!sortConfig.key}
                                    onDragStart={(e) => onRowDragStart(e, rowId)}
                                    onDragOver={(e) => onRowDragOver(e, rowId)}
                                    onDrop={(e) => onRowDrop(e, rowId)}
                                    onDragEnd={clearRowDragState}
                                    className={`group transition-colors select-none snap-start snap-always relative ${isSelected ? 'google-visualization-table-tr-sel' : ''} ${isDraggingRow ? 'opacity-30' : ''}`}
                                    style={{
                                        backgroundColor: rowBg,
                                        '--row-hover-bg': rowHoverBg
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = rowHoverBg;
                                        const stickyCells = e.currentTarget.querySelectorAll('.sticky');
                                        stickyCells.forEach(cell => cell.style.backgroundColor = rowHoverBg);
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = rowBg;
                                        const stickyCells = e.currentTarget.querySelectorAll('.sticky');
                                        stickyCells.forEach(cell => cell.style.backgroundColor = rowBg);
                                    }}
                                    onDoubleClick={() => {
                                        // Double click now just toggles if it's already playing, or we keep it for redundancy
                                    }}
                                    onClick={(e) => {
                                        if (e.target.type === 'checkbox') return;

                                        const rowId = getTrackId(track);
                                        const isSelecting = !selectedIds.has(rowId);

                                        if (isSelecting) {
                                            const previewUrl = getPreviewUrl(track);
                                            onPlayTrack(track.details ? track : {
                                                ...track,
                                                id: rowId,
                                                details: {
                                                    ...(track.details || {}),
                                                    preview_url: previewUrl
                                                }
                                            });
                                        }

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
                                        onToggleSelection(rowId, isSelecting);
                                        setLastClickedId(rowId);
                                    }}
                                >
                                    <td
                                        className="track-table-cell text-center! w-12 sticky left-0 transition-colors shadow-[1px_0_0_0_#2d2d2d] box-border"
                                        style={{
                                            minWidth: '48px',
                                            maxWidth: '48px',
                                            zIndex: 25,
                                            transform: 'translateZ(0)',
                                            opacity: isDraggingRow ? 0.3 : 1,
                                            boxShadow: '1px 0 0 0 rgba(255,255,255,0.05)',
                                            backgroundColor: rowBg
                                        }}
                                        onMouseEnter={(e) => {
                                            const img = getTrackImage(track);
                                            if (img) {
                                                setHoveredImage(img);
                                                setHoverPosition({
                                                    x: e.clientX,
                                                    y: e.clientY
                                                });
                                            }
                                        }}
                                        onMouseMove={(e) => {
                                            if (hoveredImage) {
                                                setHoverPosition({
                                                    x: e.clientX,
                                                    y: e.clientY
                                                });
                                            }
                                        }}
                                        onMouseLeave={() => setHoveredImage(null)}
                                    >
                                        <div className="flex items-center justify-center gap-2 relative">
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="peer appearance-none w-4 h-4 text-spotify-green bg-zinc-800 border border-zinc-700 rounded checked:bg-spotify-green checked:border-spotify-green focus:ring-0 cursor-pointer transition-all"
                                                    checked={selectedIds.has(rowId)}
                                                    onChange={() => { }} // Handled by onClick for shift support
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const rowId = getTrackId(track);
                                                        const newState = !selectedIds.has(rowId);
                                                        const previewUrl = getPreviewUrl(track);

                                                        if (newState) {
                                                            // Play track on highlight
                                                            onPlayTrack(track.details ? track : {
                                                                ...track,
                                                                id: rowId,
                                                                details: {
                                                                    ...(track.details || {}),
                                                                    preview_url: previewUrl
                                                                }
                                                            });
                                                        }

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
                                                <i className="fa fa-check absolute text-[10px] text-black opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"></i>
                                            </div>
                                            {nowPlayingId === rowId && isPlaying && (
                                                <i className="fa fa-volume-up text-spotify-green text-xs animate-pulse"></i>
                                            )}
                                        </div>

                                        {/* Row Drop Indicator - Rendered in every cell to overcome sticky stacking context */}
                                        {dropTargetRowId === rowId && (
                                            <div
                                                className={`absolute left-0 right-0 h-[2px] bg-spotify-green z-100 pointer-events-none`}
                                                style={{ [rowDropSide === 'top' ? 'top' : 'bottom']: 0 }}
                                            />
                                        )}
                                    </td>
                                    {activeColumns.map((col) => {
                                        return (
                                            <td
                                                key={col.id}
                                                className={`track-table-cell ${col.className || ''} text-${col.align === 'center' ? 'center!' : 'left'} ${col.sticky ? 'sticky transition-colors' : 'snap-start snap-always'}`}
                                                style={col.sticky ? {
                                                    ...stickyStyleBase,
                                                    left: `${col.stickyLeft}px`,
                                                    minWidth: `${col.widthPx}px`,
                                                    maxWidth: `${col.widthPx}px`
                                                } : { zIndex: 1 }}
                                            >
                                                <div className="truncate">{col.render(track, currentPage * pageSize + idx + 1)}</div>

                                                {/* Row Drop Indicator - Rendered in every cell to overcome sticky stacking context */}
                                                {dropTargetRowId === rowId && (
                                                    <div
                                                        className={`absolute left-0 right-0 h-[2px] bg-spotify-green z-100 pointer-events-none`}
                                                        style={{ [rowDropSide === 'top' ? 'top' : 'bottom']: 0 }}
                                                    />
                                                )}
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
            {
                hoveredImage && (
                    <div
                        className="fixed z-9999 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
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

                            {/* Triangle indicator - always at bottom now */}
                            <div
                                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 rotate-45 border-r border-b border-white/10 shadow-xl"
                            ></div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default TrackTable;
