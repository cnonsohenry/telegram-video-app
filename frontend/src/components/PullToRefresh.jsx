import React, { useState, useRef } from 'react';
import { RefreshCcw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children, scrollRef }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);

  const startY = useRef(0);
  const startX = useRef(0);
  const canPullRef = useRef(false);
  const isPullingRef = useRef(false);

  // Constants for gesture tuning
  const PULL_DEADZONE = 25; // Ignore micro-movements <25px to prevent accidental triggers
  const PULL_THRESHOLD = 75; // Pixels of pull distance needed to activate refresh
  const MAX_PULL = 100; // Cap visual displacement

  // Helper to reliably locate the scrollable container element
  const getScrollContainer = () => {
    if (scrollRef && scrollRef.current) return scrollRef.current;
    if (!containerRef.current) return null;

    // 1. Check child elements (e.g. Home.jsx where scroll container is inside PullToRefresh)
    const child = containerRef.current.querySelector?.(
      '[style*="overflow-y: auto"], [style*="overflow-y: scroll"], [style*="overflow: auto"], [style*="overflow: scroll"]'
    ) || containerRef.current.firstElementChild;
    if (child && child.scrollHeight > child.clientHeight) {
      const style = window.getComputedStyle(child);
      if (['auto', 'scroll'].includes(style.overflowY)) return child;
    }

    // 2. Check parent/ancestor elements (e.g. Explore.jsx where PullToRefresh is inside scroll container)
    let parent = containerRef.current.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (['auto', 'scroll'].includes(style.overflowY)) {
        return parent;
      }
      parent = parent.parentElement;
    }

    return null;
  };

  const getScrollTop = () => {
    const el = getScrollContainer();
    if (el) return el.scrollTop;
    return window.scrollY || document.documentElement.scrollTop || 0;
  };

  const handleTouchStart = (e) => {
    if (isRefreshing) return;

    // Pull to refresh is STRICTLY permitted only if touch begins while already at the top
    const scrollTop = getScrollTop();
    if (scrollTop <= 1) {
      canPullRef.current = true;
      startY.current = e.touches[0].pageY;
      startX.current = e.touches[0].pageX;
      isPullingRef.current = false;
    } else {
      canPullRef.current = false;
      startY.current = 0;
      startX.current = 0;
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!canPullRef.current || isRefreshing || startY.current === 0) return;

    const currentY = e.touches[0].pageY;
    const currentX = e.touches[0].pageX;
    const diffY = currentY - startY.current;
    const diffX = Math.abs(currentX - startX.current);

    // Cancel if container has scrolled down during touch
    if (getScrollTop() > 1) {
      canPullRef.current = false;
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    // Cancel if user is swiping horizontally
    if (diffX > Math.abs(diffY)) {
      canPullRef.current = false;
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    // User is moving finger upwards (scrolling down into content) - don't intercept
    if (diffY <= 0) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    // Deadzone: minor finger drag (< 25px) does not engage pull-to-refresh
    if (diffY < PULL_DEADZONE) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    // Deliberate downward pull detected past deadzone
    isPullingRef.current = true;
    if (e.cancelable) {
      e.preventDefault();
    }

    // Apply smooth resistance damping
    const effectiveDiff = diffY - PULL_DEADZONE;
    const pull = Math.min(MAX_PULL, effectiveDiff * 0.38);
    setPullDistance(pull);
  };

  const handleTouchEnd = async () => {
    if (!canPullRef.current || isRefreshing) {
      canPullRef.current = false;
      isPullingRef.current = false;
      setPullDistance(0);
      startY.current = 0;
      return;
    }

    const shouldRefresh = pullDistance >= PULL_THRESHOLD;

    if (shouldRefresh) {
      setIsRefreshing(true);
      setPullDistance(55); // Resting loading position
      try {
        if (typeof onRefresh === 'function') {
          await onRefresh();
        }
      } catch (err) {
        console.error("Pull to refresh failed", err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }

    canPullRef.current = false;
    isPullingRef.current = false;
    startY.current = 0;
  };

  const handleTouchCancel = () => {
    canPullRef.current = false;
    isPullingRef.current = false;
    setPullDistance(0);
    startY.current = 0;
  };

  const isOverThreshold = pullDistance >= PULL_THRESHOLD;

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* 🟢 THE REFRESH INDICATOR */}
      <div style={{
        position: 'absolute',
        top: pullDistance - 45, // Hidden above the screen until pulled
        left: '50%',
        transform: `translateX(-50%) scale(${isOverThreshold ? 1.12 : 1})`,
        zIndex: 1500,
        background: '#1c1c1e',
        padding: '10px',
        borderRadius: '50%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        border: isOverThreshold ? '1.5px solid var(--primary-color, #ff3b30)' : '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: isRefreshing ? 'border 0.2s ease, transform 0.2s ease' : 'top 0.15s ease-out, transform 0.2s ease, opacity 0.2s ease',
        opacity: pullDistance > 15 ? 1 : 0,
        pointerEvents: 'none'
      }}>
        <RefreshCcw 
          size={20} 
          color={isOverThreshold || isRefreshing ? "var(--primary-color, #ff3b30)" : "#999"} 
          style={{ 
            transform: isRefreshing ? 'none' : `rotate(${pullDistance * 4.5}deg)`,
            animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
            transition: 'color 0.2s ease'
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