import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export default function AppToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer = null;

    const handleToast = (e) => {
      if (!e.detail) return;
      const { message, type = "info", duration = 3200 } = e.detail;

      if (timer) clearTimeout(timer);

      setToast({
        id: Date.now(),
        message,
        type,
      });

      timer = setTimeout(() => {
        setToast(null);
      }, duration);
    };

    window.addEventListener("showAppToast", handleToast);
    return () => {
      window.removeEventListener("showAppToast", handleToast);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  const isSuccess = toast.type === "success";
  const isError = toast.type === "error";

  const borderColor = isSuccess ? "#34c759" : isError ? "#ff3b30" : "var(--primary-color, #00aff0)";
  const glowColor = isSuccess ? "rgba(52, 199, 89, 0.25)" : isError ? "rgba(255, 59, 48, 0.25)" : "rgba(0, 175, 240, 0.25)";

  return (
    <div style={toastWrapperStyle}>
      <div 
        style={{
          ...toastCardStyle,
          borderColor,
          boxShadow: `0 8px 32px ${glowColor}, 0 2px 8px rgba(0, 0, 0, 0.6)`
        }}
      >
        <div style={iconBoxStyle}>
          {isSuccess && <CheckCircle2 size={18} color="#34c759" />}
          {isError && <AlertCircle size={18} color="#ff3b30" />}
          {!isSuccess && !isError && <Info size={18} color="var(--primary-color, #00aff0)" />}
        </div>

        <div style={textStyle}>
          {toast.message}
        </div>

        <button 
          onClick={() => setToast(null)}
          style={closeBtnStyle}
          aria-label="Close"
        >
          <X size={14} color="#888" />
        </button>
      </div>

      <style>{`
        @keyframes toastSlideIn {
          0% { opacity: 0; transform: translateY(-16px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

const toastWrapperStyle = {
  position: "fixed",
  top: "16px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 9999999,
  width: "calc(100% - 32px)",
  maxWidth: "420px",
  pointerEvents: "none",
  display: "flex",
  justifyContent: "center",
  animation: "toastSlideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)"
};

const toastCardStyle = {
  pointerEvents: "auto",
  background: "rgba(22, 22, 24, 0.95)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid #333",
  borderRadius: "14px",
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  boxSizing: "border-box"
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
  color: "#fff",
  flex: 1,
  lineHeight: "1.4",
  wordBreak: "break-word"
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
  opacity: 0.8
};
