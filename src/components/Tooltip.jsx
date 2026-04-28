import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Tooltip = ({ text, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        setPosition({
            x: e.clientX,
            y: e.clientY - 10 // Offset slightly above the cursor
        });
    };

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);

    return (
        <>
            <div
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                className="inline-block"
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div
                    className="fixed z-999999 pointer-events-none bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-zinc-700 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        transform: 'translate(-50%, -100%) translateY(-20px)' // Move up 20px to match global tooltip
                    }}
                >
                    {text}
                    {/* Subtle arrow */}
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45"></div>
                </div>,
                document.body
            )}
        </>
    );
};

export default Tooltip;
