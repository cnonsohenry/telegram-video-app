import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Loader2, Check, X, AlertCircle, Sparkles } from "lucide-react";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";
// 🟢 IMPORT LegalFooter
import LegalFooter from "./LegalFooter";

const CREATOR_CATEGORIES = [
  "Model & Glamour",
  "Lifestyle & Vlogs",
  "Baddies & Dance",
  "VIP Exclusive",
  "Fitness & Wellness",
  "Cosplay & Fantasy"
];

const PRICE_PRESETS = [
  { label: "Free", value: 0 },
  { label: "₦5,000 / month", value: 5000 },
  { label: "₦10,000 / month", value: 10000 },
  { label: "₦20,000 / month", value: 20000 },
  { label: "₦50,000 / month", value: 50000 },
];

const FloatingSelect = ({ label, value, onChange, options, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <label style={{
        position: "absolute",
        left: "20px",
        top: "9px",
        fontSize: "11px",
        color: isFocused ? "#ccc" : "#8e8e93",
        fontWeight: "700",
        pointerEvents: "none",
        zIndex: 2
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: "100%",
          background: "var(--bg-color)",
          border: `1.5px solid ${isFocused ? "#777" : "#333"}`,
          borderRadius: "30px",
          padding: "22px 40px 8px 20px",
          color: "#fff",
          fontSize: "15px",
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
          cursor: "pointer",
          boxSizing: "border-box",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: isFocused ? `0 0 0 3px rgba(255, 255, 255, 0.08)` : "none"
        }}
        {...props}
      >
        {options.map(opt => {
          const val = typeof opt === "object" ? opt.value : opt;
          const lab = typeof opt === "object" ? opt.label : opt;
          return <option key={val} value={val} style={{ background: "#16181c", color: "#fff" }}>{lab}</option>;
        })}
      </select>
      <div style={{ position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#8e8e93", fontSize: "11px" }}>▼</div>
    </div>
  );
};

const FloatingInput = ({ label, type = "text", value, onChange, rightIcon, statusColor, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const active = isFocused || (value && String(value).length > 0);

  let borderColor = "#333";
  if (statusColor) borderColor = statusColor;
  else if (isFocused) borderColor = "#777"; 

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <label style={{
        position: "absolute",
        left: "20px",
        top: active ? "10px" : "50%",
        transform: active ? "none" : "translateY(-50%)",
        fontSize: active ? "11px" : "15px",
        color: active ? (isFocused ? "#ccc" : "#8e8e93") : "#8e8e93",
        fontWeight: active ? "700" : "400",
        pointerEvents: "none", 
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" 
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
          padding: "22px 45px 8px 20px", 
          color: "#fff",
          fontSize: "15px",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: isFocused && !statusColor ? `0 0 0 3px rgba(255, 255, 255, 0.08)` : "none"
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

export default function AuthForm({ onLoginSuccess, onClose }) {
  // Mode: "member" vs "creator"
  const [authTab, setAuthTab] = useState("member");
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [formData, setFormData] = useState({ 
    email: "", 
    password: "", 
    username: "",
    display_name: "",
    creator_category: "Model & Glamour",
    creator_bio: "",
    subscription_price: 10000
  });

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

      const container = document.getElementById("googleSignInDiv");
      if (container) {
        google.accounts.id.renderButton(
          container,
          { theme: "outline", size: "large", shape: "pill", width: "310" }
        );
      }
    };

    const timer = setTimeout(initGoogle, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [authTab, isRegistering]);

  const handleGoogleResponse = async (response) => {
    if (isSucceeded.current) return;
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/google`, {
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

    const isCreatingAccount = authTab === "creator" || isRegistering;

    if (isCreatingAccount && usernameStatus === "taken") {
      setError("Please choose an available username.");
      return;
    }

    setIsLoading(true);
    setError("");

    const endpoint = isCreatingAccount ? "/api/auth/register" : "/api/auth/login";
    
    const payload = isCreatingAccount ? {
      email: formData.email.trim(),
      password: formData.password,
      username: formData.username.trim(),
      is_creator: authTab === "creator",
      display_name: authTab === "creator" ? (formData.display_name.trim() || formData.username.trim()) : undefined,
      creator_category: authTab === "creator" ? formData.creator_category : undefined,
      creator_bio: authTab === "creator" ? formData.creator_bio.trim() : undefined,
      subscription_price: authTab === "creator" ? Number(formData.subscription_price) || 0 : undefined
    } : {
      email: formData.email.trim(),
      password: formData.password
    };

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    setFormData(prev => ({ ...prev, username: sanitizedValue }));

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
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/check-username?username=${sanitizedValue}`);
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

  const isCreating = authTab === "creator" || isRegistering;
  const isSubmitDisabled = isLoading || 
    (isCreating && (formData.username.length < 3 || usernameStatus === "checking" || usernameStatus === "taken")) || 
    !formData.email || 
    formData.password.length < 6;

  return (
    <div style={loginContainerStyle}>
      
      {/* Top Bar with Close Button */}
      <div style={topBarStyle}>
        <button onClick={onClose} style={closeButtonStyle}>
          <X size={24} color="#fff" />
        </button>
      </div>

      <div style={contentWrapper}>
        <div style={innerContainer}>
          <h1 style={logoStyle}>
            {APP_CONFIG.appNamePrefix}
            <span style={{ color: "var(--primary-color)" }}>{APP_CONFIG.appNameSuffix}</span>
          </h1>

          {/* TAB SWITCHER: MEMBER VS CREATOR */}
          <div style={tabSwitcherContainer}>
            <button 
              type="button"
              onClick={() => { setAuthTab("member"); setError(""); }}
              style={{
                ...tabSwitcherButton,
                backgroundColor: authTab === "member" ? "#222" : "transparent",
                color: authTab === "member" ? "#fff" : "#8e8e93",
                fontWeight: authTab === "member" ? "700" : "500"
              }}
            >
              Fan / Member
            </button>
            <button 
              type="button"
              onClick={() => { 
                setAuthTab("creator"); 
                setIsRegistering(true); 
                setError(""); 
              }}
              style={{
                ...tabSwitcherButton,
                backgroundColor: authTab === "creator" ? "#222" : "transparent",
                color: authTab === "creator" ? "#fff" : "#8e8e93",
                fontWeight: authTab === "creator" ? "700" : "500",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <Sparkles size={14} color={authTab === "creator" ? "var(--primary-color)" : "#8e8e93"} />
              <span>Join as Creator</span>
            </button>
          </div>
          
          <div style={errorContainerStyle}>
            {error && (
              <div style={errorBannerStyle}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={formStyle}>
            
            {/* CREATOR ONLY: Stage / Display Name */}
            {authTab === "creator" && (
              <FloatingInput 
                label="Creator Display / Stage Name (e.g. Sophia Diamond)"
                value={formData.display_name}
                onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                required
              />
            )}

            {/* Username / Handle */}
            {(authTab === "creator" || isRegistering) && (
              <FloatingInput 
                label="Username / Handle (e.g. sophiadiamond)"
                value={formData.username}
                onChange={handleUsernameChange}
                minLength={3}
                maxLength={30}
                required
                statusColor={usernameStatus === "taken" ? "#ff3b30" : usernameStatus === "available" ? "#34C759" : null}
                rightIcon={
                  <>
                    {usernameStatus === "checking" && <Loader2 size={16} color="#666" style={{ animation: "spin 1s linear infinite" }} />}
                    {usernameStatus === "available" && <Check size={18} color="#34C759" />}
                    {usernameStatus === "taken" && <X size={18} color="#ff3b30" />}
                  </>
                }
              />
            )}

            {/* CREATOR ONLY: Category Selection */}
            {authTab === "creator" && (
              <FloatingSelect 
                label="Creator Category / Niche"
                value={formData.creator_category}
                onChange={e => setFormData({ ...formData, creator_category: e.target.value })}
                options={CREATOR_CATEGORIES}
              />
            )}

            {/* CREATOR ONLY: Subscription Fee Preset */}
            {authTab === "creator" && (
              <FloatingSelect 
                label="Monthly Fan Subscription Fee"
                value={formData.subscription_price}
                onChange={e => setFormData({ ...formData, subscription_price: Number(e.target.value) })}
                options={PRICE_PRESETS}
              />
            )}
            
            {/* Email Address */}
            <FloatingInput 
              label="Email address"
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
            />
            
            {/* Password */}
            <FloatingInput 
              label="Password (min 6 chars)"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              required
              rightIcon={
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeButtonStyle}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            {/* CREATOR ONLY: Short Bio */}
            {authTab === "creator" && (
              <FloatingInput 
                label="Creator Bio (optional)"
                value={formData.creator_bio}
                onChange={e => setFormData({ ...formData, creator_bio: e.target.value })}
                maxLength={300}
              />
            )}
            
            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={isSubmitDisabled} 
              style={{
                ...loginButtonStyle,
                background: "var(--primary-color)",
                opacity: isSubmitDisabled ? 0.5 : 1 
              }}
            >
              {isLoading ? "Please wait..." : (
                authTab === "creator" 
                  ? "Sign up as Creator" 
                  : (isRegistering ? "Sign up" : "Log in")
              )}
            </button>
          </form>

          {/* Social Divider & Google Sign-in */}
          {authTab === "member" && (
            <>
              <div style={dividerContainer}>
                <div style={line} />
                <span style={orText}>OR</span>
                <div style={line} />
              </div>
              
              <div id="googleSignInDiv" style={{ width: "100%", display: "flex", justifyContent: "center", minHeight: "45px", marginBottom: "20px" }}></div>
            </>
          )}
          
          {/* Member Toggle */}
          {authTab === "member" && (
            <p style={{ fontSize: "14px", color: "#8e8e93", margin: "10px 0 0 0", textAlign: "center" }}>
              {isRegistering ? "Have an account? " : "Don't have an account? "}
              <span 
                onClick={() => { 
                  setIsRegistering(!isRegistering); 
                  setError(""); 
                  setUsernameStatus(null); 
                  setFormData({ ...formData, email: "", password: "", username: "" }); 
                }} 
                style={{ color: "var(--primary-color)", fontWeight: "700", cursor: "pointer" }}
              >
                {isRegistering ? "Log in" : "Sign up"}
              </span>
            </p>
          )}

          {/* Bottom Callouts: Switch to Creator or Member */}
          {authTab === "member" && !isRegistering && (
            <div style={creatorPromptBox}>
              <span style={{ fontSize: "13px", color: "#a0a0a0" }}>Want to earn from your content?</span>
              <button 
                type="button"
                onClick={() => {
                  setAuthTab("creator");
                  setIsRegistering(true);
                  setError("");
                }}
                style={creatorPromptLink}
              >
                Sign up as a Creator →
              </button>
            </div>
          )}

          {authTab === "creator" && (
            <p style={{ fontSize: "14px", color: "#8e8e93", margin: "16px 0 0 0", textAlign: "center" }}>
              Already registered as a creator?{" "}
              <span 
                onClick={() => { 
                  setAuthTab("member"); 
                  setIsRegistering(false); 
                  setError(""); 
                }} 
                style={{ color: "var(--primary-color)", fontWeight: "700", cursor: "pointer" }}
              >
                Log in here
              </span>
            </p>
          )}
        </div>

        {/* LegalFooter inside a wrapper at the bottom */}
        <div style={footerWrapperStyle}>
          <LegalFooter />
        </div>
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

// 🖌 STYLES
const loginContainerStyle = { height: "100dvh", background: "var(--bg-color)", display: "flex", flexDirection: "column", overflow: "hidden", position: "fixed", width: "100%", zIndex: 100000, top: 0, left: 0 };
const topBarStyle = { width: "100%", height: "60px", display: "flex", alignItems: "center", padding: "0 20px", position: "absolute", top: "env(safe-area-inset-top)", left: 0, zIndex: 10 };
const closeButtonStyle = { background: "rgba(255,255,255,0.1)", border: "none", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

const errorContainerStyle = { minHeight: "44px", width: "100%", display: "flex", alignItems: "center", marginBottom: "8px" };
const errorBannerStyle = { background: "rgba(255, 59, 48, 0.1)", color: "#ff3b30", padding: "10px 14px", borderRadius: "12px", fontSize: "13px", fontWeight: "500", display: "flex", alignItems: "center", gap: "8px", width: "100%", border: "1px solid rgba(255, 59, 48, 0.2)", animation: "shake 0.3s ease-in-out" };
const contentWrapper = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", overflowY: "auto", paddingTop: "50px" };
const innerContainer = { width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 20px", marginTop: "auto" };
const footerWrapperStyle = { width: "100%", marginTop: "auto" };
const logoStyle = { fontSize: "20px", marginBottom: "16px", color: "#fff", fontWeight: "900", letterSpacing: "-1px" };

const tabSwitcherContainer = {
  display: "flex",
  width: "100%",
  backgroundColor: "#16181c",
  padding: "4px",
  borderRadius: "30px",
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: "16px"
};

const tabSwitcherButton = {
  flex: 1,
  padding: "9px 0",
  borderRadius: "26px",
  border: "none",
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.2s ease"
};

const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: "10px" }; 
const loginButtonStyle = { color: "#fff", border: "none", borderRadius: "30px", padding: "16px", fontSize: "15px", fontWeight: "800", marginTop: "8px", cursor: "pointer", transition: "opacity 0.2s" };
const eyeButtonStyle = { background: "none", border: "none", color: "#666", display: "flex", cursor: "pointer", padding: "5px" };
const dividerContainer = { width: "100%", display: "flex", alignItems: "center", margin: "16px 0 14px 0", gap: "15px" };
const line = { flex: 1, height: "1px", background: "#262626" };
const orText = { color: "#8e8e8e", fontSize: "13px", fontWeight: "600" };

const creatorPromptBox = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  marginTop: "20px",
  padding: "10px 14px",
  borderRadius: "20px",
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  width: "100%",
  boxSizing: "border-box"
};

const creatorPromptLink = {
  background: "none",
  border: "none",
  color: "var(--primary-color)",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  padding: 0
};
