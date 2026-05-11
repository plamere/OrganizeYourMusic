import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import Tooltip from './Tooltip';
import SourcePreview from './SourcePreview';
import TextCarousel from './TextCarousel';

// Helper for formatting names
const formatName = (s) => {
    if (!s) return "";
    const formatted = s.replace(/_/g, " ");
    if (formatted.startsWith("(")) return formatted;
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

// Helper for track images
const getBaseTrack = (track) => (track?.track && track?.track?.id ? track.track : track);
const getTrackImage = (track) => {
    const base = getBaseTrack(track);
    return base?.image_url || track?.details?.image_url || track?.image_url || null;
};

// Category icon helper
const getCategoryIcon = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('all results')) return 'fa-globe';
    if (lower.includes('sources')) return 'fa-plug';
    if (lower.includes('genres')) return 'fa-music';
    if (lower.includes('moods')) return 'fa-smile-o';
    if (lower.includes('styles')) return 'fa-music';
    if (lower.includes('decades')) return 'fa-calendar';
    if (lower.includes('added')) return 'fa-clock-o';
    if (lower.includes('popularity')) return 'fa-star';
    if (lower.includes('duration')) return 'fa-clock-o';
    return 'fa-folder';
};




/**
 * SidebarItem Component
 */
const SidebarItem = memo(({ node, activeNode, onNodeClick, showHoverImage, onHoverImageChange, viewMode }) => {
    const isActive = activeNode && activeNode.name === node.name;
    const [isVisible, setIsVisible] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const itemRef = useRef(null);

    useEffect(() => {
        if (isVisible) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '400px' }); // Increased margin for more proactive loading

        if (itemRef.current) observer.observe(itemRef.current);
        return () => observer.disconnect();
    }, [isVisible]);

    const handleMouseEnter = useCallback((event) => {
        setIsHovered(true);
        if (showHoverImage) {
            const img = node.imageUrl || (node.tracks?.length > 0 ? getTrackImage(node.tracks[0]) : null);
            if (img) onHoverImageChange(img, { x: event.clientX, y: event.clientY });
        }
    }, [node, showHoverImage, onHoverImageChange]);

    const handleMouseLeave = useCallback(() => {
        setIsHovered(false);
        if (showHoverImage) onHoverImageChange(null);
    }, [showHoverImage, onHoverImageChange]);

    const imageUrl = node.imageUrl || (node.tracks && node.tracks.length > 0 ? getTrackImage(node.tracks[0]) : null);

    if (viewMode === 'grid' || viewMode === 'compact') {
        const isCompact = viewMode === 'compact';
        return (
            <div
                ref={itemRef}
                className="group relative"
                style={{
                    contentVisibility: isVisible ? 'visible' : 'auto',
                    containIntrinsicSize: isCompact ? '0 72px' : '0 100px'
                }}
            >
                {isVisible ? (
                    <button
                        onClick={() => onNodeClick(node)}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={`w-full text-left transition-[transform,background-color,ring,shadow] duration-200 flex flex-col group/btn relative overflow-hidden ${isCompact ? 'p-1 gap-1 rounded-lg' : 'p-2 gap-2 rounded-xl'} ${isActive
                            ? 'bg-zinc-800 ring-2 ring-spotify-green shadow-xl scale-[0.98]'
                            : 'hover:bg-zinc-800/60 hover:scale-[1.01]'
                            }`}
                        style={{ willChange: 'transform, background-color', transform: 'translateZ(0)' }}
                    >
                        {isActive && (
                            <div className="absolute inset-0 bg-spotify-green/10 blur-2xl pointer-events-none animate-pulse"></div>
                        )}

                        <div className={`aspect-square w-full overflow-hidden bg-zinc-950 shadow-inner relative z-10 ${isCompact ? 'rounded-md' : 'rounded-lg'}`}>
                            {imageUrl ? (
                                <div className="w-full h-full relative">
                                    {/* Main Image - Lazy Loaded by src deferral */}
                                    <img
                                        src={isVisible ? imageUrl : ''}
                                        alt={node.name}
                                        loading="lazy"
                                        decoding="async"
                                        onLoad={(e) => {
                                            e.target.classList.remove('opacity-0');
                                            // Show blurred background only after main image is ready
                                            const bg = e.target.previousSibling;
                                            if (bg) bg.classList.remove('opacity-0');
                                        }}
                                        className="relative z-10 w-full h-full object-contain transition-[transform,opacity] duration-200 opacity-0 group-hover/btn:scale-105"
                                        style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
                                    />
                                    {/* Blurred background - Defer display until main image loaded */}
                                    <img
                                        src={isVisible ? imageUrl : ''}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover blur-md opacity-0 scale-105 saturate-125 pointer-events-none transition-opacity duration-700"
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-zinc-800/30 via-zinc-900/30 to-black/30 text-zinc-600 backdrop-blur-xs">
                                    <i className={`fa ${getCategoryIcon(node.name)} ${isCompact ? 'text-sm' : 'text-2xl'} group-hover/btn:scale-110 transition-transform duration-300`}></i>
                                </div>
                            )}
                            <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full font-black backdrop-blur-md transition-all duration-200 z-20 ${isCompact ? 'text-[7px]' : 'text-[9px]'} ${isActive ? 'bg-spotify-green text-black' : 'bg-black/60 text-white group-hover/btn:bg-spotify-green group-hover/btn:text-black'}`}>
                                {node.tracks?.length || 0}
                            </div>
                        </div>
                        <div className={`font-black w-full px-0.5 relative z-10 transition-colors duration-200 ${isCompact ? 'text-[8px]' : 'text-[10px]'} ${isActive ? 'text-spotify-green' : 'text-zinc-400 group-hover/btn:text-zinc-100'}`}>
                            <TextCarousel isHovered={isHovered}>{node.name}</TextCarousel>
                        </div>
                    </button>
                ) : (
                    <div className={`w-full rounded-lg bg-zinc-900/20 animate-pulse ${isCompact ? 'aspect-[1/1.2]' : 'aspect-[1/1.3]'}`} />
                )}
            </div>
        );
    }

    return (
        <div
            ref={itemRef}
            className="group"
            style={{
                height: '30px',
                contentVisibility: isVisible ? 'visible' : 'auto',
                containIntrinsicSize: '0 30px'
            }}
        >
            {isVisible ? (
                <button
                    onClick={() => onNodeClick(node)}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-[11px] font-medium transition-[background-color,color,shadow] duration-200 flex items-center justify-between group/btn gap-2 overflow-hidden ${isActive
                        ? 'bg-spotify-green text-black shadow-[0_4px_12px_rgba(29,185,84,0.3)]'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                    style={{ transform: 'translateZ(0)' }}
                >
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <TextCarousel isHovered={isHovered}>{node.name}</TextCarousel>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors shrink-0 ${isActive ? 'bg-black/10 text-black' : 'bg-zinc-800 text-zinc-500 group-hover/btn:bg-zinc-700'
                        }`}>
                        {node.tracks?.length || 0}
                    </span>
                </button>
            ) : (
                <div className="w-full h-7.5 rounded bg-zinc-900/10 animate-pulse" />
            )}
        </div>
    );
});

