import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  X, Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight, RefreshCw, Edit2, ShieldCheck, Download
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

  const otpInputRef = useRef(null);

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
      case "download":
        return {
          title: "Verify Email to Download",
          subtitle: "To download videos and save clips for offline watching, please verify your email address.",
          badgeIcon: Download
        };
      case "report":
        return {
          title: "Verify Email to Report",
          subtitle: "To prevent spam and submit content reports, please verify your email address.",
          badgeIcon: ShieldCheck
        };
      default:
        return {
          title: "Email Verification",
          subtitle: "Please verify your email address with a 6-digit confirmation code.",
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
      setSuccessMsg(`We sent a 6-digit verification code to ${cleanEmail}`);
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
    <div style={overlayStyle} onClick={handleSafeClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        {/* Top Drag Handle Indicator */}
        <div style={dragHandleWrapper}>
          <div style={dragHandlePill} />
        </div>

        {/* Close Button */}
        <button 
          onClick={handleSafeClose}
          style={closeBtnStyle}
          aria-label="Close"
        >
          <X size={18} color="#a1a1aa" />
        </button>

        {/* Icon & Title */}
        <div style={headerSection}>
          <div style={iconBadgeRose}>
            {isVerified ? (
              <CheckCircle2 size={26} color="#10b981" />
            ) : (
              <BadgeIcon size={26} color="#f43f5e" />
            )}
          </div>
          <h2 style={modalTitle}>{isVerified ? "Email Verified!" : reasonConfig.title}</h2>
          <p style={modalSubtitle}>
            {isVerified 
              ? "Your account is verified. You can now download videos anytime." 
              : reasonConfig.subtitle}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={errorBanner}>
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && !isVerified && (
          <div style={successBanner}>
            <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
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
                  <Mail size={18} color="#71717a" style={inputIconStyle} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoFocus
                    required
                    style={textInputStyle}
                  />
                </div>
              </div>
            ) : (
              <div style={emailPreviewCard}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, overflow: "hidden" }}>
                  <Mail size={18} color="#f43f5e" />
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(true)}
                  style={changeBtnStyle}
                >
                  <Edit2 size={13} style={{ marginRight: "4px" }} />
                  Change
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...primaryActionBtn,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin-animation" style={{ marginRight: "8px" }} />
                  Sending Code...
                </>
              ) : (
                <>
                  Send 6-Digit Code
                  <ArrowRight size={17} style={{ marginLeft: "8px" }} />
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
                  style={{ background: "none", border: "none", color: "#a1a1aa", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
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
                placeholder="• • • • • •"
                style={otpInputStyle}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              style={{
                ...primaryActionBtn,
                opacity: loading || otpCode.length < 6 ? 0.6 : 1,
                cursor: loading || otpCode.length < 6 ? "not-allowed" : "pointer"
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin-animation" style={{ marginRight: "8px" }} />
                  Verifying...
                </>
              ) : (
                "Verify & Continue"
              )}
            </button>

            {/* Resend Cooldown */}
            <div style={{ textAlign: "center", marginTop: "4px" }}>
              {resendCooldown > 0 ? (
                <span style={{ fontSize: "13px", color: "#71717a" }}>
                  Resend code in <strong style={{ color: "#a1a1aa" }}>{resendCooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading}
                  style={resendBtnStyle}
                >
                  <RefreshCw size={13} style={{ marginRight: "5px" }} />
                  Resend verification code
                </button>
              )}
            </div>
          </form>
        )}

        {/* STEP 3: Verified Checkmark Screen */}
        {isVerified && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: "14px", color: "#10b981", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <CheckCircle2 size={18} />
              Verified successfully! Unlocking...
            </div>
          </div>
        )}
      </div>

      <style>{`
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

// 🖌 STYLES (Strictly conforming to Calm Black #09090b, elevated #18181b, interactive #27272a, smooth crimson #f43f5e)
const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000320,
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center"
};

const cardStyle = {
  width: "100%",
  maxWidth: "460px",
  backgroundColor: "#18181b",
  borderTopLeftRadius: "24px",
  borderTopRightRadius: "24px",
  border: "none",
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.85)",
  padding: "16px 20px 28px 20px",
  position: "relative",
  boxSizing: "border-box",
  color: "#f4f4f5",
  marginBottom: "env(safe-area-inset-bottom, 0px)"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingBottom: "12px"
};

const dragHandlePill = {
  width: "36px",
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "rgba(255, 255, 255, 0.2)"
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
  transition: "background 0.2s ease"
};

const headerSection = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  marginBottom: "18px"
};

const iconBadgeRose = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  backgroundColor: "rgba(244, 63, 94, 0.12)",
  border: "1px solid rgba(244, 63, 94, 0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "12px"
};

const modalTitle = {
  fontSize: "19px",
  fontWeight: "800",
  color: "#f4f4f5",
  margin: "0 0 6px 0",
  letterSpacing: "-0.01em"
};

const modalSubtitle = {
  fontSize: "13px",
  color: "#a1a1aa",
  margin: 0,
  lineHeight: "1.45",
  maxWidth: "360px"
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: "600",
  color: "#a1a1aa",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em"
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
  padding: "12px 14px 12px 42px",
  backgroundColor: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  color: "#f4f4f5",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box"
};

const emailPreviewCard = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  backgroundColor: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  width: "100%",
  boxSizing: "border-box"
};

const changeBtnStyle = {
  background: "rgba(255, 255, 255, 0.08)",
  border: "none",
  color: "#e4e4e7",
  fontSize: "12px",
  fontWeight: "600",
  padding: "5px 10px",
  borderRadius: "6px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center"
};

const otpInputStyle = {
  width: "100%",
  padding: "12px 14px",
  backgroundColor: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  color: "#f4f4f5",
  fontSize: "22px",
  fontWeight: "800",
  letterSpacing: "8px",
  textAlign: "center",
  fontFamily: "monospace",
  outline: "none",
  boxSizing: "border-box"
};

const primaryActionBtn = {
  width: "100%",
  padding: "12px",
  backgroundColor: "#f43f5e",
  border: "none",
  borderRadius: "12px",
  color: "#ffffff",
  fontWeight: "700",
  fontSize: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
  boxShadow: "0 2px 12px rgba(225, 29, 72, 0.25)"
};

const resendBtnStyle = {
  background: "none",
  border: "none",
  color: "#f43f5e",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  padding: "4px"
};

const errorBanner = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  backgroundColor: "rgba(239, 68, 68, 0.1)",
  border: "1px solid rgba(239, 68, 68, 0.25)",
  borderRadius: "10px",
  padding: "10px 12px",
  color: "#fca5a5",
  fontSize: "13px",
  marginBottom: "12px"
};

const successBanner = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  backgroundColor: "rgba(16, 185, 129, 0.1)",
  border: "1px solid rgba(16, 185, 129, 0.25)",
  borderRadius: "10px",
  padding: "10px 12px",
  color: "#6ee7b7",
  fontSize: "13px",
  marginBottom: "12px"
};
