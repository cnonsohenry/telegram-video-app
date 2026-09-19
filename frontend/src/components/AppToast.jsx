import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export default function AppToast() {
  const [toast, setToast] = useState(null);
  const [isExiting, setIsExiting] = useState(false);
  const hideTimerRef = useRef(null);
  const removeTimerRef = useRef(null);

  const startExit = () => {
    setIsExiting(true);
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    removeTimerRef.current = setTimeout(() => {
      setToast(null);
      setIsExiting(false);
    }, 280);
  };

  useEffect(() => {
    const handleToast = (e) => {
      if (!e.detail) return;
      const { message, type = "info", duration = 3000 } = e.detail;

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);

      setIsExiting(false);
      setToast({
        id: Date.now(),
        message,
        type,
      });

      hideTimerRef.current = setTimeout(() => {
        startExit();
      }, duration);
    };

    window.addEventListener("showAppToast", handleToast);
    return () => {
      window.removeEventListener("showAppToast", handleToast);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, []);

  if (!toast) return null;

  const isSuccess = toast.type === "success";
  const isError = toast.type === "error";

  // Green for success (#34c759), Red for error/unfollow (#ff3b30), Cyan for info (#00aff0)
  const accentColor = isSuccess ? "#34c759" : isError ? "#ff3b30" : "#00aff0";
  const glowColor = isSuccess 
    ? "rgba(52, 199, 89, 0.28)" 
    : isError 
    ? "rgba(255, 59, 48, 0.28)" 
    : "rgba(0, 175, 240, 0.28)";

  return (
    <div 
      style={{
        ...toastWrapperStyle,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "translateX(-50%) translateY(-14px) scale(0.96)" : "translateX(-50%) translateY(0) scale(1)",
        transition: "opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      <div 
        style={{
          ...toastCardStyle,
          borderColor: accentColor,
          boxShadow: `0 8px 30px ${glowColor}, 0 2px 10px rgba(0, 0, 0, 0.7)`
        }}
      >
        <div style={iconBoxStyle}>
          {isSuccess && <CheckCircle2 size={19} color="#34c759" />}
          {isError && <AlertCircle size={19} color="#ff3b30" />}
          {!isSuccess && !isError && <Info size={19} color="#00aff0" />}
        </div>

        <div style={textStyle}>
          {toast.message}
        </div>

        <button 
          onClick={startExit}
          style={closeBtnStyle}
          aria-label="Close"
          title="Dismiss"
        >
          <X size={14} color="#a8a8a8" />
        </button>
      </div>
    </div>
  );
}

const toastWrapperStyle = {
  position: "fixed",
  top: "16px",
  left: "50%",
  zIndex: 9999999,
  width: "calc(100% - 32px)",
  maxWidth: "420px",
  pointerEvents: "none",
  display: "flex",
  justifyContent: "center",
  boxSizing: "border-box"
};

const toastCardStyle = {
  pointerEvents: "auto",
  background: "rgba(20, 20, 22, 0.96)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1.5px solid #333",
  borderRadius: "14px",
  padding: "11px 16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease"
};

const iconBoxStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const textStyle = {
  fontSize: "13.5px",
  fontWeight: "600",
  color: "#ffffff",
  flex: 1,
  lineHeight: "1.4",
  wordBreak: "break-word",
  letterSpacing: "0.1px"
};

const closeBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  opacity: 0.8,
  transition: "opacity 0.15s ease"
};
