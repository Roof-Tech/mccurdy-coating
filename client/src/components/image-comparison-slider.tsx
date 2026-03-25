import { useState, useRef, useCallback, useEffect } from "react";

interface ImageComparisonSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export function ImageComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
  className = "",
}: ImageComparisonSliderProps) {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState({ before: false, after: false });
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(2, Math.min(98, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      updatePosition(clientX);
    };
    const handleEnd = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, updatePosition]);

  const allLoaded = imagesLoaded.before && imagesLoaded.after;

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-lg border border-border cursor-col-resize ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      data-testid="image-comparison-slider"
      style={{ touchAction: "none" }}
    >
      {/* Loading state */}
      {!allLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Loading images...</span>
          </div>
        </div>
      )}

      {/* After image (full, underneath) */}
      <img
        src={afterSrc}
        alt={afterLabel}
        className="w-full h-full object-cover block"
        style={{ aspectRatio: "4/3" }}
        draggable={false}
        onLoad={() => setImagesLoaded(prev => ({ ...prev, after: true }))}
      />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="h-full object-cover block"
          style={{ aspectRatio: "4/3", width: containerRef.current?.offsetWidth || "100%" }}
          draggable={false}
          onLoad={() => setImagesLoaded(prev => ({ ...prev, before: true }))}
        />
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 w-[3px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)] z-10"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        {/* Handle circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center border-2 border-white/80">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 4L3 10L7 16" stroke="#2B4A6F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 4L17 10L13 16" stroke="#2B4A6F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div
        className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-semibold z-10 transition-opacity"
        style={{
          backgroundColor: "rgba(0,0,0,0.65)",
          color: "white",
          opacity: position > 15 ? 1 : 0,
        }}
      >
        {beforeLabel}
      </div>
      <div
        className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-xs font-semibold z-10 transition-opacity"
        style={{
          backgroundColor: "rgba(43,74,111,0.8)",
          color: "white",
          opacity: position < 85 ? 1 : 0,
        }}
      >
        {afterLabel}
      </div>

      {/* Instruction hint */}
      {allLoaded && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[10px] font-medium z-10 pointer-events-none animate-pulse"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "white" }}
        >
          ← Drag to compare →
        </div>
      )}
    </div>
  );
}
