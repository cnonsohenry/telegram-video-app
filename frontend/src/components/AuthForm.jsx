import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, ChevronRight } from "lucide-react";

export default function AuthForm({ onLoginSuccess }) {
  const [showPitch, setShowPitch] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // 🟢 SWIPE REFS
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const minSwipeDistance = 50; 

  const slides = [
    {
      title: "CATCH THE SHOTS",
      description: "Sneak peeks of your favorite creators before the main drop.",
      image: "/assets/slide1.jpg" 
    },
    {
      title: "PREMIUM ACCESS",
      description: "Unlock exclusive full-length videos and 4K content.",
      image: "/assets/slide2.jpg"
    },
    {
      title: "JOIN THE COMMUNITY",
      description: "Connect with the biggest hub for homegrown talent.",
      image: "/assets/slide3.jpg"
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setShowPitch(false);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
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

  // 🟢 ADSTERRA BLOCKER
  useEffect(() => {
    const zapAds = () => {
      const adElements = document.querySelectorAll(
        'iframe[id^="container-"], div[id^="container-"], [id*="effectivegatecpm"], .social-bar-container'
      );
      adElements.forEach(el => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
      });
    };
    zapAds();
    const observer = new MutationObserver(() => zapAds());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const isSucceeded = useRef(false);

  useEffect(() => {
    if (showPitch) return; 
    let isMounted = true;
    const initGoogle = () => {
      if (!window.google || !isMounted || isSucceeded.current) return;
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        use_fedcm_for_prompt: true,
      });
      google.accounts.id.renderButton(
        document.getElementById("googleSignInDiv"),
        { theme: "outline", size: "large", shape: "pill", width: "310" }
      );
    };
    const timer = setTimeout(initGoogle, 500);
    return () => { isMounted = false; clearTimeout(timer); };
  }, [showPitch]);

  const handleGoogleResponse = async (response) => {
    if (isSucceeded.current) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google login failed");
      isSucceeded.current = true;
      onLoginSuccess(data.user, data.token);
    } catch (err) { if (!isSucceeded.current) setError(err.message); }
    finally { if (!isSucceeded.current) setIsLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSucceeded.current) return;
    setIsLoading(true);
    setError("");
    const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      isSucceeded.current = true;
      onLoginSuccess(data.user, data.token);
    } catch (err) { if (!isSucceeded.current) setError(err.message); }
    finally { if (!isSucceeded.current) setIsLoading(false); }
  };

  if (showPitch) {
    return (
      <div style={loginContainerStyle}>
        <button onClick={() => setShowPitch(false)} style={skipButton}>Skip</button>
        
        <div 
          style={{...sliderWrapper, transform: `translateX(-${currentSlide * 100}%)`}}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {slides.map((s, i) => (
            <div key={i} style={{...slideUnit, backgroundImage: `url(${s.image})`}}>
              <div style={slideOverlay}>
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

  return (
    <div style={loginContainerStyle}>
      <div style={contentWrapper}>
        <div style={innerContainer}>
          <h1 style={logoStyle}>NAIJA<span style={{ color: "#ff3b30" }}>HOMEMADE</span></h1>
          {error && <div style={errorBannerStyle}>{error}</div>}
          <form onSubmit={handleSubmit} style={formStyle}>
            {isRegistering && (
              <input placeholder="Username" style={roundedInputStyle} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
            )}
            <input type="email" placeholder="Email address" style={roundedInputStyle} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
            <div style={{ position: "relative", width: "100%" }}>
              <input type={showPassword ? "text" : "password"} placeholder="Password" style={roundedInputStyle} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeButtonStyle}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" disabled={isLoading} style={{...loginButtonStyle, opacity: (formData.email && formData.password.length >= 6) ? 1 : 0.5 }}>
              {isLoading ? "Please wait..." : (isRegistering ? "Sign up" : "Log in")}
            </button>
          </form>
          <div style={dividerContainer}>
            <div style={line} /> <span style={orText}>OR</span> <div style={line} />
          </div>
          <div id="googleSignInDiv" style={{ width: "100%", display: "flex", justifyContent: "center", minHeight: "45px" }}></div>
        </div>
      </div>
      <div style={footerBox}>
        <div style={{ height: "1px", background: "#262626", width: "100%", marginBottom: "15px" }} />
        <p style={{ fontSize: "14px", color: "#fff", margin: 0 }}>
          {isRegistering ? "Have an account? " : "Don't have an account? "}
          <span onClick={() => { setIsRegistering(!isRegistering); setError(""); }} style={{ color: "#ff3b30", fontWeight: "700", cursor: "pointer" }}>
            {isRegistering ? "Log in" : "Sign up"}
          </span>
        </p>
      </div>
    </div>
  );
}

// 🖌 STYLES (Raised zIndex and added Safe Area padding)
const loginContainerStyle = { height: "100dvh", background: "#000", display: "flex", flexDirection: "column", overflow: "hidden", position: "fixed", width: "100%", zIndex: 9999, top: 0, left: 0 };
const sliderWrapper = { display: "flex", width: "100%", height: "100%", transition: "transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)", willChange: "transform" };
const slideUnit = { minWidth: "100%", height: "100%", backgroundSize: "cover", backgroundPosition: "center", position: "relative" };
const slideOverlay = { position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.95) 90%)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "40px 30px 180px 30px" };
const skipButton = { position: "absolute", top: "max(50px, env(safe-area-inset-top))", right: "20px", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "700", zIndex: 10001, backdropFilter: "blur(10px)" };
const textFadeIn = { animation: "fadeInUp 0.6s ease-out forwards" };
const pitchTitle = { fontSize: "32px", fontWeight: "900", color: "#fff", marginBottom: "12px", letterSpacing: "-1px" };
const pitchDesc = { fontSize: "16px", color: "rgba(255,255,255,0.7)", lineHeight: "1.5", maxWidth: "300px" };

// 🟢 Clears the App Footer and adds Safe Area support
const pitchFooter = { 
  position: "absolute", 
  bottom: 0, 
  left: 0, 
  right: 0, 
  padding: "40px 20px calc(40px + env(safe-area-inset-bottom)) 20px", 
  display: "flex", 
  flexDirection: "column", 
  alignItems: "center", 
  gap: "25px", 
  zIndex: 10002,
  background: "linear-gradient(to top, #000 60%, transparent)"
};

const dotsContainer = { display: "flex", gap: "10px" };
const dot = { width: "24px", height: "3px", borderRadius: "2px", transition: "0.3s" };

// 🟢 Pulse class added to classList
const nextButtonStyle = { width: "100%", maxWidth: "320px", background: "#fff", color: "#000", border: "none", borderRadius: "30px", padding: "18px", fontSize: "16px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer", boxShadow: "0 10px 20px rgba(0,0,0,0.4)" };

const contentWrapper = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" };
const innerContainer = { width: "100%", maxWidth: "350px", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" };
const logoStyle = { fontSize: "18px", marginBottom: "30px", color: "#fff", fontWeight: "900", letterSpacing: "-1px" };
const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: "10px" };
const roundedInputStyle = { width: "100%", background: "#111", border: "1px solid #222", borderRadius: "30px", padding: "14px 20px", color: "#fff", fontSize: "15px", outline: "none" };
const loginButtonStyle = { background: "#ff3b30", color: "#fff", border: "none", borderRadius: "30px", padding: "16px", fontSize: "15px", fontWeight: "700", marginTop: "10px", cursor: "pointer" };
const eyeButtonStyle = { position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#666", cursor: "pointer" };
const dividerContainer = { width: "100%", display: "flex", alignItems: "center", margin: "25px 0", gap: "15px" };
const line = { flex: 1, height: "1px", background: "#262626" };
const orText = { color: "#8e8e8e", fontSize: "13px", fontWeight: "600" };
const footerBox = { width: "100%", textAlign: "center", paddingBottom: "calc(40px + env(safe-area-inset-bottom))", background: "#000" };
const errorBannerStyle = { background: "rgba(255, 59, 48, 0.1)", color: "#ff3b30", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "13px", textAlign: "center", width: "100%", border: "1px solid rgba(255, 59, 48, 0.2)" };

/* Global Animations */
if (typeof document !== 'undefined') {
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
    .pulse-animation {
      animation: pulse 2s infinite ease-in-out;
    }
  `;
  document.head.appendChild(styleSheet);
}