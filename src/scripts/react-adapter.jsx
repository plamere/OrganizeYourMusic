import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import TrackTable from '../components/TrackTable';
import Sidebar from '../components/Sidebar';

// Wrapper component to manage state that comes from legacy JS
const TableWrapper = ({ initialTracks, isStaging, autoPlayInitialTrack = true, actionsContainerId, storageNamespace }) => {
    const [tracks, setTracks] = useState(initialTracks || []);
    const [selectedIds, setSelectedIds] = useState(new Set(window.curSelected || []));
    const [nowPlayingId, setNowPlayingId] = useState(window.nowPlaying ? window.nowPlaying.id : null);
    const [isPlaying, setIsPlaying] = useState(!!window.nowPlaying);

    // Sync with tracks prop change
    useEffect(() => {
        setTracks(initialTracks || []);
        
        // Auto-play the first track when a new collection is loaded (not in staging)
        if (autoPlayInitialTrack && !isStaging && initialTracks && initialTracks.length > 0) {
            const firstTrack = initialTracks[0];
            // Small delay to ensure the player container is ready and window.playTrack is available
            setTimeout(() => {
                handlePlayTrack(firstTrack);
            }, 500);
        }
    }, [initialTracks, isStaging, autoPlayInitialTrack]);

    // Sync with global state changes from legacy JS
    useEffect(() => {
        const interval = setInterval(() => {
            if (window.curSelected) {
                // Only update if size changed or we need to sync (simplified sync)
                if (window.curSelected.size !== selectedIds.size) {
                    setSelectedIds(new Set(window.curSelected));
                }
            }
            if (window.nowPlaying) {
                if (window.nowPlaying.id !== nowPlayingId) {
                    setNowPlayingId(window.nowPlaying.id);
                }
            } else if (nowPlayingId) {
                setNowPlayingId(null);
            }

            const playing = !!window.nowPlaying;
            if (playing !== isPlaying) {
                setIsPlaying(playing);
            }
        }, 250);
        return () => clearInterval(interval);
    }, [selectedIds, nowPlayingId, isPlaying]);

    const handleToggleSelection = (ids, isSelected) => {
        const idList = Array.isArray(ids) ? ids : [ids];

        idList.forEach(id => {
            if (isSelected) {
                window.curSelected.add(id);
            } else {
                window.curSelected.delete(id);
            }
        });

        setSelectedIds(new Set(window.curSelected));

        // Update staging counts in UI
        const elements = document.querySelectorAll(".nstaging-tracks");
        elements.forEach(function (el) { el.textContent = window.curSelected.size; });
    };

    const handleToggleAll = (isSelected, trackList) => {
        trackList.forEach(track => {
            if (isSelected) window.curSelected.add(track.id);
            else window.curSelected.delete(track.id);
        });
        setSelectedIds(new Set(window.curSelected));

        const elements = document.querySelectorAll(".nstaging-tracks");
        elements.forEach(function (el) { el.textContent = window.curSelected.size; });
    };

    const handlePlayTrack = (track) => {
        if (window.playTrack) {
            window.playTrack(track);
        }
    };

    try {
        return (
            <TrackTable
                tracks={tracks}
                selectedIds={selectedIds}
                onToggleSelection={handleToggleSelection}
                onToggleAll={handleToggleAll}
                onPlayTrack={handlePlayTrack}
                nowPlayingId={nowPlayingId}
                isPlaying={isPlaying}
                isStaging={isStaging}
                actionsContainerId={actionsContainerId}
                storageNamespace={storageNamespace}
            />
        );
    } catch (e) {
        console.error("TrackTable crashed:", e);
        return <div className="p-10 text-center text-red-500 font-bold bg-zinc-900 rounded-xl border border-red-500/20">
            <i className="fa fa-exclamation-triangle mr-2"></i>
            Something went wrong rendering the track table. Check console for details.
        </div>;
    }
};

// Sidebar Wrapper component
const SidebarWrapper = ({ initialWorld }) => {
    const [world, setWorld] = useState(initialWorld || window.theWorld || []);
    const [activeNode, setActiveNode] = useState(window.curNode);

    // Read from localStorage directly for initial state if global var is not ready
    const [isExpandedGlobally, setIsExpandedGlobally] = useState(() => {
        if (typeof window.sidebarExpanded === 'boolean') return window.sidebarExpanded;
        const saved = window.localStorage.getItem('oym_sidebar_expanded');
        return saved !== 'false';
    });

    // Sync with initialWorld prop change
    useEffect(() => {
        if (initialWorld && initialWorld.length > 0) {
            setWorld([...initialWorld]);
        }
    }, [initialWorld]);

    useEffect(() => {
        const interval = setInterval(() => {
            // Update active node from legacy state
            if (window.curNode !== activeNode) {
                setActiveNode(window.curNode);
            }
            // Update expanded state from legacy state
            if (window.sidebarExpanded !== undefined && window.sidebarExpanded !== isExpandedGlobally) {
                setIsExpandedGlobally(window.sidebarExpanded);
            }

            // Periodically sync with global theWorld ONLY if it changed
            const currentWorld = window.theWorld || [];
            if (currentWorld.length > 0 && currentWorld.length !== world.length) {
                setWorld([...currentWorld]);
            }
        }, 1000); // Increased interval to reduce CPU churn
        return () => clearInterval(interval);
    }, [activeNode, isExpandedGlobally, world]);

    const handleNodeClick = (node) => {
        if (window.plotPlaylist) window.plotPlaylist(node);
        if (window.showPlaylist) window.showPlaylist(node);
        setActiveNode(node);
    };

    const handleToggleAll = () => {
        if (window.toggleSidebarSections) window.toggleSidebarSections();
    };

    return (
        <Sidebar
            theWorld={world}
            activeNode={activeNode}
            onNodeClick={handleNodeClick}
            onToggleAllSections={handleToggleAll}
            isExpandedGlobally={isExpandedGlobally}
        />
    );
};