/**
 * SidebarSection Component
 */
const SidebarSection = React.memo(({
    bin,
    isExpanded,
    onToggle,
    activeNode,
    onNodeClick,
    onItemMouseEnter,
    viewMode
}) => {
    const [hasBeenOpened, setHasBeenOpened] = useState(isExpanded);

    useEffect(() => {
        if (isExpanded && !hasBeenOpened) {
            setHasBeenOpened(true);
        }
    }, [isExpanded, hasBeenOpened]);

    const sectionIcon = useMemo(() => getCategoryIcon(bin.name), [bin.name]);
    const sectionName = useMemo(() => formatName(bin.name), [bin.name]);

    return (
        <div className="space-y-0.5">
            <button
                onClick={() => onToggle(bin.name)}
                className="mt-2 mb-1 flex cursor-pointer items-center justify-between px-2 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 transition-colors hover:text-white w-full group/header"
            >
                <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 flex items-center justify-center rounded-md transition-all duration-200 border border-white/5 ${isExpanded ? 'bg-spotify-green/10 text-spotify-green' : 'bg-zinc-900 text-zinc-600 group-hover/header:bg-zinc-800 group-hover/header:text-zinc-300'}`}>
                        <i className={`fa ${sectionIcon} text-[8px]`}></i>
                    </div>
                    <span className="transition-colors duration-200 group-hover/header:text-white">{sectionName}</span>
                </div>
                <i className={`fa fa-chevron-right text-[7px] transition-transform duration-200 ${isExpanded ? 'rotate-90 text-zinc-400' : 'text-zinc-600'}`}></i>
            </button>

            <div
                className={`grid transition-[grid-template-rows,opacity] duration-200 ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                style={{
                    willChange: 'grid-template-rows, opacity',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    // Use auto instead of hidden during transition to prevent layout jumps and allow animation
                    contentVisibility: hasBeenOpened ? 'auto' : 'visible',
                    contain: 'paint layout',
                    overflow: 'hidden'
                }}
            >
                <div className={`overflow-hidden px-1 ${viewMode === 'grid' ? 'grid grid-cols-2 gap-2 pt-2 pb-3' : viewMode === 'compact' ? 'grid grid-cols-3 gap-1.5 pt-2 pb-3' : 'space-y-0.5 py-1'}`}>
                    {(isExpanded || hasBeenOpened) && bin.visibleNodes.map((node) => (
                        <SidebarItem
                            key={node.name}
                            node={node}
                            activeNode={activeNode}
                            onNodeClick={onNodeClick}
                            onHoverImageChange={onItemMouseEnter}
                            showHoverImage={bin.name === 'Sources' && viewMode === 'list'}
                            viewMode={viewMode}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
});

const Sidebar = ({
    theWorld,
    activeNode,
    onNodeClick,
    onToggleAllSections,
    isExpandedGlobally
}) => {
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
    const [expandedSections, setExpandedSections] = useState(() => {
        const initialState = {};
        theWorld.forEach(bin => {
            initialState[bin.name] = isExpandedGlobally;
        });
        return initialState;
    });

    const [hoveredImage, setHoveredImage] = useState(null);
    const [hoveredPosition, setHoveredPosition] = useState(null);
    const prevExpandedGlobally = useRef(isExpandedGlobally);
    const lastHandledNodeRef = useRef(null);

    // Sync expanded state with global toggle
    useEffect(() => {
        if (prevExpandedGlobally.current !== isExpandedGlobally) {
            const newState = {};
            theWorld.forEach(bin => {
                newState[bin.name] = isExpandedGlobally;
            });
            setExpandedSections(newState);
            prevExpandedGlobally.current = isExpandedGlobally;
        } else if (Object.keys(expandedSections).length === 0 && theWorld.length > 0) {
            const newState = {};
            theWorld.forEach(bin => {
                newState[bin.name] = isExpandedGlobally;
            });
            setExpandedSections(newState);
        }
    }, [isExpandedGlobally, theWorld, expandedSections]);

    // Auto-expand section containing activeNode
    useEffect(() => {
        if (activeNode && activeNode.name !== lastHandledNodeRef.current) {
            lastHandledNodeRef.current = activeNode.name;
            const bin = theWorld.find(b => b.nodes.some(n => n.name === activeNode.name));
            if (bin && expandedSections[bin.name] === false) {
                setExpandedSections(prev => ({
                    ...prev,
                    [bin.name]: true
                }));
            }
        }
    }, [activeNode, theWorld, expandedSections]);

    const toggleSection = useCallback((name) => {
        setExpandedSections(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    }, []);

    const handleMouseEnter = useCallback((arg, position) => {
        if (!arg) {
            setHoveredImage(null);
            setHoveredPosition(null);
            return;
        }

        // If it's already a string (imageUrl), use it directly
        if (typeof arg === 'string') {
            setHoveredImage(arg);
            setHoveredPosition(position || null);
            return;
        }

        // Otherwise assume it's a node object
        const img = arg.imageUrl || (arg.tracks && arg.tracks.length > 0 ? getTrackImage(arg.tracks[0]) : null);
        if (img) {
            setHoveredImage(img);
            setHoveredPosition(position || null);
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        setHoveredImage(null);
        setHoveredPosition(null);
    }, []);

    const processedWorld = useMemo(() => {
        if (!theWorld || theWorld.length === 0) return [];

        const orderMap = { "All Results": 0, "Sources": 1 };

        // Pre-filter and sort once per world change
        return theWorld
            .map(bin => {
                const nodes = bin.nodes.filter(n => (n.tracks?.length || 0) >= (bin.name === "All Results" ? 0 : 3));
                if (nodes.length === 0 && bin.name !== "All Results") return null;
                return { ...bin, visibleNodes: nodes };
            })
            .filter(Boolean)
            .sort((a, b) => {
                const aOrder = orderMap[a.name] ?? 99;
                const bOrder = orderMap[b.name] ?? 99;
                return aOrder - bOrder;
            });
    }, [theWorld]);

    return (
        <div className="flex flex-col h-full">
            {/* Library Header */}
            <div className="pt-3 pb-3 px-2 flex items-center justify-between border-b border-white/3 mb-2">
                <div className="flex items-center gap-3 text-zinc-100 hover:text-white transition-all cursor-default group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800 transition-colors border border-white/5 shadow-inner">
                        <i className="fa fa-bookmark text-spotify-green text-sm group-hover:scale-110 transition-transform"></i>
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 group-hover:text-zinc-100 transition-colors">Library</h3>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Toggles */}
                    <div className="flex bg-zinc-950/50 p-1 rounded-xl border border-white/5 mr-1 shadow-inner">
                        <Tooltip text="List View">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 ${viewMode === 'list' ? 'bg-zinc-800 text-spotify-green shadow-lg ring-1 ring-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <i className="fa fa-list text-[10px]"></i>
                            </button>
                        </Tooltip>
                        <Tooltip text="Grid View">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 ${viewMode === 'grid' ? 'bg-zinc-800 text-spotify-green shadow-lg ring-1 ring-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <i className="fa fa-th-large text-[10px]"></i>
                            </button>
                        </Tooltip>
                        <Tooltip text="Compact Grid">
                            <button
                                onClick={() => setViewMode('compact')}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 ${viewMode === 'compact' ? 'bg-zinc-800 text-spotify-green shadow-lg ring-1 ring-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <i className="fa fa-th text-[10px]"></i>
                            </button>
                        </Tooltip>
                    </div>

                    <Tooltip text={isExpandedGlobally ? "Collapse All" : "Expand All"}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleAllSections();
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 active:scale-90 transition-all duration-200 border border-transparent hover:border-white/10"
                        >
                            <i className={`fa ${isExpandedGlobally ? 'fa-angle-double-up' : 'fa-angle-double-down'} text-sm`}></i>
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto px-1 py-1 space-y-2 [&::-webkit-scrollbar]:w-1.25 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb:hover]:bg-white/20">
                {processedWorld.map((bin) => (
                    <SidebarSection
                        key={bin.name}
                        bin={bin}
                        isExpanded={expandedSections[bin.name] !== false}
                        onToggle={toggleSection}
                        activeNode={activeNode}
                        onNodeClick={onNodeClick}
                        onItemMouseEnter={handleMouseEnter}
                        onItemMouseLeave={handleMouseLeave}
                        viewMode={viewMode}
                    />
                ))}
            </div>

            {/* Source Preview Modal */}
            <SourcePreview imageUrl={hoveredImage} initialPosition={hoveredPosition} />
        </div>
    );
};

export default Sidebar;
