import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function AuthForm({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 🟢 1. Kill-switch to prevent "Double Attempt" bugs
  const isSucceeded = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const initGoogle = () => {
      // Don't re-init if we already won or unmounted
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
      
      // 🟢 2. LOCK logic immediately
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

      // 🟢 2. LOCK logic immediately
      isSucceeded.current = true;
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      if (!isSucceeded.current) setError(err.message);
    } finally {
      if (!isSucceeded.current) setIsLoading(false);
    }
  };

  return (
    <div style={loginContainerStyle}>
      <div style={contentWrapper}>
        <div style={innerContainer}>
          <h1 style={logoStyle}>NAIJA<span style={{ color: "#ff3b30" }}>HOMEMADE</span></h1>
          
          {error && <div style={errorBannerStyle}>{error}</div>}

          <form onSubmit={handleSubmit} style={formStyle}>
            {isRegistering && (
              <input 
                placeholder="Username" 
                style={roundedInputStyle} 
                value={formData.username} 
                onChange={e => setFormData({...formData, username: e.target.value})} 
                required 
              />
            )}
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
              disabled={isLoading} 
              style={{...loginButtonStyle, opacity: (formData.email && formData.password.length >= 6) ? 1 : 0.5 }}
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
          <span onClick={() => { setIsRegistering(!isRegistering); setError(""); }} style={{ color: "#ff3b30", fontWeight: "700", cursor: "pointer" }}>
            {isRegistering ? "Log in" : "Sign up"}
          </span>
        </p>
      </div>
    </div>
  );
}

const errorBannerStyle = { background: "rgba(255, 59, 48, 0.1)", color: "#ff3b30", padding: "10px", borderRadius: "8px", marginBottom: "15px", fontSize: "13px", textAlign: "center", width: "100%", border: "1px solid rgba(255, 59, 48, 0.2)" };
const loginContainerStyle = { height: "100dvh", background: "#000", display: "flex", flexDirection: "column", overflow: "hidden", position: "fixed", width: "100%", zIndex: 100, top: 0, left: 0 };
const contentWrapper = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" };
const innerContainer = { width: "100%", maxWidth: "350px", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" };
const logoStyle = { fontFamily: '"Billabong", cursive', fontSize: "18px", marginBottom: "30px", color: "#fff", fontWeight: "900", letterSpacing: "-1px", };
const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: "10px" };
const roundedInputStyle = { width: "100%", background: "#000000", border: "1px solid #333", borderRadius: "30px", padding: "12px 20px", color: "#fff", fontSize: "15px", outline: "none" };
const loginButtonStyle = { background: "#ff3b30", color: "#fff", border: "none", borderRadius: "30px", padding: "14px", fontSize: "15px", fontWeight: "700", marginTop: "10px", cursor: "pointer" };
const eyeButtonStyle = { position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#666", display: "flex", cursor: "pointer" };
const dividerContainer = { width: "100%", display: "flex", alignItems: "center", margin: "20px 0", gap: "15px" };
const line = { flex: 1, height: "1px", background: "#262626" };
const orText = { color: "#8e8e8e", fontSize: "13px", fontWeight: "600" };
const footerBox = { width: "100%", textAlign: "center", paddingBottom: "80px", background: "#000" };