// Global roots
let trackTableRoot = null;
let stagingTableRoot = null;
let playlistTableRoot = null;
let sidebarRoot = null;

window.renderTrackTable = (tracks) => {
    const trackCount = tracks?.length || 0;

    let container = document.getElementById('gthe-track-table');
    if (!container) {
        console.warn("[ReactAdapter] Container 'gthe-track-table' not found! Searching for shell...");
        trackTableRoot = null; // Reset root reference
        const shell = document.getElementById('track-table-shell');
        if (shell) {
            const inner = shell.querySelector('.overflow-x-auto');
            if (inner) {
                inner.innerHTML = '<div id="gthe-track-table" class="w-full text-left"></div>';
                container = document.getElementById('gthe-track-table');
            }
        }
    }

    if (!container) {
        console.error("[ReactAdapter] FATAL: Could not find or recreate track table container");
        return;
    }

    // Force parent shell to be visible
    const shell = document.getElementById('track-table-shell');
    if (shell) shell.classList.remove('hidden');
    const emptyState = document.getElementById('track-table-empty');
    if (emptyState) emptyState.classList.add('hidden');

    if (!trackTableRoot || !container.isConnected) {
        if (trackTableRoot) {
            try { trackTableRoot.unmount(); } catch (e) { }
        }
        trackTableRoot = createRoot(container);
    }

    trackTableRoot.render(
        <TableWrapper initialTracks={tracks} isStaging={false} actionsContainerId="playlist-actions-container" />
    );
};

window.renderPlaylistTrackTable = (tracks) => {
    const trackCount = tracks?.length || 0;

    const container = document.getElementById('gthe-playlist-sequence-table');
    if (!container) {
        console.error("[ReactAdapter] Playlist sequence container not found!");
        return;
    }

    if (!playlistTableRoot || !container.isConnected) {
        if (playlistTableRoot) {
            try { playlistTableRoot.unmount(); } catch (e) { }
        }
        playlistTableRoot = createRoot(container);
    }

    playlistTableRoot.render(
        <TableWrapper
            initialTracks={tracks}
            isStaging={false}
            autoPlayInitialTrack={false}
            actionsContainerId="playlist-sequence-actions-container"
            storageNamespace="playlist-sequence"
        />
    );
};

window.renderStagingTable = (tracks) => {
    const container = document.getElementById('gthe-staging-table');
    if (!container) {
        console.error("Staging table container not found!");
        return;
    }

    if (!stagingTableRoot || !container.isConnected) {
        if (stagingTableRoot) {
            try { stagingTableRoot.unmount(); } catch (e) { }
        }
        stagingTableRoot = createRoot(container);
    }

    stagingTableRoot.render(
        <TableWrapper initialTracks={tracks} isStaging={true} actionsContainerId="staging-actions-container" />
    );
};

window.renderSidebar = (theWorld) => {
    const container = document.getElementById('sidebar');
    if (!container) {
        console.error("Sidebar container not found!");
        return;
    }

    if (!sidebarRoot || !container.isConnected) {
        if (sidebarRoot) {
            try { sidebarRoot.unmount(); } catch (e) { }
        }
        sidebarRoot = createRoot(container);
    }

    sidebarRoot.render(
        <SidebarWrapper initialWorld={theWorld} />
    );
};

// Initial proactive render check
const proactiveRender = () => {
    if (window.theWorld && window.theWorld.length > 0) {
        window.renderSidebar(window.theWorld);
    }
    if (window.curNode && window.curNode.tracks) {
        window.renderTrackTable(window.curNode.tracks);
        if (window.curNode.sourceType === 'playlist') {
            window.renderPlaylistTrackTable(window.curNode.tracks);
        }
    } else if (window.allTracks && window.allTracks.length > 0) {
        // Fallback to all tracks if no node selected but data exists
        window.renderTrackTable(window.allTracks);
    }
};

// Handle multiple ready states
if (document.readyState === 'complete') {
    proactiveRender();
} else {
    window.addEventListener('load', proactiveRender);
}