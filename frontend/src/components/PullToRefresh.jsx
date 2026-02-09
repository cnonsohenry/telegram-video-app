import React, { useState, useEffect, useRef } from 'react';
import { RefreshCcw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);

  const pullThreshold = 80; // How many pixels to pull before refreshing

  const handleTouchStart = (e) => {
    // Only allow pull if we are at the very top of the scroll
    if (window.scrollY === 0) {
      startY.current = e.touches[0].pageY;
    } else {
      startY.current = 0;
    }
  };

  const handleTouchMove = (e) => {
    if (startY.current === 0 || isRefreshing) return;

    const currentY = e.touches[0].pageY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      // Add "resistance" so it feels like a real app (logarithmic pull)
      const resistance = Math.min(diff * 0.4, pullThreshold + 20);
      setPullDistance(resistance);
      
      // Prevent browser's default refresh if we are handling it
      if (diff > 10 && e.cancelable) e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= pullThreshold) {
      setIsRefreshing(true);
      setPullDistance(50); // Keep it visible while loading
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
    startY.current = 0;
  };

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* 🟢 THE REFRESH INDICATOR */}
      <div style={{
        position: 'absolute',
        top: pullDistance - 40, // Hidden above the screen until pulled
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1500,
        background: '#1c1c1e',
        padding: '10px',
        borderRadius: '50%',
        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: isRefreshing ? 'none' : 'top 0.2s ease, transform 0.2s ease',
        opacity: pullDistance > 20 ? 1 : 0
      }}>
        <RefreshCcw 
          size={20} 
          color="#ff3b30" 
          style={{ 
            transform: `rotate(${pullDistance * 4}deg)`,
            animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
          }} 
        />
      </div>

      {children}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}