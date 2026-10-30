import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  X, Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight, RefreshCw, Edit2, ShieldCheck, Download,
  Film, MessageSquare, Heart, Bookmark, UserPlus, CreditCard
} from "lucide-react";
import { APP_CONFIG } from "../config";
import { showToast } from "../utils/toast";
import useModalHistory from "../hooks/useModalHistory";

export default function EmailVerificationModal({
  isOpen,
  initialEmail = "",
  reason = "download",
  currentUser = null,
  onClose,
  onVerified
}) {
  const handleSafeClose = useModalHistory(isOpen, onClose, "emailVerification");

  const [email, setEmail] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth >= 640 : false);

  const otpInputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize email from props/currentUser
  useEffect(() => {
    if (isOpen) {
      const defaultEmail = initialEmail || currentUser?.email || "";
      const isSynthetic = defaultEmail.endsWith("@internal.naijahomemade.com");
      setEmail(isSynthetic ? "" : defaultEmail);
      setIsEditingEmail(isSynthetic || !defaultEmail);
      setOtpCode("");
      setOtpSent(false);
      setError("");
      setSuccessMsg("");
      setIsVerified(false);
    }
  }, [isOpen, initialEmail, currentUser]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus OTP input when sent
  useEffect(() => {
    if (otpSent && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [otpSent]);

  if (!isOpen) return null;

  const getReasonConfig = () => {
    switch (reason) {
      case "story":
        return {
          title: "Verify to Watch Stories",
          subtitle: "Confirm your email address once to unlock 24-hour creator status stories.",
          badgeIcon: Film
        };
      case "comment":
        return {
          title: "Verify to Comment",
          subtitle: "Confirm your email address once to join discussions and post replies.",
          badgeIcon: MessageSquare
        };
      case "like":
        return {
          title: "Verify to Like",
          subtitle: "Confirm your email address once to like videos and comments.",
          badgeIcon: Heart
        };
      case "save":
        return {
          title: "Verify to Bookmark",
          subtitle: "Confirm your email address once to save your favorite clips to your profile.",
          badgeIcon: Bookmark
        };
      case "follow":
        return {
          title: "Verify to Follow",
          subtitle: "Confirm your email address once to follow your favorite creators.",
          badgeIcon: UserPlus
        };
      case "payment":
      case "subscribe":
      case "tip":
        return {
          title: "Verify for VIP & Payments",
          subtitle: "Confirm your email address to unlock creator subscriptions, VIP passes, and fan tipping.",
          badgeIcon: CreditCard
        };
      case "download":
        return {
          title: "Verify to Download",
          subtitle: "Confirm your email address once to unlock fast video downloads and offline clips.",
          badgeIcon: Download
        };
      case "report":
        return {
          title: "Verify to Report",
          subtitle: "Confirm your email to submit content feedback and help keep our community safe.",
          badgeIcon: ShieldCheck
        };
      default:
        return {
          title: "Email Verification",
          subtitle: "Verify your email address with a 6-digit verification code.",
          badgeIcon: Mail
        };
    }
  };

  const reasonConfig = getReasonConfig();
  const BadgeIcon = reasonConfig.badgeIcon;

  const handleSendCode = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/send-email-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: cleanEmail })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      if (data.already_verified) {
        setIsVerified(true);
        setSuccessMsg("Your email is already verified!");
        window.dispatchEvent(new CustomEvent("refreshUser"));
        setTimeout(() => {
          if (onVerified) onVerified();
          handleSafeClose();
        }, 800);
        return;
      }

      setOtpSent(true);
      setIsEditingEmail(false);
      setResendCooldown(60);
      setSuccessMsg(`We sent a 6-digit code to ${cleanEmail}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/verify-email-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: cleanCode })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      setIsVerified(true);
      setSuccessMsg("Email successfully verified!");
      showToast("Email verified successfully!", "success");

      // Synchronize global user state
      if (data.user) {
        window.dispatchEvent(new CustomEvent("refreshUser", { detail: data.user }));
      } else {
        window.dispatchEvent(new CustomEvent("refreshUser"));
      }

      setTimeout(() => {
        if (onVerified) onVerified(data.user);
        handleSafeClose();
      }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
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

        {/* Close Button */}
        <button 
          onClick={handleSafeClose}
          style={closeBtnStyle}
          aria-label="Close"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.06)"}
        >
          <X size={17} color="#a1a1aa" />
        </button>

        {/* Icon & Title */}
        <div style={headerSection}>
          <div style={isVerified ? iconBadgeEmerald : iconBadgeSleek}>
            {isVerified ? (
              <CheckCircle2 size={24} color="#34d399" />
            ) : (
              <BadgeIcon size={22} color="#38bdf8" />
            )}
          </div>
          <h2 style={modalTitle}>{isVerified ? "Email Verified" : reasonConfig.title}</h2>
          <p style={modalSubtitle}>
            {isVerified 
              ? "Your account is verified. You can now download clips freely." 
              : reasonConfig.subtitle}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={errorBanner}>
            <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && !isVerified && (
          <div style={successBanner}>
            <CheckCircle2 size={15} color="#34d399" style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: Enter / Confirm Email */}
        {!otpSent && !isVerified && (
          <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {isEditingEmail ? (
              <div>
                <label style={labelStyle}>Email Address</label>
                <div style={inputWrapper}>
                  <Mail size={16} color="#71717a" style={inputIconStyle} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoFocus
                    required
                    style={textInputStyle}
                  />
                </div>
              </div>
            ) : (
              <div style={emailPreviewCard}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                  <Mail size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(true)}
                  style={changeBtnStyle}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"}
                >
                  <Edit2 size={12} style={{ marginRight: "4px" }} />
                  Change
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...primaryActionBtn,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer"
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#ffffff";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#f4f4f5";
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin-animation" style={{ marginRight: "8px" }} />
                  Sending code...
                </>
              ) : (
                <>
                  Send Verification Code
                  <ArrowRight size={15} style={{ marginLeft: "8px" }} />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Enter 6-Digit Code */}
        {otpSent && !isVerified && (
          <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={labelStyle}>6-Digit Verification Code</label>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setIsEditingEmail(true);
                  }}
                  style={{ background: "none", border: "none", color: "#71717a", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
                >
                  Change email
                </button>
              </div>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(val);
                }}
                placeholder="0 0 0 0 0 0"
                style={otpInputStyle}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              style={{
                ...primaryActionBtn,
                opacity: loading || otpCode.length < 6 ? 0.45 : 1,
                cursor: loading || otpCode.length < 6 ? "not-allowed" : "pointer"
              }}
              onMouseEnter={(e) => {
                if (!loading && otpCode.length >= 6) e.currentTarget.style.backgroundColor = "#ffffff";
              }}
              onMouseLeave={(e) => {
                if (!loading && otpCode.length >= 6) e.currentTarget.style.backgroundColor = "#f4f4f5";
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin-animation" style={{ marginRight: "8px" }} />
                  Verifying...
                </>
              ) : (
                "Verify & Continue"
              )}
            </button>

            {/* Resend Cooldown */}
            <div style={{ textAlign: "center", marginTop: "2px" }}>
              {resendCooldown > 0 ? (
                <span style={{ fontSize: "12.5px", color: "#71717a" }}>
                  Resend code in <strong style={{ color: "#a1a1aa" }}>{resendCooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading}
                  style={resendBtnStyle}
                >
                  <RefreshCw size={12} style={{ marginRight: "5px" }} />
                  Resend verification code
                </button>
              )}
            </div>
          </form>
        )}

        {/* STEP 3: Verified Checkmark Screen */}
        {isVerified && (
          <div style={{ textAlign: "center", padding: "12px 0 6px 0" }}>
            <div style={{ fontSize: "13.5px", color: "#34d399", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <CheckCircle2 size={16} />
              Unlocked! Ready to continue...
            </div>
          </div>
        )}
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
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}

// 🖌 SLEEK, LIGHT, AIRY STYLING (Calm Black #09090b, elevated #18181b, clean zinc surfaces, soft sky accent)
const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000320,
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
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.6), 0 20px 60px rgba(0, 0, 0, 0.7)",
  padding: "16px 20px 24px 20px",
  position: "relative",
  boxSizing: "border-box",
  color: "#f4f4f5",
  marginBottom: "env(safe-area-inset-bottom, 0px)"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingBottom: "14px"
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

const headerSection = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  marginBottom: "18px"
};

const iconBadgeSleek = {
  width: "48px",
  height: "48px",
  borderRadius: "16px",
  backgroundColor: "rgba(56, 189, 248, 0.08)",
  border: "1px solid rgba(56, 189, 248, 0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "12px",
  boxShadow: "0 4px 16px rgba(56, 189, 248, 0.06)"
};

const iconBadgeEmerald = {
  width: "48px",
  height: "48px",
  borderRadius: "16px",
  backgroundColor: "rgba(16, 185, 129, 0.1)",
  border: "1px solid rgba(16, 185, 129, 0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "12px",
  boxShadow: "0 4px 16px rgba(16, 185, 129, 0.08)"
};

const modalTitle = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#f4f4f5",
  margin: "0 0 5px 0",
  letterSpacing: "-0.015em"
};

const modalSubtitle = {
  fontSize: "13px",
  color: "#a1a1aa",
  margin: 0,
  lineHeight: "1.45",
  maxWidth: "340px"
};

const labelStyle = {
  display: "block",
  fontSize: "11px",
  fontWeight: "600",
  color: "#71717a",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.05em"
};

const inputWrapper = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  width: "100%"
};

const inputIconStyle = {
  position: "absolute",
  left: "14px",
  pointerEvents: "none"
};

const textInputStyle = {
  width: "100%",
  padding: "11px 14px 11px 40px",
  backgroundColor: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  color: "#f4f4f5",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease"
};

const emailPreviewCard = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  backgroundColor: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: "12px",
  width: "100%",
  boxSizing: "border-box"
};

const changeBtnStyle = {
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#d4d4d8",
  fontSize: "12px",
  fontWeight: "600",
  padding: "5px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  transition: "all 0.15s ease"
};

const otpInputStyle = {
  width: "100%",
  padding: "12px 14px",
  backgroundColor: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "14px",
  color: "#f4f4f5",
  fontSize: "20px",
  fontWeight: "700",
  letterSpacing: "10px",
  textAlign: "center",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease"
};

const primaryActionBtn = {
  width: "100%",
  padding: "12px",
  backgroundColor: "#f4f4f5",
  border: "none",
  borderRadius: "9999px",
  color: "#09090b",
  fontWeight: "700",
  fontSize: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.15s ease",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.25)"
};

const resendBtnStyle = {
  background: "none",
  border: "none",
  color: "#38bdf8",
  fontSize: "12.5px",
  fontWeight: "600",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  padding: "4px",
  transition: "opacity 0.15s ease"
};

const errorBanner = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  backgroundColor: "rgba(239, 68, 68, 0.08)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  borderRadius: "10px",
  padding: "9px 12px",
  color: "#fca5a5",
  fontSize: "12.5px",
  marginBottom: "12px"
};

const successBanner = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  backgroundColor: "rgba(16, 185, 129, 0.08)",
  border: "1px solid rgba(16, 185, 129, 0.2)",
  borderRadius: "10px",
  padding: "9px 12px",
  color: "#6ee7b7",
  fontSize: "12.5px",
  marginBottom: "12px"
};
