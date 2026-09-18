import React from "react";
import { 
  X, Heart, MessageCircle, Bookmark, UserPlus, Crown, Lock, ArrowRight, Sparkles 
} from "lucide-react";

export default function LoginPromptModal({ isOpen, action = "continue", onClose, onLogin }) {
  if (!isOpen) return null;

  const getActionConfig = (act) => {
    switch (act) {
      case "like":
        return {
          title: "Sign in to Like Videos",
          subtitle: "Create a free account to like videos, support creators, and personalize your feed.",
          icon: Heart,
          iconColor: "#ff2d55",
          iconBg: "rgba(255, 45, 85, 0.15)",
          iconBorder: "rgba(255, 45, 85, 0.3)"
        };
      case "comment":
        return {
          title: "Join the Conversation",
          subtitle: "Sign in to share your thoughts, drop reactions, and interact directly with creators.",
          icon: MessageCircle,
          iconColor: "#00aff0",
          iconBg: "rgba(0, 175, 240, 0.15)",
          iconBorder: "rgba(0, 175, 240, 0.3)"
        };
      case "save":
        return {
          title: "Save to Your Profile",
          subtitle: "Sign in to bookmark this video and access your private saved collection anytime.",
          icon: Bookmark,
          iconColor: "#ffd700",
          iconBg: "rgba(255, 215, 0, 0.15)",
          iconBorder: "rgba(255, 215, 0, 0.3)"
        };
      case "follow":
        return {
          title: "Follow This Creator",
          subtitle: "Sign in to follow creators, get notified of fresh uploads, and see their latest drops.",
          icon: UserPlus,
          iconColor: "#00aff0",
          iconBg: "rgba(0, 175, 240, 0.15)",
          iconBorder: "rgba(0, 175, 240, 0.3)"
        };
      case "subscribe":
        return {
          title: "Unlock VIP Access",
          subtitle: "Sign in to subscribe to VIP exclusive series, uncut episodes, and premium creator perks.",
          icon: Crown,
          iconColor: "#ffd700",
          iconBg: "rgba(255, 215, 0, 0.15)",
          iconBorder: "rgba(255, 215, 0, 0.3)"
        };
      default:
        return {
          title: "Account Required",
          subtitle: "Sign in or create a free account to unlock interactive features and access your dashboard.",
          icon: Lock,
          iconColor: "var(--primary-color, #00aff0)",
          iconBg: "rgba(0, 175, 240, 0.15)",
          iconBorder: "rgba(0, 175, 240, 0.3)"
        };
    }
  };

  const config = getActionConfig(action);
  const Icon = config.icon;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div 
        style={cardStyle} 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          style={closeBtnStyle}
          aria-label="Close"
        >
          <X size={18} color="#aaa" />
        </button>

        <div style={{
          ...iconContainerStyle,
          backgroundColor: config.iconBg,
          borderColor: config.iconBorder
        }}>
          <Icon size={28} color={config.iconColor} />
        </div>

        <div style={titleStyle}>
          {config.title}
        </div>

        <div style={subtitleStyle}>
          {config.subtitle}
        </div>

        <div style={perksRowStyle}>
          <div style={perkPillStyle}>
            <Sparkles size={12} color="#ffd700" />
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
              onClose();
              if (onLogin) onLogin();
            }}
            style={primaryBtnStyle}
          >
            <span>Sign In / Create Account</span>
            <ArrowRight size={16} />
          </button>

          <button 
            type="button" 
            onClick={onClose}
            style={secondaryBtnStyle}
          >
            Maybe Later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes loginModalFadeIn {
          0% { opacity: 0; transform: translateY(20px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999995,
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  boxSizing: "border-box"
};

const cardStyle = {
  width: "100%",
  maxWidth: "380px",
  background: "#161618",
  border: "1px solid #2c2c2e",
  borderRadius: "22px",
  padding: "24px 20px 20px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  position: "relative",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.05)",
  animation: "loginModalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
};

const closeBtnStyle = {
  position: "absolute",
  top: "14px",
  right: "14px",
  background: "#222",
  border: "none",
  borderRadius: "50%",
  width: "30px",
  height: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "0.2s"
};

const iconContainerStyle = {
  width: "60px",
  height: "60px",
  borderRadius: "18px",
  border: "1px solid",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "16px"
};

const titleStyle = {
  fontSize: "19px",
  fontWeight: "800",
  color: "#fff",
  letterSpacing: "-0.3px",
  marginBottom: "8px"
};

const subtitleStyle = {
  fontSize: "13px",
  color: "#8e8e93",
  lineHeight: "1.45",
  marginBottom: "16px",
  padding: "0 8px"
};

const perksRowStyle = {
  display: "flex",
  gap: "8px",
  marginBottom: "20px"
};

const perkPillStyle = {
  background: "#222226",
  border: "1px solid #2e2e32",
  borderRadius: "100px",
  padding: "4px 10px",
  fontSize: "11px",
  color: "#ccc",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontWeight: "600"
};

const actionsContainerStyle = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const primaryBtnStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: "12px",
  border: "none",
  background: "var(--primary-color, #00aff0)",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  boxShadow: "0 4px 14px rgba(0, 175, 240, 0.35)",
  transition: "0.2s"
};

const secondaryBtnStyle = {
  width: "100%",
  padding: "11px",
  borderRadius: "12px",
  border: "none",
  background: "transparent",
  color: "#888",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "0.2s"
};
