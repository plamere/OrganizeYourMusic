import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * SourcePreview Component
 * A performant hover preview that tracks the mouse using requestAnimationFrame
 * and operates independently of the parent component's render cycle.
 */
const SourcePreview = React.memo(({ imageUrl }) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const requestRef = useRef();

    useEffect(() => {
        if (!imageUrl) return;

        const handleMove = (e) => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            requestRef.current = requestAnimationFrame(() => {
                setMousePos({ x: e.clientX, y: e.clientY });
            });
        };

        window.addEventListener('mousemove', handleMove);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [imageUrl]);

    if (!imageUrl) return null;

    return createPortal(
        <div
            className="fixed z-999999 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
            style={{
                left: `${mousePos.x}px`,
                top: `${mousePos.y}px`,
                transform: 'translate(20px, -50%)',
                willChange: 'left, top'
            }}
        >
            <div className="relative">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-spotify-green/30 rounded-2xl blur-xl shadow-2xl opacity-50"></div>

                {/* Image Container */}
                <div className="relative bg-zinc-900 ring-2 ring-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-64 h-64 object-cover"
                        loading="lazy"
                        onError={(e) => e.target.style.display = 'none'}
                    />
                    {/* Subtle Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>
                </div>
            </div>
        </div>,
        document.body
    );
});

export default SourcePreview;
