// File: src/components/Profile.jsx
import React, { useState, useEffect } from "react";
import AuthForm from "../components/AuthForm";
import UserProfile from "../components/UserProfile";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🟢 1. RECOVERY & CLEANUP (Kept here to manage global scroll state)
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      fetchProfile(token);
    } else {
      setIsLoading(false);
    }

    // Scroll Logic: Lock for login, Free for dashboard
    if (user || token) {
      document.body.style.overflow = "auto";
      document.body.style.position = "";
      document.body.style.touchAction = "";
    } else {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    }

    return () => {
      document.body.style.overflow = "auto";
      document.body.style.position = "";
      document.body.style.touchAction = "";
    };
  }, [user]);

  // 🟢 2. ADSTERRA BLOCKER (Global protection for this page)
  useEffect(() => {
    const zapAds = () => {
      const adElements = document.querySelectorAll('iframe[id^="container-"], div[id^="container-"], [id*="effectivegatecpm"], .social-bar-container');
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

  const fetchProfile = async (token) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        localStorage.removeItem("auth_token");
        setUser(null);
      }
    } catch (err) {
      console.error("Auth Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (userData, token) => {
    localStorage.setItem("auth_token", token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  if (isLoading) return <div style={{ background: "#000", height: "100vh", color: "#fff" }}>Loading...</div>;

  // 🟢 THE DECISION MAKER
  return user ? (
    <UserProfile user={user} onLogout={handleLogout} />
  ) : (
    <AuthForm onLoginSuccess={handleLoginSuccess} />
  );
}