// File: src/components/AuthForm.jsx
import React, { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function AuthForm({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 🟢 1. Initialize Google Identity & Render Official Button
  useEffect(() => {
    /* global google */
    if (window.google) {
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        use_fedcm_for_prompt: true, // 🟢 Required for modern browser standards
      });

      // 🟢 2. Render the actual button into our target div
      google.accounts.id.renderButton(
        document.getElementById("googleSignInDiv"),
        { 
          theme: "outline", 
          size: "large", 
          shape: "pill", 
          width: "310", // Matches your form width
          text: "continue_with" 
        }
      );

      // Attempt One Tap for users with active sessions
      google.accounts.id.prompt(); 
    }
  }, []);

  const handleGoogleResponse = async (response) => {
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
      
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={loginContainerStyle}>
      <div style={contentWrapper}>
        <div style={innerContainer}>
          <h1 style={logoStyle}>NaijaHomemade</h1>
          
          {error && <div style={{color: "#ff3b30", marginBottom: "15px", fontSize: "14px", textAlign: "center"}}>{error}</div>}

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
          
          {/* 🟢 3. Target Div for the Official Google Button */}
          <div id="googleSignInDiv" style={{ width: "100%", display: "flex", justifyContent: "center" }}></div>
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

// Styles
const loginContainerStyle = { height: "100dvh", background: "#000", display: "flex", flexDirection: "column", overflow: "hidden", position: "fixed", width: "100%", zIndex: 100, top: 0, left: 0 };
const contentWrapper = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" };
const innerContainer = { width: "100%", maxWidth: "350px", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" };
const logoStyle = { fontFamily: '"Billabong", cursive', fontSize: "40px", marginBottom: "30px", color: "#fff", fontStyle: "italic" };
const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: "10px" };
const roundedInputStyle = { width: "100%", background: "#121212", border: "1px solid #333", borderRadius: "30px", padding: "12px 20px", color: "#fff", fontSize: "15px", outline: "none" };
const loginButtonStyle = { background: "#ff3b30", color: "#fff", border: "none", borderRadius: "30px", padding: "14px", fontSize: "15px", fontWeight: "700", marginTop: "10px", cursor: "pointer" };
const eyeButtonStyle = { position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#666", display: "flex", cursor: "pointer" };
const dividerContainer = { width: "100%", display: "flex", alignItems: "center", margin: "20px 0", gap: "15px" };
const line = { flex: 1, height: "1px", background: "#262626" };
const orText = { color: "#8e8e8e", fontSize: "13px", fontWeight: "600" };
const footerBox = { width: "100%", textAlign: "center", paddingBottom: "80px", background: "#000" };