import { 
  X, Heart, MessageCircle, Bookmark, UserPlus, Crown, Lock, ArrowRight, Sparkles 
} from "lucide-react";
import useModalHistory from "../hooks/useModalHistory";

export default function LoginPromptModal({ isOpen, action = "continue", onClose, onLogin }) {
  const handleSafeClose = useModalHistory(isOpen, onClose, "loginPrompt");

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
      case "upload":
        return {
          title: "Publish on Naija Homemade",
          subtitle: "Sign in or set up your creator profile to upload videos directly to the Community feed.",
          icon: Lock,
          iconColor: "#00aff0",
          iconBg: "rgba(0, 175, 240, 0.15)",
          iconBorder: "rgba(0, 175, 240, 0.3)"
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
    <div style={overlayStyle} onClick={handleSafeClose}>
      <div 
        style={cardStyle} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drag Handle Indicator */}
        <div style={dragHandleWrapper}>
          <div style={dragHandlePill} />
        </div>

        <button 
          onClick={handleSafeClose}
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
          <Icon size={26} color={config.iconColor} />
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
              if (typeof handleSafeClose?.transition === "function") {
                handleSafeClose.transition("authModal");
              }
              if (onClose) onClose();
              if (onLogin) onLogin();
            }}
            style={primaryBtnStyle}
          >
            <span>Sign In / Create Account</span>
            <ArrowRight size={16} />
          </button>

          <button 
            type="button" 
            onClick={handleSafeClose}
            style={secondaryBtnStyle}
          >
            Maybe Later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes loginSheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes loginBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000045,
  backgroundColor: "rgba(0, 0, 0, 0.72)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  alignItems: "center",
  animation: "loginBackdropFade 0.2s ease"
};

const cardStyle = {
  width: "100%",
  maxWidth: "480px",
  backgroundColor: "#000000",
  borderTop: "1px solid #2f3336",
  borderLeft: "1px solid #2f3336",
  borderRight: "1px solid #2f3336",
  borderRadius: "24px 24px 0 0",
  padding: "10px 20px max(24px, env(safe-area-inset-bottom, 24px))",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  position: "relative",
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.8)",
  animation: "loginSheetSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingTop: "2px",
  paddingBottom: "12px",
  cursor: "grab"
};

const dragHandlePill = {
  width: "36px",
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "#3e4144"
};

const closeBtnStyle = {
  position: "absolute",
  top: "16px",
  right: "16px",
  background: "rgba(255, 255, 255, 0.08)",
  border: "none",
  borderRadius: "50%",
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "0.2s"
};

const iconContainerStyle = {
  width: "56px",
  height: "56px",
  borderRadius: "18px",
  border: "1px solid",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "14px",
  marginTop: "4px"
};

const titleStyle = {
  fontSize: "19px",
  fontWeight: "800",
  color: "#ffffff",
  letterSpacing: "-0.3px",
  marginBottom: "8px"
};

const subtitleStyle = {
  fontSize: "13.5px",
  color: "#8e8e93",
  lineHeight: "1.45",
  marginBottom: "16px",
  padding: "0 10px"
};

const perksRowStyle = {
  display: "flex",
  gap: "8px",
  marginBottom: "20px"
};

const perkPillStyle = {
  background: "#16181c",
  border: "1px solid #2f3336",
  borderRadius: "100px",
  padding: "5px 12px",
  fontSize: "11.5px",
  color: "#e7e9ea",
  display: "flex",
  alignItems: "center",
  gap: "6px",
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
  padding: "14px",
  borderRadius: "9999px",
  border: "none",
  background: "#ffffff",
  color: "#000000",
  fontSize: "15px",
  fontWeight: "800",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  boxShadow: "0 4px 16px rgba(255, 255, 255, 0.15)",
  transition: "0.2s"
};

const secondaryBtnStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: "9999px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.04)",
  color: "#8e8e93",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "0.2s"
};
