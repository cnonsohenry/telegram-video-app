import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Loader2, Check, X, AlertCircle } from "lucide-react"; // 🟢 Added AlertCircle

export default function AuthForm({ onLoginSuccess }) {

  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // 🟢 Unified Global Error State
  const [error, setError] = useState("");

  const [usernameStatus, setUsernameStatus] = useState(null); 
  const debounceTimerRef = useRef(null);
  const isSucceeded = useRef(false);

  useEffect(() => {
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

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

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
    } catch (err) {
      if (!isSucceeded.current) setError(err.message);
    } finally {
      if (!isSucceeded.current) setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSucceeded.current) return;

    if (isRegistering && usernameStatus === 'taken') {
      setError("Please choose an available username.");
      return;
    }

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
    } catch (err) {
      if (!isSucceeded.current) setError(err.message);
    } finally {
      if (!isSucceeded.current) setIsLoading(false);
    }
  };

  const handleUsernameChange = (e) => {
    const rawValue = e.target.value;
    const sanitizedValue = rawValue.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase(); 
    setFormData({ ...formData, username: sanitizedValue });

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (sanitizedValue.length < 3) {
      setUsernameStatus(null);
      if (error === "This username is already taken.") setError(""); // Clear error if they backspace
      return;
    }

    setUsernameStatus("checking");
    if (error === "This username is already taken.") setError(""); 

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/check-username?username=${sanitizedValue}`);
        const data = await res.json();
        
        if (data.available) {
          setUsernameStatus("available");
          setError(""); // Clear any previous username errors
        } else {
          setUsernameStatus("taken");
          setError("This username is already taken."); // 🟢 Route error to the top banner
        }
      } catch (err) {
        setUsernameStatus(null); 
      }
    }, 500);
  };

  const isSubmitDisabled = isLoading || (isRegistering && (formData.username.length < 3 || usernameStatus === 'checking' || usernameStatus === 'taken')) || !formData.email || formData.password.length < 6;

  return (
    <div style={loginContainerStyle}>
      <div style={contentWrapper}>
        <div style={innerContainer}>
          <h1 style={logoStyle}>NAIJA<span style={{ color: "var(--primary-color)" }}>HOMEMADE</span></h1>
          
          {/* 🟢 THE FIX: Fixed-height error container to prevent layout jumping */}
          <div style={errorContainerStyle}>
            {error && (
              <div style={errorBannerStyle}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={formStyle}>
            {isRegistering && (
              <div style={{ position: "relative", width: "100%" }}>
                <input 
                  placeholder="Username (e.g. john_doe)" 
                  style={{
                    ...roundedInputStyle,
                    borderColor: usernameStatus === 'taken' ? '#ff3b30' : usernameStatus === 'available' ? '#34C759' : '#333'
                  }} 
                  value={formData.username} 
                  onChange={handleUsernameChange} 
                  minLength={3}
                  maxLength={30}
                  required 
                />
                
                <div style={inputIconStyle}>
                  {usernameStatus === 'checking' && <Loader2 size={16} color="#666" style={{ animation: "spin 1s linear infinite" }} />}
                  {usernameStatus === 'available' && <Check size={18} color="#34C759" />}
                  {usernameStatus === 'taken' && <X size={18} color="#ff3b30" />}
                </div>
              </div>
            )}
            
            {/* Inline warning text removed completely! */}

            <input 
              type="email" 
              placeholder="Email address" 
              style={roundedInputStyle} 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
              required 
            />
            
            <div style={{ position: "relative", width: "100%" }}>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                style={roundedInputStyle} 
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})} 
                required 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeButtonStyle}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <button 
              type="submit" 
              disabled={isSubmitDisabled} 
              style={{...loginButtonStyle, opacity: isSubmitDisabled ? 0.5 : 1 }}
            >
              {isLoading ? "Please wait..." : (isRegistering ? "Sign up" : "Log in")}
            </button>
          </form>

          <div style={dividerContainer}>
            <div style={line} />
            <span style={orText}>OR</span>
            <div style={line} />
          </div>
          
          <div id="googleSignInDiv" style={{ width: "100%", display: "flex", justifyContent: "center", minHeight: "45px" }}></div>
        </div>
      </div>
      
      <div style={footerBox}>
        <div style={{ height: "1px", background: "#262626", width: "100%", marginBottom: "15px" }} />
        <p style={{ fontSize: "14px", color: "#fff", margin: 0 }}>
          {isRegistering ? "Have an account? " : "Don't have an account? "}
          <span onClick={() => { setIsRegistering(!isRegistering); setError(""); setUsernameStatus(null); setFormData({ email: "", password: "", username: "" }); }} style={{ color: "var(--primary-color)", fontWeight: "700", cursor: "pointer" }}>
            {isRegistering ? "Log in" : "Sign up"}
          </span>
        </p>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        /* 🟢 Subtle Native Shake Animation for Errors */
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

// 🟢 NEW: Fixed height container ensures the UI never jumps when an error pops in
const errorContainerStyle = { minHeight: "48px", width: "100%", display: "flex", alignItems: "center", marginBottom: "10px" };

// 🟢 NEW: Native-feeling error banner
const errorBannerStyle = { background: "rgba(255, 59, 48, 0.1)", color: "#ff3b30", padding: "10px 14px", borderRadius: "12px", fontSize: "13px", fontWeight: "500", display: "flex", alignItems: "center", gap: "8px", width: "100%", border: "1px solid rgba(255, 59, 48, 0.2)", animation: "shake 0.3s ease-in-out" };

const loginContainerStyle = { height: "100dvh", background: "var(--bg-color)", display: "flex", flexDirection: "column", overflow: "hidden", position: "fixed", width: "100%", zIndex: 100, top: 0, left: 0 };
const contentWrapper = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" };
const innerContainer = { width: "100%", maxWidth: "350px", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" };
const logoStyle = { fontSize: "18px", marginBottom: "15px", color: "#fff", fontWeight: "900", letterSpacing: "-1px", };
const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: "10px" };
const roundedInputStyle = { width: "100%", background: "var(--bg-color)", border: "1px solid #333", borderRadius: "30px", padding: "12px 20px", color: "#fff", fontSize: "15px", outline: "none", transition: "border-color 0.2s" };
const inputIconStyle = { position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" };
const loginButtonStyle = { background: "var(--primary-color)", color: "#fff", border: "none", borderRadius: "30px", padding: "14px", fontSize: "15px", fontWeight: "700", marginTop: "10px", cursor: "pointer", transition: "opacity 0.2s" };
const eyeButtonStyle = { position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#666", display: "flex", cursor: "pointer" };
const dividerContainer = { width: "100%", display: "flex", alignItems: "center", margin: "20px 0", gap: "15px" };
const line = { flex: 1, height: "1px", background: "#262626" };
const orText = { color: "#8e8e8e", fontSize: "13px", fontWeight: "600" };
const footerBox = { width: "100%", textAlign: "center", paddingBottom: "80px", background: "var(--bg-color)" };