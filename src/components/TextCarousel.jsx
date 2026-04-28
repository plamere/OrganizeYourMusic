import { useState, useEffect, useRef, memo } from 'react';

/**
 * A reusable carousel component for text that overflows its container.
 * Mimics the Spotify-style horizontal scrolling for long titles/names.
 */
const TextCarousel = ({ children, isHovered, className = "", active = true }) => {
    const containerRef = useRef(null);
    const textRef = useRef(null);
    const [overflows, setOverflows] = useState(false);
    const [shift, setShift] = useState(0);

    const checkedRef = useRef(false);
    
    useEffect(() => {
        if (!active) return;
        
        const checkOverflow = () => {
            if (containerRef.current && textRef.current) {
                const isOverflowing = textRef.current.scrollWidth > containerRef.current.clientWidth;
                if (isOverflowing !== overflows) setOverflows(isOverflowing);
                if (isOverflowing) {
                    const newShift = textRef.current.scrollWidth + 24;
                    if (newShift !== shift) setShift(newShift);
                }
                checkedRef.current = true;
            }
        };

        if (isHovered && !checkedRef.current) {
            checkOverflow();
        } else if (!isHovered && checkedRef.current && !overflows) {
            // Reset checked state if we're not hovering and it didn't overflow, 
            // so we re-check next time (in case container width changed)
            checkedRef.current = false;
        }

        // Periodically re-check if hovered and already checked (in case of dynamic layout changes)
        if (isHovered && checkedRef.current) {
            const timer = setTimeout(checkOverflow, 1000);
            return () => clearTimeout(timer);
        }
    }, [isHovered, children, overflows, shift, active]);

    const duration = Math.max(8, Math.round(shift / 28));

    // Optimization: Skip complex logic for short content
    if (typeof children === 'string' && children.length < 5) {
        return <div className={`truncate ${className}`}>{children}</div>;
    }
    
    if (typeof children !== 'string' && typeof children !== 'number') {
        return <div className={`truncate ${className}`}>{children}</div>;
    }

    return (
        <div 
            ref={containerRef} 
            className={`who-carousel ${overflows ? 'who-carousel--scrolling' : ''} ${className}`}
            style={{ 
                '--who-shift': `${shift}px`, 
                '--who-duration': `${duration}s`,
                width: '100%'
            }}
        >
            <span className="who-carousel-track">
                <span ref={textRef} className="who-carousel-text">{children}</span>
                {overflows && (
                    <>
                        <span className="who-carousel-divider" aria-hidden="true">&bull;</span>
                        <span className="who-carousel-text who-carousel-clone" aria-hidden="true">{children}</span>
                    </>
                )}
            </span>
        </div>
    );
};

export default memo(TextCarousel);
