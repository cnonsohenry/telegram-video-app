import React, { useState, useEffect } from "react";
import { User, Mail, Lock, LogOut, Settings, Video } from "lucide-react";
import VideoCard from "../components/VideoCard";

export default function Profile({ onOpenVideo }) {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login"); // 'login', 'register', 'dashboard'
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [error, setError] = useState("");

  // 1. Check for logged-in user on load
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) fetchProfile(token);
  }, []);

  const fetchProfile = async (token) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setView("dashboard");
      } else {
        localStorage.removeItem("auth_token"); // Token expired
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const endpoint = view === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Something went wrong");

      // Success!
      localStorage.setItem("auth_token", data.token);
      setUser(data.user);
      setView("dashboard");

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setView("login");
  };

  // 🟢 1. DASHBOARD VIEW (Logged In)
  if (user && view === "dashboard") {
    return (
      <div style={{ padding: "20px 16px 100px", color: "#fff", minHeight: "100vh" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "#333", overflow: "hidden" }}>
               <img src={user.avatar_url} style={{ width: "100%", height: "100%" }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "20px" }}>{user.username}</h2>
              <p style={{ margin: 0, color: "#888", fontSize: "12px" }}>{user.email}</p>
            </div>
          </div>
          <Settings size={24} color="#888" />
        </div>

        {/* Action Buttons */}
        <div style={{ display: "grid", gap: "10px", marginBottom: "30px" }}>
          <button style={{ 
            background: "#1c1c1e", border: "none", color: "#fff", padding: "16px", 
            borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px", fontSize: "16px"
          }}>
            <Video size={20} color="#ff3b30" /> My Videos
          </button>
          
          <button onClick={handleLogout} style={{ 
            background: "#1c1c1e", border: "none", color: "#ff3b30", padding: "16px", 
            borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px", fontSize: "16px"
          }}>
            <LogOut size={20} /> Log Out
          </button>
        </div>
      </div>
    );
  }

  // 🟢 2. AUTH FORMS (Login / Register)
  return (
    <div style={{ 
      display: "flex", flexDirection: "column", justifyContent: "center", 
      padding: "40px 24px", minHeight: "80vh", color: "#fff" 
    }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "900", marginBottom: "8px" }}>
          NAIJA<span style={{ color: "#ff3b30" }}>HOMEMADE</span>
        </h1>
        <p style={{ color: "#888" }}>Welcome to the community</p>
      </div>

      <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {view === "register" && (
          <div style={inputContainerStyle}>
            <User size={20} color="#888" />
            <input 
              placeholder="Username" 
              required
              style={inputStyle}
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
            />
          </div>
        )}

        <div style={inputContainerStyle}>
          <Mail size={20} color="#888" />
          <input 
            type="email" 
            placeholder="Email Address" 
            required
            style={inputStyle}
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
        </div>

        <div style={inputContainerStyle}>
          <Lock size={20} color="#888" />
          <input 
            type="password" 
            placeholder="Password" 
            required
            style={inputStyle}
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
        </div>

        {error && <p style={{ color: "#ff3b30", fontSize: "14px", textAlign: "center" }}>{error}</p>}

        <button type="submit" disabled={isLoading} style={{
          background: "#ff3b30", color: "#fff", border: "none", padding: "16px", 
          borderRadius: "12px", fontSize: "16px", fontWeight: "bold", marginTop: "10px",
          opacity: isLoading ? 0.7 : 1
        }}>
          {isLoading ? "Please wait..." : (view === "login" ? "Log In" : "Create Account")}
        </button>
      </form>

      {/* Social Login Placeholders */}
      <div style={{ marginTop: "30px", textAlign: "center" }}>
        <p style={{ color: "#555", fontSize: "12px", marginBottom: "15px" }}>OR CONTINUE WITH</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <SocialButton label="Google" />
          <SocialButton label="Apple" />
        </div>
      </div>

      <p style={{ textAlign: "center", marginTop: "30px", color: "#888", fontSize: "14px" }}>
        {view === "login" ? "New here? " : "Already have an account? "}
        <span 
          onClick={() => setView(view === "login" ? "register" : "login")}
          style={{ color: "#fff", fontWeight: "bold", cursor: "pointer" }}
        >
          {view === "login" ? "Sign Up" : "Log In"}
        </span>
      </p>
    </div>
  );
}

// Sub-components for styling
const inputContainerStyle = {
  background: "#1c1c1e", borderRadius: "12px", padding: "12px 16px", 
  display: "flex", alignItems: "center", gap: "12px"
};

const inputStyle = {
  background: "transparent", border: "none", color: "#fff", fontSize: "16px", 
  outline: "none", width: "100%"
};

const SocialButton = ({ label }) => (
  <button style={{
    background: "#fff", color: "#000", border: "none", padding: "10px 20px", 
    borderRadius: "8px", fontWeight: "600", fontSize: "14px", flex: 1
  }}>
    {label}
  </button>
);