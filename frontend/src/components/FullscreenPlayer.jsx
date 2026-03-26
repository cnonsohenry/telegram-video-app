import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, ArrowLeft, Play, Pause, Loader2, Maximize, Minimize, Share2, Download, Check } from "lucide-react";
import fluidPlayer from 'fluid-player';
import 'fluid-player/src/css/fluidplayer.css'; 

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  const playerWrapperRef = useRef(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null); 
  const playerInstance = useRef(null); 
  const lastTap = useRef(0);
  const hideTimeout = useRef(null); 
  const isAdActiveRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showControls, setShowControls] = useState(true); 
  const [copied, setCopied] = useState(false); 
  const [isDownloading, setIsDownloading] = useState(false); 
  const [isAdActive, setIsAdActive] = useState(false);

  const isPremiumStream = video?.video_url?.includes('.m3u8');

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      setIsPlaying(playing => {
        if (playing) setShowControls(false); 
        return playing;
      });
    }, 3000);
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.style.objectFit = isZoomed ? "cover" : "contain";
  }, [isZoomed]);

  const handleInteraction = (e) => {
    if (e) e.stopPropagation();
    if (isAdActive) return; 

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      setIsZoomed(z => !z);
      lastTap.current = 0; 
      resetHideTimer();
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current === now && videoRef.current) {
          if (!isDesktop) {
            setShowControls(prev => {
              if (!prev) { resetHideTimer(); return true; }
              if (hideTimeout.current) clearTimeout(hideTimeout.current);
              return false;
            });
          } else {
            resetHideTimer();
            if (playerInstance.current) {
              if (isPlaying) playerInstance.current.pause();
              else playerInstance.current.play();
            }
          }
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleTogglePlay = (e) => {
    e.stopPropagation();
    resetHideTimer();
    if (playerInstance.current) {
      if (isPlaying) playerInstance.current.pause();
      else playerInstance.current.play();
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    resetHideTimer();
    const shareUrl = `https://naijahomemade.com/v/${video.message_id}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Naija Homemade', text: video.caption || 'Watch this video', url: shareUrl }); } 
      catch (err) { console.log("Native share cancelled", err); }
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    resetHideTimer();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(video.video_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `naijahomemade-${video.message_id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    resetHideTimer();
    
    let isMounted = true;
    let initTimeout;

    initTimeout = setTimeout(() => {
        if (!isMounted || !playerWrapperRef.current || playerInstance.current) return;
        
        playerWrapperRef.current.innerHTML = ''; 
        
        const uniqueId = `fp-video-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        const videoEl = document.createElement('video');
        videoEl.id = uniqueId;
        videoEl.playsInline = true;
        
        // 🟢 THE JS NUKE: Aggressively strip native browser controls
        videoEl.controls = false; 
        videoEl.removeAttribute('controls');
        
        videoEl.style.width = "100%";
        videoEl.style.height = "100%";
        videoEl.style.objectFit = "contain";
        videoEl.style.transition = "object-fit 0.3s ease";
        videoEl.style.zIndex = "1";
        
        const sourceEl = document.createElement('source');
        sourceEl.src = video.video_url;
        sourceEl.type = isPremiumStream ? "application/x-mpegURL" : "video/mp4";
        videoEl.appendChild(sourceEl);
        
        playerWrapperRef.current.appendChild(videoEl);
        videoRef.current = videoEl;

        videoEl.ontimeupdate = () => {
            if (!isAdActiveRef.current) {
                const current = videoEl.currentTime;
                const duration = videoEl.duration;
                if (duration > 0) setProgress((current / duration) * 100);
            }
        };
        videoEl.onplaying = () => { setIsLoading(false); setIsPlaying(true); };
        videoEl.onwaiting = () => setIsLoading(true);

        const playerOptions = {
            layoutControls: {
                fillToContainer: true,
                playButtonShowing: false, 
                autoPlay: true, 
                keyboardControl: false,
                allowDownload: false, // Double check Fluid doesn't add its own download button
            }
        };

        if (!isPremiumStream) {
            playerOptions.vastOptions = {
                allowVPAID: true,
                adList: [
                    {
                        roll: 'preRoll',
                        vastTag: 'https://s.magsrv.com/v1/vast.php?idzone=5880122',
                        adText: 'Ad closes in [unplayedSeconds]s',
                        adTextPosition: 'top right'
                    }
                ],
                vastAdvanced: {
                    vastVideoPlayingCallback: () => {
                        setIsAdActive(true);
                        isAdActiveRef.current = true;
                        setIsLoading(false); 
                    },
                    vastVideoEndedCallback: () => {
                        setIsAdActive(false);
                        isAdActiveRef.current = false;
                    },
                    vastVideoSkippedCallback: () => {
                        setIsAdActive(false);
                        isAdActiveRef.current = false;
                    },
                    noVastVideoCallback: () => {
                        setIsAdActive(false);
                        isAdActiveRef.current = false;
                        setIsLoading(false); 
                    }
                }
            };
        }

        playerInstance.current = fluidPlayer(videoEl.id, playerOptions);

        playerInstance.current.on('playing', () => {
            setIsPlaying(true);
            setIsLoading(false); 
        });
        playerInstance.current.on('pause', () => setIsPlaying(false));
        playerInstance.current.on('ended', () => setIsPlaying(false));
        
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      
      if (playerInstance.current) {
          playerInstance.current.destroy();
          playerInstance.current = null;
      }
      if (playerWrapperRef.current) {
          playerWrapperRef.current.innerHTML = '';
      }
    };
  }, [resetHideTimer, video.video_url, isPremiumStream]);

  if (!video) return null;

  return (
    <div ref={containerRef} style={overlayStyle} onClick={onClose}>
      
      {!isDesktop ? (
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ ...mobileBackButtonStyle, zIndex: 10006 }}>
          <ArrowLeft size={28} />
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ ...desktopCloseButtonStyle, zIndex: 10006 }}>
          <X size={24} />
        </button>
      )}

      {!isAdActive && <div style={{ ...topGradientStyle, opacity: showControls ? 1 : 0, pointerEvents: "none" }} />}

      <div style={stageStyle} onClick={(e) => e.stopPropagation()}>
        <div onClick={handleInteraction} style={videoWrapperStyle}>
          
          {isLoading && (
            <div style={loaderContainerStyle}>
              <Loader2 size={48} color="var(--primary-color)" className="spin-animation" />
            </div>
          )}

          <div ref={playerWrapperRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />

          {!isAdActive && (!isLoading && (showControls || !isPlaying)) && (
            <button
              onClick={handleTogglePlay}
              style={{
                ...centerControlStyle,
                opacity: (showControls || !isPlaying) ? 1 : 0,
                pointerEvents: (showControls || !isPlaying) ? "auto" : "none"
              }}
            >
              <div style={centerIconCircleStyle}>
                {isPlaying ? <Pause size={36} fill="white" color="white" /> : <Play size={36} fill="white" color="white" />}
              </div>
            </button>
          )}

          {!isAdActive && <div style={{ ...bottomGradientStyle, opacity: showControls ? 1 : 0 }} />}

          {!isAdActive && (
            <div style={{ ...actionButtonsContainerStyle, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}>
              <button onClick={handleShare} style={actionButtonStyle}>
                <div style={sideIconCircleStyle}>
                  {copied ? <Check size={20} color="#4ade80" /> : <Share2 size={20} />}
                </div>
                <span style={actionLabelStyle}>{copied ? "Copied!" : "Share"}</span>
              </button>

              <button onClick={handleDownload} style={actionButtonStyle}>
                <div style={sideIconCircleStyle}>
                  {isDownloading ? <Loader2 size={20} className="spin-animation" /> : <Download size={20} />}
                </div>
                <span style={actionLabelStyle}>Save</span>
              </button>

              <button onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); resetHideTimer(); }} style={actionButtonStyle}>
                 <div style={sideIconCircleStyle}>
                   {isZoomed ? <Minimize size={20} /> : <Maximize size={20} />}
                 </div>
                 <span style={actionLabelStyle}>{isZoomed ? "Fit" : "Fill"}</span>
              </button>
            </div>
          )}

          {!isAdActive && (
            <div style={{ 
                ...progressWrapperStyle, 
                bottom: showControls ? "max(30px, env(safe-area-inset-bottom))" : "10px",
                padding: showControls ? "0 20px" : "0",
                opacity: 1 
            }}>
               <input 
                 type="range" min="0" max="100" step="0.1"
                 value={progress || 0} 
                 onChange={(e) => {
                   e.stopPropagation();
                   if (videoRef.current) {
                     videoRef.current.currentTime = (e.target.value / 100) * videoRef.current.duration;
                     setProgress(e.target.value);
                     resetHideTimer();
                   }
                 }}
                 className={showControls ? "range-active" : "range-mini"}
                 style={rangeInputBaseStyle}
               />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
        .range-mini::-webkit-slider-thumb { appearance: none; width: 0; height: 0; }
        .range-mini { height: 2px !important; pointer-events: none; opacity: 0.5; }
        .range-active::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; background: #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
        .range-active { height: 6px !important; pointer-events: auto; }
        
        /* 🟢 THE CSS NUKE: Permanently blindfold all native and fluid player controls */
        .fluid_controls_container { display: none !important; } /* Destroys Fluid Player's progress bar */
        .fluid_controls_bottom { display: none !important; }
        .fluid_state_button { display: none !important; } 
        
        /* Safari & Chrome native control shadow-DOM destruction */
        video::-webkit-media-controls { display: none !important; }
        video::-webkit-media-controls-enclosure { display: none !important; }
        video::-webkit-media-controls-panel { display: none !important; }
        
        .fluid_video_wrapper.fluid_ad_playing { z-index: 5 !important; }
      `}</style>
    </div>
  );
}

// 🖌 STYLES
const overlayStyle = { position: "fixed", inset: 0, height: "100dvh", backgroundColor: "#000", zIndex: 999999, display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "none" };
const stageStyle = { display: "flex", width: "100%", height: "100%", background: "#000", position: "relative" };
const videoWrapperStyle = { flex: 1, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", WebkitTapHighlightColor: "transparent" };
const loaderContainerStyle = { position: "absolute", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" };
const topGradientStyle = { position: "absolute", top: 0, left: 0, right: 0, height: "120px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)", zIndex: 10005, transition: "opacity 0.4s ease" };
const bottomGradientStyle = { position: "absolute", bottom: 0, left: 0, right: 0, height: "140px", background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)", zIndex: 10001, transition: "opacity 0.4s ease", pointerEvents: "none" };
const progressWrapperStyle = { position: "absolute", left: 0, right: 0, zIndex: 10002, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" };
const rangeInputBaseStyle = { width: "100%", cursor: "pointer", accentColor: "var(--primary-color)", background: "rgba(255,255,255,0.2)", appearance: "none", outline: "none" };
const mobileBackButtonStyle = { position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: "20px", background: "rgba(0,0,0,0.3)", color: "#fff", border: "none", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" };
const desktopCloseButtonStyle = { position: "absolute", top: "30px", right: "30px", background: "rgba(0,0,0,0.3)", color: "#fff", border: "none", borderRadius: "50%", width: "48px", height: "48px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" };
const centerControlStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "transparent", border: "none", cursor: "pointer", zIndex: 10005, transition: "opacity 0.3s ease", display: "flex", alignItems: "center", justifyContent: "center" };
const centerIconCircleStyle = { background: "rgba(0,0,0,0.4)", borderRadius: "50%", padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" };
const actionButtonsContainerStyle = { position: "absolute", right: "15px", bottom: "80px", display: "flex", flexDirection: "column", gap: "20px", zIndex: 10005, transition: "opacity 0.4s ease", alignItems: "center" };
const actionButtonStyle = { background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: 0 };
const sideIconCircleStyle = { background: "rgba(0,0,0,0.5)", width: "45px", height: "45px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" };
const actionLabelStyle = { fontSize: "11px", fontWeight: "600", textShadow: "0px 1px 3px rgba(0,0,0,0.8)" };