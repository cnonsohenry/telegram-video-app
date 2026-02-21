import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

export default function PitchView({ onComplete }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const minSwipeDistance = 50;

  const slides = [
    { title: "CATCH THE SHOTS", description: "Sneak peeks of your favorite creators before the main drop.", image: "/assets/slide4.jpg" },
    { title: "PREMIUM ACCESS", description: "Unlock exclusive full-length videos and 4K content.", image: "/assets/slide2.jpg" },
    { title: "JOIN THE HUB", description: "Connect with the biggest hub for homegrown talent.", image: "/assets/slide3.jpg" }
  ];

  const nextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1);
    else onComplete();
  }, [currentSlide, slides.length, onComplete]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  }, [currentSlide]);

  // 🟢 RESPONSIVE & KEYBOARD LISTENERS
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "Escape") onComplete();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [nextSlide, prevSlide, onComplete]);

  // SWIPE HANDLERS (Mobile)
  const onTouchStart = (e) => { touchEndX.current = null; touchStartX.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e) => { touchEndX.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > minSwipeDistance) nextSlide();
    else if (distance < -minSwipeDistance) prevSlide();
  };

  return (
    <div style={pitchContainerStyle}>
      <button onClick={onComplete} style={skipButton}>Skip</button>
      
      {/* 🟢 DESKTOP ARROW NAVIGATION */}
      {isDesktop && (
        <>
          {currentSlide > 0 && (
            <button onClick={prevSlide} style={{...navArrow, left: "40px"}}><ChevronLeft size={40}/></button>
          )}
          <button onClick={nextSlide} style={{...navArrow, right: "40px"}}><ChevronRight size={40}/></button>
        </>
      )}

      <div 
        style={{...sliderWrapper, transform: `translateX(-${currentSlide * 100}%)`}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        {slides.map((s, i) => (
          <div key={i} style={{...slideUnit, backgroundImage: `url(${s.image})`}}>
            <div style={{
              ...slideOverlay,
              justifyContent: isDesktop ? "center" : "flex-end",
              alignItems: isDesktop ? "center" : "flex-start",
              textAlign: isDesktop ? "center" : "left",
              padding: isDesktop ? "0" : "40px 30px 200px 30px"
            }}>
               <div style={{
                 ...textFadeIn, 
                 maxWidth: isDesktop ? "800px" : "300px",
                 backgroundColor: isDesktop ? "rgba(0,0,0,0.4)" : "transparent",
                 padding: isDesktop ? "40px" : "0",
                 borderRadius: isDesktop ? "24px" : "0",
                 backdropFilter: isDesktop ? "blur(20px)" : "none"
               }} key={currentSlide}>
                  <h2 style={{...pitchTitle, fontSize: isDesktop ? "72px" : "32px"}}>{s.title}</h2>
                  <p style={{...pitchDesc, fontSize: isDesktop ? "20px" : "16px", maxWidth: isDesktop ? "600px" : "300px", margin: isDesktop ? "0 auto" : "0"}}>{s.description}</p>
               </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{...pitchFooter, paddingBottom: isDesktop ? "60px" : "calc(60px + env(safe-area-inset-bottom))"}}>
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
const pitchContainerStyle = { height: "100dvh", background: "#000", position: "fixed", inset: 0, zIndex: 20000, overflow: "hidden" };
const sliderWrapper = { display: "flex", width: "100%", height: "100%", transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)", willChange: "transform" };
const slideUnit = { minWidth: "100%", height: "100%", backgroundSize: "cover", backgroundPosition: "center", position: "relative" };
const slideOverlay = { position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.8) 100%)", display: "flex", flexDirection: "column" };
const skipButton = { position: "absolute", top: "max(30px, env(safe-area-inset-top))", right: "20px", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", padding: "10px 20px", borderRadius: "20px", fontSize: "14px", fontWeight: "700", zIndex: 20005, backdropFilter: "blur(10px)", cursor: "pointer" };
const textFadeIn = { animation: "fadeInUp 0.8s ease-out forwards" };
const pitchTitle = { fontWeight: "900", color: "#fff", marginBottom: "16px", letterSpacing: "-2px" };
const pitchDesc = { color: "rgba(255,255,255,0.9)", lineHeight: "1.6" };
const pitchFooter = { position: "absolute", bottom: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "30px", zIndex: 20002 };
const dotsContainer = { display: "flex", gap: "10px" };
const dot = { width: "32px", height: "4px", borderRadius: "2px", transition: "all 0.4s ease" };
const nextButtonStyle = { width: "90%", maxWidth: "320px", background: "#fff", color: "#000", border: "none", borderRadius: "35px", padding: "20px", fontSize: "18px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer" };
const navArrow = { position: "absolute", top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: "50%", width: "70px", height: "70px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 20010, backdropFilter: "blur(10px)", transition: "all 0.3s" };