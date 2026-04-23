import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import TrackTable from '../components/TrackTable';

// Wrapper component to manage state that comes from legacy JS
const TableWrapper = ({ initialTracks, isStaging }) => {
    const [tracks, setTracks] = useState(initialTracks || []);
    const [selectedIds, setSelectedIds] = useState(new Set(window.curSelected || []));
    const [nowPlayingId, setNowPlayingId] = useState(window.nowPlaying ? window.nowPlaying.id : null);
    const [isPlaying, setIsPlaying] = useState(window.audio ? !window.audio.paused : false);

    // Sync with tracks prop change
    useEffect(() => {
        setTracks(initialTracks || []);
    }, [initialTracks]);

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
            
            const playing = window.audio ? !window.audio.paused : false;
            if (playing !== isPlaying) {
                setIsPlaying(playing);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [selectedIds, nowPlayingId, isPlaying]);

    const handleToggleSelection = (id, isSelected) => {
        if (isSelected) {
            window.curSelected.add(id);
        } else {
            window.curSelected.delete(id);
        }
        setSelectedIds(new Set(window.curSelected));
        
        // Update staging counts in UI
        const elements = document.querySelectorAll(".nstaging-tracks");
        elements.forEach(function (el) { el.textContent = window.curSelected.size; });
        
        // If we are in staging view, we might need to refresh the staging list
        // but since this IS the staging list or the main list, it will re-render
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
        />
    );
};

// Global roots
let trackTableRoot = null;
let stagingTableRoot = null;

window.renderTrackTable = (tracks) => {
    const container = document.getElementById('gthe-track-table');
    if (!container) return;
    
    if (!trackTableRoot) {
        trackTableRoot = createRoot(container);
    }
    
    trackTableRoot.render(
        <TableWrapper initialTracks={tracks} isStaging={false} />
    );
};

window.renderStagingTable = (tracks) => {
    const container = document.getElementById('gthe-staging-table');
    if (!container) return;
    
    if (!stagingTableRoot) {
        stagingTableRoot = createRoot(container);
    }
    
    stagingTableRoot.render(
        <TableWrapper initialTracks={tracks} isStaging={true} />
    );
};

console.log("React Table Adapter loaded");
