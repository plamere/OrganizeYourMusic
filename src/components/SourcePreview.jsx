import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * SourcePreview Component
 * A performant hover preview that tracks the mouse using requestAnimationFrame
 * and operates independently of the parent component's render cycle.
 */
const SourcePreview = React.memo(({ imageUrl, initialPosition }) => {
    const previewRef = useRef(null);
    const latestPointRef = useRef({ x: 0, y: 0 });
    const requestRef = useRef();

    useEffect(() => {
        if (!imageUrl) return;

        const handleMove = (e) => {
            latestPointRef.current = { x: e.clientX, y: e.clientY };

            if (requestRef.current) return;

            requestRef.current = requestAnimationFrame(() => {
                requestRef.current = null;

                if (!previewRef.current) return;

                const { x, y } = latestPointRef.current;
                previewRef.current.style.transform = `translate3d(${x + 30}px, ${y}px, 0) translate3d(0, -50%, 0)`;
            });
        };

        if (initialPosition && previewRef.current) {
            previewRef.current.style.transform = `translate3d(${initialPosition.x + 30}px, ${initialPosition.y}px, 0) translate3d(0, -50%, 0)`;
        }

        window.addEventListener('mousemove', handleMove);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [imageUrl, initialPosition]);

    if (!imageUrl) return null;

    return createPortal(
        <div
            ref={previewRef}
            className="fixed left-0 top-0 z-999999 pointer-events-none opacity-100"
            style={{
                transform: initialPosition
                    ? `translate3d(${initialPosition.x + 30}px, ${initialPosition.y}px, 0) translate3d(0, -50%, 0)`
                    : 'translate3d(30px, -50%, 0)',
                willChange: 'transform, opacity'
            }}
        >
            <div className="relative">
                {/* Enhanced Glow effect */}
                <div className="absolute -inset-2 bg-spotify-green/25 rounded-4xl blur-2xl shadow-2xl opacity-60"></div>

                {/* Image Container */}
                <div className="relative bg-zinc-900 ring-1 ring-white/20 rounded-2xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.7)]">
                    <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-56 h-56 object-contain scale-100 bg-zinc-950/50"
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        onError={(e) => e.target.style.display = 'none'}
                    />
                    {/* Subtle Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-black/20"></div>
                </div>
            </div>
        </div>,
        document.body
    );
});

export default SourcePreview;
