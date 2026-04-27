import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import Tooltip from './Tooltip';
import SourcePreview from './SourcePreview';

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
    const itemRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            setIsVisible(entry.isIntersecting);
        }, {
            rootMargin: '100px',
            threshold: 0.01
        });

        if (itemRef.current) observer.observe(itemRef.current);
        return () => observer.disconnect();
    }, [viewMode]);

    const handleMouseEnter = useCallback(() => {
        if (showHoverImage) {
            const img = node.imageUrl || (node.tracks?.length > 0 ? getTrackImage(node.tracks[0]) : null);
            if (img) onHoverImageChange(img);
        }
    }, [node, showHoverImage, onHoverImageChange]);

    const handleMouseLeave = useCallback(() => {
        if (showHoverImage) onHoverImageChange(null);
    }, [showHoverImage, onHoverImageChange]);

    const imageUrl = useMemo(() => node.imageUrl || (node.tracks && node.tracks.length > 0 ? getTrackImage(node.tracks[0]) : null), [node]);

    if (viewMode === 'grid' || viewMode === 'compact') {
        const imageUrl = node.imageUrl || (node.tracks?.length > 0 ? getTrackImage(node.tracks[0]) : null);
        const isCompact = viewMode === 'compact';
        
        return (
            <div
                ref={itemRef}
                className="group relative"
            >
                {isVisible ? (
                    <button
                        onClick={() => onNodeClick(node)}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={`w-full text-left transition-all duration-300 flex flex-col group/btn relative overflow-hidden ${isCompact ? 'p-1 gap-1 rounded-lg' : 'p-2 gap-2 rounded-xl'} ${isActive
                            ? 'bg-zinc-800 ring-2 ring-spotify-green shadow-xl'
                            : 'hover:bg-zinc-800/60'
                            }`}
                    >
                        {/* Active Glow Background */}
                        {isActive && (
                            <div className="absolute inset-0 bg-spotify-green/5 blur-2xl pointer-events-none"></div>
                        )}

                        <div className={`aspect-square w-full overflow-hidden bg-zinc-950 shadow-inner relative z-10 ${isCompact ? 'rounded-md' : 'rounded-lg'}`}>
                            {imageUrl ? (
                                <img src={imageUrl} alt={node.name} className="w-full h-full object-cover transition-transform duration-700 group-hover/btn:scale-110" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-zinc-800 to-zinc-900 text-zinc-600">
                                    <i className={`fa ${getCategoryIcon(node.name)} ${isCompact ? 'text-sm' : 'text-2xl'}`}></i>
                                </div>
                            )}
                            <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full font-black backdrop-blur-md transition-all duration-300 ${isCompact ? 'text-[7px]' : 'text-[9px]'} ${isActive ? 'bg-spotify-green text-black' : 'bg-black/60 text-white group-hover/btn:bg-spotify-green group-hover/btn:text-black'}`}>
                                {node.tracks?.length || 0}
                            </div>
                        </div>
                        <span className={`font-black truncate w-full px-0.5 relative z-10 transition-colors duration-300 ${isCompact ? 'text-[8px]' : 'text-[10px]'} ${isActive ? 'text-spotify-green' : 'text-zinc-400 group-hover/btn:text-zinc-100'}`}>
                            {node.name}
                        </span>
                    </button>
                ) : <div className="aspect-square w-full rounded-lg bg-zinc-900/20" />}
            </div>
        );
    }

    return (
        <div
            ref={itemRef}
            className="group min-h-[32px]" // Maintain height for observer
        >
            {isVisible ? (
                <button
                    onClick={() => onNodeClick(node)}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center justify-between group/btn ${isActive
                        ? 'bg-spotify-green text-black shadow-[0_4px_12px_rgba(29,185,84,0.3)]'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                >
                    <span className="truncate">{node.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${isActive ? 'bg-black/10 text-black' : 'bg-zinc-800 text-zinc-500 group-hover/btn:bg-zinc-700'
                        }`}>
                        {node.tracks?.length || 0}
                    </span>
                </button>
            ) : null}
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
    const sectionIcon = useMemo(() => getCategoryIcon(bin.name), [bin.name]);
    const sectionName = useMemo(() => formatName(bin.name), [bin.name]);

    return (
        <div className="space-y-0.5">
            <button
                onClick={() => onToggle(bin.name)}
                className="sidebar-section-header w-full group/header"
            >
                <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 flex items-center justify-center rounded-md transition-all duration-200 border border-white/5 ${isExpanded ? 'bg-spotify-green/10 text-spotify-green' : 'bg-zinc-900 text-zinc-600 group-hover/header:bg-zinc-800 group-hover/header:text-zinc-300'}`}>
                        <i className={`fa ${sectionIcon} text-[8px]`}></i>
                    </div>
                    <span className="transition-colors duration-200 group-hover/header:text-white">{sectionName}</span>
                </div>
                <i className={`fa fa-chevron-right text-[7px] transition-transform duration-300 ${isExpanded ? 'rotate-90 text-zinc-400' : 'text-zinc-600'}`}></i>
            </button>

            <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}
                style={{ willChange: 'grid-template-rows, opacity' }}
            >
                <div className={`overflow-hidden px-1 ${viewMode === 'grid' ? 'grid grid-cols-2 gap-2 pt-2 pb-3' : viewMode === 'compact' ? 'grid grid-cols-3 gap-1.5 pt-2 pb-3' : 'space-y-0.5 py-1'}`}>
                    {bin.visibleNodes.map((node) => (
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

    const handleMouseEnter = useCallback((arg) => {
        if (!arg) {
            setHoveredImage(null);
            return;
        }

        // If it's already a string (imageUrl), use it directly
        if (typeof arg === 'string') {
            setHoveredImage(arg);
            return;
        }

        // Otherwise assume it's a node object
        const img = arg.imageUrl || (arg.tracks && arg.tracks.length > 0 ? getTrackImage(arg.tracks[0]) : null);
        if (img) setHoveredImage(img);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setHoveredImage(null);
    }, []);

    const processedWorld = useMemo(() => {
        if (!theWorld || theWorld.length === 0) return [];

        const result = theWorld
            .map(bin => ({
                ...bin,
                visibleNodes: bin.nodes.filter(n => (n.tracks?.length || 0) >= (bin.name === "All Results" ? 0 : 3))
            }))
            .filter(bin => bin.visibleNodes.length > 0 || bin.name === "All Results");

        const allIdx = result.findIndex(b => b.name === "All Results");
        if (allIdx > -1) {
            const [all] = result.splice(allIdx, 1);
            result.unshift(all);
        }
        const srcIdx = result.findIndex(b => b.name === "Sources");
        if (srcIdx > -1) {
            const [src] = result.splice(srcIdx, 1);
            result.splice(1, 0, src);
        }
        return result;
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
            <div className="flex-1 overflow-y-auto px-1 py-1 custom-scrollbar space-y-2">
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
            <SourcePreview imageUrl={hoveredImage} />
        </div>
    );
};

export default Sidebar;
