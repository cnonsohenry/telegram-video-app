import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, Heart, MessageCircle, Bookmark, UserPlus, Crown, Lock, ArrowRight, Sparkles, Download, Flag 
} from "lucide-react";
import useModalHistory from "../hooks/useModalHistory";

export default function LoginPromptModal({ isOpen, action = "continue", onClose, onLogin }) {
  const handleSafeClose = useModalHistory(isOpen, onClose, "loginPrompt");
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth >= 640 : false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isOpen) return null;

  const getActionConfig = (act) => {
    switch (act) {
      case "like":
        return {
          title: "Sign in to Like Videos",
          subtitle: "Create a free account to like videos, support creators, and personalize your feed.",
          icon: Heart,
          iconColor: "#f43f5e",
          iconBg: "rgba(244, 63, 94, 0.08)",
          iconBorder: "rgba(244, 63, 94, 0.18)"
        };
      case "comment":
        return {
          title: "Join the Conversation",
          subtitle: "Sign in to share your thoughts, drop reactions, and interact directly with creators.",
          icon: MessageCircle,
          iconColor: "#38bdf8",
          iconBg: "rgba(56, 189, 248, 0.08)",
          iconBorder: "rgba(56, 189, 248, 0.18)"
        };
      case "save":
        return {
          title: "Save to Your Profile",
          subtitle: "Sign in to bookmark videos and access your private saved collection anytime.",
          icon: Bookmark,
          iconColor: "#fbbf24",
          iconBg: "rgba(251, 191, 36, 0.08)",
          iconBorder: "rgba(251, 191, 36, 0.18)"
        };
      case "follow":
        return {
          title: "Follow This Creator",
          subtitle: "Sign in to follow creators, get notified of fresh uploads, and see their latest drops.",
          icon: UserPlus,
          iconColor: "#38bdf8",
          iconBg: "rgba(56, 189, 248, 0.08)",
          iconBorder: "rgba(56, 189, 248, 0.18)"
        };
      case "subscribe":
        return {
          title: "Unlock VIP Access",
          subtitle: "Sign in to subscribe to VIP exclusive series, uncut episodes, and premium creator perks.",
          icon: Crown,
          iconColor: "#fbbf24",
          iconBg: "rgba(251, 191, 36, 0.08)",
          iconBorder: "rgba(251, 191, 36, 0.18)"
        };
      case "upload":
        return {
          title: "Publish on Naija Homemade",
          subtitle: "Sign in or set up your creator profile to upload videos directly to the Community feed.",
          icon: Lock,
          iconColor: "#38bdf8",
          iconBg: "rgba(56, 189, 248, 0.08)",
          iconBorder: "rgba(56, 189, 248, 0.18)"
        };
      case "download":
        return {
          title: "Sign in to Download Videos",
          subtitle: "Create a free account and verify your email to download clips and watch offline anytime.",
          icon: Download,
          iconColor: "#38bdf8",
          iconBg: "rgba(56, 189, 248, 0.08)",
          iconBorder: "rgba(56, 189, 248, 0.18)"
        };
      case "report":
        return {
          title: "Sign in to Report Content",
          subtitle: "Create a free account and verify your email to report inappropriate content and keep the community safe.",
          icon: Flag,
          iconColor: "#fb7185",
          iconBg: "rgba(251, 113, 133, 0.08)",
          iconBorder: "rgba(251, 113, 133, 0.18)"
        };
      default:
        return {
          title: "Account Required",
          subtitle: "Sign in or create a free account to unlock interactive features and access your dashboard.",
          icon: Lock,
          iconColor: "#38bdf8",
          iconBg: "rgba(56, 189, 248, 0.08)",
          iconBorder: "rgba(56, 189, 248, 0.18)"
        };
    }
  };

  const config = getActionConfig(action);
  const Icon = config.icon;

  const content = (
    <div 
      style={{
        ...overlayStyle,
        alignItems: isDesktop ? "center" : "flex-end"
      }} 
      onClick={handleSafeClose}
    >
      <div 
        style={{
          ...cardStyle,
          borderRadius: isDesktop ? "22px" : "24px 24px 0 0",
          border: isDesktop ? "1px solid rgba(255, 255, 255, 0.08)" : "none",
          animation: isDesktop ? "promptFadeScale 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "promptSlideUp 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Top Drag Handle Indicator */}
        {!isDesktop && (
          <div style={dragHandleWrapper}>
            <div style={dragHandlePill} />
          </div>
        )}

        <button 
          onClick={handleSafeClose}
          style={closeBtnStyle}
          aria-label="Close"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.06)"}
        >
          <X size={17} color="#a1a1aa" />
        </button>

        <div style={{
          ...iconContainerStyle,
          backgroundColor: config.iconBg,
          borderColor: config.iconBorder
        }}>
          <Icon size={22} color={config.iconColor} />
        </div>

        <div style={titleStyle}>
          {config.title}
        </div>

        <div style={subtitleStyle}>
          {config.subtitle}
        </div>

        <div style={perksRowStyle}>
          <div style={perkPillStyle}>
            <Sparkles size={12} color="#fbbf24" />
            <span>100% Free Account</span>
          </div>
          <div style={perkPillStyle}>
            <span>⚡ Takes 10 Seconds</span>
          </div>
        </div>

        <div style={actionsContainerStyle}>
          <button 
            type="button" 
            onClick={() => {
              if (typeof handleSafeClose?.transition === "function") {
                handleSafeClose.transition("authModal");
              }
              if (onClose) onClose();
              if (onLogin) onLogin();
            }}
            style={primaryBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#f4f4f5"}
          >
            <span>Sign In / Create Account</span>
            <ArrowRight size={15} />
          </button>

          <button 
            type="button" 
            onClick={handleSafeClose}
            style={secondaryBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.color = "#f4f4f5"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#71717a"}
          >
            Maybe Later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes promptSlideUp {
          from { transform: translateY(100%); opacity: 0.9; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes promptFadeScale {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000300,
  backgroundColor: "rgba(0, 0, 0, 0.65)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  display: "flex",
  justifyContent: "center",
  padding: "0"
};

const cardStyle = {
  width: "100%",
  maxWidth: "420px",
  backgroundColor: "#18181b",
  padding: "16px 20px max(24px, env(safe-area-inset-bottom, 24px))",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  position: "relative",
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.6), 0 20px 60px rgba(0, 0, 0, 0.7)"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingBottom: "14px",
  cursor: "grab"
};

const dragHandlePill = {
  width: "36px",
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "rgba(255, 255, 255, 0.16)"
};

const closeBtnStyle = {
  position: "absolute",
  top: "16px",
  right: "16px",
  background: "rgba(255, 255, 255, 0.06)",
  border: "none",
  borderRadius: "50%",
  width: "30px",
  height: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.15s ease"
};

const iconContainerStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "16px",
  border: "1px solid",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "12px",
  marginTop: "2px",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)"
};

const titleStyle = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#f4f4f5",
  letterSpacing: "-0.015em",
  marginBottom: "6px"
};

const subtitleStyle = {
  fontSize: "13px",
  color: "#a1a1aa",
  lineHeight: "1.45",
  marginBottom: "16px",
  maxWidth: "340px"
};

const perksRowStyle = {
  display: "flex",
  gap: "8px",
  marginBottom: "20px"
};

const perkPillStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: "9999px",
  padding: "5px 12px",
  fontSize: "11.5px",
  color: "#d4d4d8",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontWeight: "500"
};

const actionsContainerStyle = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "8px"
};

const primaryBtnStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: "9999px",
  border: "none",
  background: "#f4f4f5",
  color: "#09090b",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.25)",
  transition: "all 0.15s ease"
};

const secondaryBtnStyle = {
  width: "100%",
  padding: "11px",
  borderRadius: "9999px",
  border: "none",
  background: "transparent",
  color: "#71717a",
  fontSize: "13px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.15s ease"
};
