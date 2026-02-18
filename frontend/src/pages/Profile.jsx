import React, { useEffect } from "react";
import UserProfile from "../components/UserProfile";

// 🟢 Props are now passed from the "Single Source of Truth" in App.jsx
export default function Profile({ user, onLogout, setHideFooter }) {

  // 🟢 2. SCROLL & UI CLEANUP
  // Ensures that when this page is active, the scroll behavior is normal
  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.position = "";
    document.body.style.touchAction = "";

    return () => {
      // Cleanup if needed when switching tabs
      document.body.style.overflow = "auto";
    };
  }, []);

  // 🟢 3. RENDER
  // We no longer need a "Decision Maker" here. 
  // App.jsx handles the logic: if user is null, it shows AuthForm; 
  // if user exists, it shows this Profile component.
  return (
    <UserProfile 
      user={user} 
      onLogout={onLogout} 
      setHideFooter={setHideFooter} 
    />
  );
}