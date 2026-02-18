import React, { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";

export default function PitchView({ onComplete }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // 🟢 SWIPE REFS
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const minSwipeDistance = 50;

  const slides = [
    { title: "CATCH THE SHOTS", description: "Sneak peeks of your favorite creators before the main drop.", image: "/assets/slide4.jpg" },
    { title: "PREMIUM ACCESS", description: "Unlock exclusive full-length videos and 4K content.", image: "/assets/slide2.jpg" },
    { title: "JOIN THE HUB", description: "Connect with the biggest hub for homegrown talent.", image: "/assets/slide3.jpg" }
  ];

  // 🟢 CSS ANIMATION INJECTION
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.03); }
        100% { transform: scale(1); }
      }
      .pulse-animation { animation: pulse 2s infinite ease-in-out; }
    `;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1);
    else onComplete();
  };

  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  };

  // 🟢 SWIPE HANDLERS
  const onTouchStart = (e) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > minSwipeDistance) nextSlide();
    else if (distance < -minSwipeDistance) prevSlide();
  };

  return (
    <div style={pitchContainerStyle}>
      {/* Skip button with iPhone Notch protection */}
      <button onClick={onComplete} style={skipButton}>Skip</button>
      
      <div 
        style={{...sliderWrapper, transform: `translateX(-${currentSlide * 100}%)`}}
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd}
      >
        {slides.map((s, i) => (
          <div key={i} style={{...slideUnit, backgroundImage: `url(${s.image})`}}>
            <div style={slideOverlay}>
               {/* 🟢 The key={currentSlide} ensures the animation restarts on every swipe */}
               <div style={textFadeIn} key={currentSlide}>
                  <h2 style={pitchTitle}>{s.title}</h2>
                  <p style={pitchDesc}>{s.description}</p>
               </div>
            </div>
          </div>
        ))}
      </div>

      <div style={pitchFooter}>
        <div style={dotsContainer}>
          {slides.map((_, i) => (
            <div key={i} style={{...dot, background: currentSlide === i ? "#ff3b30" : "rgba(255,255,255,0.3)"}} />
          ))}
        </div>
        <button onClick={nextSlide} style={nextButtonStyle} className="pulse-animation">
          {currentSlide === slides.length - 1 ? "Get Started" : "Next"} <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

// 🖌 STYLES
const pitchContainerStyle = { height: "100dvh", background: "#000", position: "fixed", inset: 0, zIndex: 20000, overflow: "hidden", touchAction: "none" };
const sliderWrapper = { display: "flex", width: "100%", height: "100%", transition: "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)", willChange: "transform" };
const slideUnit = { minWidth: "100%", height: "100%", backgroundSize: "cover", backgroundPosition: "center", position: "relative" };
const slideOverlay = { position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.95) 90%)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "40px 30px 200px 30px" };
const skipButton = { position: "absolute", top: "max(50px, env(safe-area-inset-top))", right: "20px", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "700", zIndex: 20001, backdropFilter: "blur(10px)" };
const textFadeIn = { animation: "fadeInUp 0.8s ease-out forwards" };
const pitchTitle = { fontSize: "32px", fontWeight: "900", color: "#fff", marginBottom: "12px", letterSpacing: "-1px" };
const pitchDesc = { fontSize: "16px", color: "rgba(255,255,255,0.8)", lineHeight: "1.5", maxWidth: "300px" };

// 🟢 Footer sits high enough to clear the app's hidden nav
const pitchFooter = { 
  position: "absolute", 
  bottom: 0, 
  width: "100%", 
  padding: "40px 20px calc(60px + env(safe-area-inset-bottom)) 20px", 
  display: "flex", 
  flexDirection: "column", 
  alignItems: "center", 
  gap: "30px", 
  zIndex: 20002 
};

const dotsContainer = { display: "flex", gap: "10px" };
const dot = { width: "24px", height: "3px", borderRadius: "2px", transition: "all 0.4s ease" };
const nextButtonStyle = { width: "100%", maxWidth: "320px", background: "#fff", color: "#000", border: "none", borderRadius: "30px", padding: "18px", fontSize: "16px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" };