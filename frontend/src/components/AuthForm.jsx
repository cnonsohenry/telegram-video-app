import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Loader2, Check, X, AlertCircle } from "lucide-react";

// 🟢 NEW: The highly interactive Floating Label Input Component
const FloatingInput = ({ label, type = "text", value, onChange, rightIcon, statusColor, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  
  // The label is "active" if the user is typing OR if there is already text inside
  const active = isFocused || value.length > 0;

  // Determine the border color based on focus or error states
  let borderColor = "#333";
  if (statusColor) borderColor = statusColor;
  else if (isFocused) borderColor = "var(--primary-color)";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <label style={{
        position: "absolute",
        left: "20px",
        top: active ? "10px" : "50%",
        transform: active ? "none" : "translateY(-50%)",
        fontSize: active ? "11px" : "15px",
        color: active ? (isFocused ? "var(--primary-color)" : "#8e8e93") : "#8e8e93",
        fontWeight: active ? "700" : "400",
        pointerEvents: "none", // Ensures clicks pass right through to the input
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" // Buttery smooth animation
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: "100%",
          background: "var(--bg-color)",
          border: `1.5px solid ${borderColor}`,
          borderRadius: "30px",
          padding: "22px 45px 8px 20px", // Bottom padding is smaller to make room for the top label
          color: "#fff",
          fontSize: "15px",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s, box-shadow 0.2s",
          // Adds a subtle outer glow when focused
          boxShadow: isFocused && !statusColor ? `0 0 0 3px rgba(255, 59, 48, 0.15)` : "none"
        }}
        {...props}
      />
      {rightIcon && (
        <div style={{ position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", zIndex: 2 }}>
          {rightIcon}
        </div>
      )}
    </div>
  );
};

export default function AuthForm({ onLoginSuccess }) {

  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
      if (error === "This username is already taken.") setError("");
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
          setError(""); 
        } else {
          setUsernameStatus("taken");
          setError("This username is already taken."); 
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
              <FloatingInput 
                label="Username (e.g. john_doe)"
                value={formData.username}
                onChange={handleUsernameChange}
                minLength={3}
                maxLength={30}
                required
                statusColor={usernameStatus === 'taken' ? '#ff3b30' : usernameStatus === 'available' ? '#34C759' : null}
                rightIcon={
                  <>
                    {usernameStatus === 'checking' && <Loader2 size={16} color="#666" style={{ animation: "spin 1s linear infinite" }} />}
                    {usernameStatus === 'available' && <Check size={18} color="#34C759" />}
                    {usernameStatus === 'taken' && <X size={18} color="#ff3b30" />}
                  </>
                }
              />
            )}
            
            <FloatingInput 
              label="Email address"
              type="email"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              required
            />
            
            <FloatingInput 
              label="Password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              required
              rightIcon={
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeButtonStyle}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
            
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

const errorContainerStyle = { minHeight: "48px", width: "100%", display: "flex", alignItems: "center", marginBottom: "10px" };
const errorBannerStyle = { background: "rgba(255, 59, 48, 0.1)", color: "#ff3b30", padding: "10px 14px", borderRadius: "12px", fontSize: "13px", fontWeight: "500", display: "flex", alignItems: "center", gap: "8px", width: "100%", border: "1px solid rgba(255, 59, 48, 0.2)", animation: "shake 0.3s ease-in-out" };
const loginContainerStyle = { height: "100dvh", background: "var(--bg-color)", display: "flex", flexDirection: "column", overflow: "hidden", position: "fixed", width: "100%", zIndex: 100, top: 0, left: 0 };
const contentWrapper = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" };
const innerContainer = { width: "100%", maxWidth: "350px", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px" };
const logoStyle = { fontSize: "18px", marginBottom: "15px", color: "#fff", fontWeight: "900", letterSpacing: "-1px", };
const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: "12px" }; // 🟢 Increased gap slightly to accommodate the floating layout
const loginButtonStyle = { background: "var(--primary-color)", color: "#fff", border: "none", borderRadius: "30px", padding: "16px", fontSize: "15px", fontWeight: "800", marginTop: "10px", cursor: "pointer", transition: "opacity 0.2s" };
const eyeButtonStyle = { background: "none", border: "none", color: "#666", display: "flex", cursor: "pointer", padding: "5px" };
const dividerContainer = { width: "100%", display: "flex", alignItems: "center", margin: "20px 0", gap: "15px" };
const line = { flex: 1, height: "1px", background: "#262626" };
const orText = { color: "#8e8e8e", fontSize: "13px", fontWeight: "600" };
const footerBox = { width: "100%", textAlign: "center", paddingBottom: "80px", background: "var(--bg-color)" };