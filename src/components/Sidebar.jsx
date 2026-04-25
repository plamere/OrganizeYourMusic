import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';

const Sidebar = ({
    theWorld,
    activeNode,
    onNodeClick,
    onToggleAllSections,
    isExpandedGlobally
}) => {
    // Robust initialization of expandedSections
    const [expandedSections, setExpandedSections] = useState(() => {
        const initialState = {};
        // Default based on global state
        theWorld.forEach(bin => {
            initialState[bin.name] = isExpandedGlobally;
        });
        return initialState;
    });

    const [hoveredImage, setHoveredImage] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const prevExpandedGlobally = useRef(isExpandedGlobally);

    // Sync expanded state with global toggle and handle world population
    useEffect(() => {
        // If world was empty and now has data, initialize expanded state
        if (Object.keys(expandedSections).length === 0 && theWorld.length > 0) {
            const newState = {};
            theWorld.forEach(bin => {
                newState[bin.name] = isExpandedGlobally;
            });
            setExpandedSections(newState);
            return;
        }

        // Handle global toggle
        if (prevExpandedGlobally.current !== isExpandedGlobally) {
            const newState = {};
            theWorld.forEach(bin => {
                newState[bin.name] = isExpandedGlobally;
            });
            setExpandedSections(newState);
            prevExpandedGlobally.current = isExpandedGlobally;
        }
    }, [isExpandedGlobally, theWorld]);

    const toggleSection = (name) => {
        setExpandedSections(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };

    const uname = (s) => {
        if (!s) return "";
        const formatted = s.replace(/_/g, " ");
        if (formatted.startsWith("(")) return formatted;
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    const getBaseTrack = (track) => (track?.track && track?.track?.id ? track.track : track);
    const getTrackImage = (track) => {
        const base = getBaseTrack(track);
        return base?.image_url || track?.details?.image_url || track?.image_url || null;
    };

    const handleMouseEnter = (e, node) => {
        const img = getTrackImage(node.tracks[0]);
        if (img) {
            setHoverPosition({
                x: e.clientX,
                y: e.clientY
            });
            setHoveredImage(img);
        }
    };

    const handleMouseMove = (e) => {
        if (hoveredImage) {
            setHoverPosition({
                x: e.clientX,
                y: e.clientY
            });
        }
    };

    const handleMouseLeave = () => {
        setHoveredImage(null);
    };

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

    const orderedWorld = useMemo(() => {
        console.log("Processing World for Sidebar, categories:", theWorld?.length);
        if (!theWorld || theWorld.length === 0) return [];

        const result = [...theWorld];
        // Move "All Results" to top
        const allIdx = result.findIndex(b => b.name === "All Results");
        if (allIdx > -1) {
            const [all] = result.splice(allIdx, 1);
            result.unshift(all);
        }
        // Move "Sources" to second
        const srcIdx = result.findIndex(b => b.name === "Sources");
        if (srcIdx > -1) {
            const [src] = result.splice(srcIdx, 1);
            result.splice(1, 0, src);
        }
        return result;
    }, [theWorld]);

    return (
        <div className="flex flex-col h-full">
            {/* Spotify-style Library Header */}
            <div className="pt-4 pb-4 px-2 flex items-center justify-between border-b border-white/3 mb-4">
                <div className="flex items-center gap-3 text-zinc-100 hover:text-white transition-all cursor-default group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800 transition-colors border border-white/5 shadow-inner">
                        <i className="fa fa-bookmark text-spotify-green text-sm group-hover:scale-110 transition-transform"></i>
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 group-hover:text-zinc-100 transition-colors">Library</h3>
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

            {/* Sections */}
            <div className="flex-1 overflow-y-auto px-1 py-2 custom-scrollbar space-y-4">
                {orderedWorld.map((bin) => {
                    const isExpanded = expandedSections[bin.name] !== false;
                    const visibleNodes = bin.nodes.filter(n => n.tracks.length >= (bin.name === "All Results" ? 0 : 3));

                    if (visibleNodes.length === 0 && bin.name !== "All Results") return null;

                    return (
                        <div key={bin.name} className="space-y-0.5">
                            <button
                                onClick={() => toggleSection(bin.name)}
                                className="sidebar-section-header w-full"
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-5 h-5 flex items-center justify-center rounded-md ${isExpanded ? 'bg-spotify-green/10 text-spotify-green' : 'bg-zinc-900 text-zinc-600'} group-hover:bg-spotify-green/20 group-hover:text-spotify-green transition-all border border-white/5`}>
                                        <i className={`fa ${getCategoryIcon(bin.name)} text-[8px]`}></i>
                                    </div>
                                    <span>{uname(bin.name)}</span>
                                </div>
                                <i className={`fa fa-chevron-right text-[7px] transition-transform duration-200 ${isExpanded ? 'rotate-90 text-white' : 'text-zinc-600'}`}></i>
                            </button>
 
                            <div className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
                                <ul className="overflow-hidden space-y-0.5 px-1">
                                    {visibleNodes.map((node) => {
                                        const isActive = activeNode && activeNode.name === node.name;
                                        return (
                                            <li
                                                key={node.name}
                                                onClick={() => onNodeClick(node)}
                                                onMouseEnter={(e) => bin.name === 'Sources' && handleMouseEnter(e, node)}
                                                onMouseMove={handleMouseMove}
                                                onMouseLeave={handleMouseLeave}
                                                className={`sidebar-item ${isActive ? 'active' : ''}`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    {isActive && (
                                                        <div className="w-1 h-1 rounded-full bg-spotify-green shadow-[0_0_6px_rgba(29,185,84,0.6)]"></div>
                                                    )}
                                                    <span className={`truncate transition-colors ${isActive ? 'text-spotify-green' : ''}`}>
                                                        {uname(node.name)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="sidebar-item-count">
                                                        {node.tracks.length}
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Source Preview Modal - Rendered via Portal to avoid sidebar clipping */}
            {hoveredImage && createPortal(
                <div
                    className="fixed z-999999 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        left: `${hoverPosition.x}px`,
                        top: `${hoverPosition.y}px`,
                        transform: 'translate(20px, -50%)' // Position to the right of the cursor
                    }}
                >
                    <div className="relative">
                        <div className="absolute -inset-1 bg-spotify-green/30 rounded-2xl blur-xl shadow-2xl opacity-50"></div>
                        <div className="relative bg-zinc-900 ring-2 ring-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                            <img
                                src={hoveredImage}
                                alt="Source Preview"
                                className="w-64 h-64 object-cover"
                                onError={(e) => e.target.style.display = 'none'}
                            />
                            {/* Overlay with subtle gradient */}
                            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Sidebar;
