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

  return (
    <div 
      style={{
        ...toastWrapperStyle,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "translateX(-50%) translateY(-12px) scale(0.96)" : "translateX(-50%) translateY(0) scale(1)",
        transition: "opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1), transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      <div style={toastCardStyle}>
        <div style={iconBoxStyle}>
          {isSuccess && <CheckCircle2 size={17} color="#34d399" />}
          {isError && <AlertCircle size={17} color="#fb7185" />}
          {!isSuccess && !isError && <Info size={17} color="#38bdf8" />}
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
          <X size={13} color="#a1a1aa" />
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
  maxWidth: "380px",
  pointerEvents: "none",
  display: "flex",
  justifyContent: "center",
  boxSizing: "border-box"
};

const toastCardStyle = {
  pointerEvents: "auto",
  background: "rgba(24, 24, 27, 0.94)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "9999px",
  padding: "9px 16px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)",
  boxSizing: "border-box"
};

const iconBoxStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const textStyle = {
  fontSize: "13px",
  fontWeight: "500",
  color: "#f4f4f5",
  flex: 1,
  lineHeight: "1.35",
  wordBreak: "break-word"
};

const closeBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "2px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  opacity: 0.7,
  transition: "opacity 0.15s ease"
};
