import React, { useState, useEffect } from "react";
import { X, Flag, AlertTriangle, CheckCircle2, Loader2, ShieldAlert, MailCheck, LogIn, ArrowRight } from "lucide-react";
import { APP_CONFIG } from "../config";
import { showToast, promptLogin, promptEmailVerification } from "../utils/toast";
import useModalHistory from "../hooks/useModalHistory";

export default function ReportModal({ isOpen, onClose, video }) {
  const handleSafeClose = useModalHistory(isOpen && Boolean(video), onClose, "reportModal");
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Authentication & Email Verification State
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth >= 640 : false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setCurrentUser(null);
      setCheckingAuth(false);
      return;
    }

    setCheckingAuth(true);
    fetch(`${APP_CONFIG.apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setCurrentUser(data);
        setCheckingAuth(false);
      })
      .catch(() => {
        setCurrentUser(null);
        setCheckingAuth(false);
      });
  }, [isOpen]);

  if (!isOpen || !video) return null;

  const reportReasons = [
    { id: "inappropriate", label: "Prohibited / Illegal Content", desc: "Non-consensual media, extreme content, or illegal material" },
    { id: "copyright", label: "Stolen / Copyright Violation", desc: "Content re-uploaded without original creator's consent" },
    { id: "spam", label: "Spam or Scam", desc: "Bot posts, external scam links, or malicious promotion" },
    { id: "harassment", label: "Harassment or Hate Speech", desc: "Targeted harassment, bullying, or abusive behavior" },
    { id: "other", label: "Other Violation", desc: "Other terms of service violation" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) return;

    const token = localStorage.getItem("token");
    if (!token) {
      handleSafeClose();
      promptLogin("report");
      return;
    }

    if (!currentUser?.email_verified && currentUser?.role !== "admin") {
      promptEmailVerification({
        reason: "report",
        email: currentUser?.email,
        onVerified: () => {
          showToast("Email verified! You can now submit your report.", "success");
        }
      });
      return;
    }

    setSubmitting(true);

    try {
      const messageId = video.message_id || video.id;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/videos/${encodeURIComponent(messageId)}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reason,
          details: details.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requires_email_verification) {
          showToast(data.error || "Email verification required to report posts.", "warning");
        } else {
          throw new Error(data.error || "Failed to submit report");
        }
        return;
      }

      setSubmitted(true);
      showToast(data.message || "Report submitted. Thank you for keeping our community safe.", "success");
      setTimeout(() => {
        setSubmitted(false);
        setDetails("");
        setReason("inappropriate");
        handleSafeClose();
      }, 1600);
    } catch (err) {
      showToast(err.message || "Failed to submit report. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isEmailVerified = Boolean(currentUser?.email_verified || currentUser?.role === "admin");

  return (
    <div 
      style={{
        ...modalBackdrop,
        alignItems: isDesktop ? "center" : "flex-end"
      }} 
      onClick={handleSafeClose}
    >
      <div 
        style={{
          ...modalBox,
          borderRadius: isDesktop ? "22px" : "24px 24px 0 0",
          border: isDesktop ? "1px solid rgba(255, 255, 255, 0.08)" : "none",
          animation: isDesktop ? "promptFadeScale 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "promptSlideUp 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drag Handle Indicator for Mobile */}
        {!isDesktop && (
          <div style={dragHandleWrapper}>
            <div style={dragHandlePill} />
          </div>
        )}

        {/* Header */}
        <div style={modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Flag size={17} color="#fb7185" />
            <h3 style={modalTitle}>Report Post</h3>
          </div>
          <button 
            type="button" 
            onClick={handleSafeClose} 
            style={closeBtn}
            aria-label="Close report modal"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.06)"}
          >
            <X size={17} />
          </button>
        </div>

        {checkingAuth ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
            <Loader2 size={28} color="#38bdf8" className="spin-animation" />
            <p style={{ color: "#71717a", fontSize: "13px", marginTop: "12px" }}>Checking status...</p>
          </div>
        ) : !currentUser ? (
          /* 🛑 Guest Prompt: Login Required */
          <div style={authPromptContainer}>
            <div style={iconBadgeSleek}>
              <LogIn size={22} color="#38bdf8" />
            </div>
            <h4 style={authPromptTitle}>Account Required</h4>
            <p style={authPromptDesc}>
              To prevent abuse and maintain community safety, only registered and verified members can submit reports.
            </p>
            <div style={actionRowFull}>
              <button
                type="button"
                onClick={() => {
                  handleSafeClose();
                  promptLogin("report");
                }}
                style={primaryActionBtn}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#f4f4f5"}
              >
                Log In or Sign Up
                <ArrowRight size={15} style={{ marginLeft: "6px" }} />
              </button>
              <button
                type="button"
                onClick={handleSafeClose}
                style={secondaryActionBtn}
                onMouseEnter={(e) => e.currentTarget.style.color = "#f4f4f5"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#71717a"}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !isEmailVerified ? (
          /* 🛑 Unverified Account: Email Verification Required */
          <div style={authPromptContainer}>
            <div style={iconBadgeAmber}>
              <MailCheck size={22} color="#fbbf24" />
            </div>
            <h4 style={authPromptTitle}>Email Verification Required</h4>
            <p style={authPromptDesc}>
              Please verify your email address to ensure account authenticity before reporting content.
            </p>
            <div style={actionRowFull}>
              <button
                type="button"
                onClick={() => {
                  handleSafeClose();
                  promptEmailVerification({
                    reason: "report",
                    email: currentUser?.email,
                    onVerified: () => {
                      showToast("Email verified! You can now submit your report.", "success");
                    }
                  });
                }}
                style={primaryActionBtn}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#f4f4f5"}
              >
                Verify Email Now
              </button>
              <button
                type="button"
                onClick={handleSafeClose}
                style={secondaryActionBtn}
                onMouseEnter={(e) => e.currentTarget.style.color = "#f4f4f5"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#71717a"}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : submitted ? (
          <div style={successContainer}>
            <CheckCircle2 size={36} color="#34d399" />
            <h4 style={{ color: "#f4f4f5", fontSize: "16px", fontWeight: "700", marginTop: "12px", marginBottom: "4px" }}>
              Report Received
            </h4>
            <p style={{ color: "#a1a1aa", fontSize: "12.5px", margin: 0, textAlign: "center", lineHeight: "1.4" }}>
              Thank you. Our moderation team will review this content against our Community Guidelines.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={subText}>
              Why are you reporting this post by <strong>@{video.uploader_handle || video.uploader_name || "creator"}</strong>?
            </p>

            {/* Reasons List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {reportReasons.map((item) => {
                const isSelected = reason === item.id;
                return (
                  <label
                    key={item.id}
                    style={{
                      ...reasonOption,
                      border: isSelected ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid rgba(255, 255, 255, 0.05)",
                      background: isSelected ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.02)"
                    }}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={item.id}
                      checked={isSelected}
                      onChange={() => setReason(item.id)}
                      style={{ accentColor: "#f4f4f5", marginTop: "2px" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "13px", fontWeight: isSelected ? "600" : "500", color: "#f4f4f5" }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: "11.5px", color: "#71717a", lineHeight: "1.3" }}>
                        {item.desc}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Additional details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "#71717a", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Additional Details (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                placeholder="Provide timestamps or specific details..."
                rows={2}
                style={detailsTextarea}
              />
            </div>

            {/* Actions */}
            <div style={actionRow}>
              <button
                type="button"
                onClick={handleSafeClose}
                style={cancelBtn}
                disabled={submitting}
                onMouseEnter={(e) => e.currentTarget.style.color = "#f4f4f5"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#71717a"}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={submitBtn}
                disabled={submitting}
                onMouseEnter={(e) => {
                  if (!submitting) e.currentTarget.style.backgroundColor = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  if (!submitting) e.currentTarget.style.backgroundColor = "#f4f4f5";
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="spin-animation" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Report</span>
                )}
              </button>
            </div>
          </form>
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
}

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.65)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  display: "flex",
  justifyContent: "center",
  zIndex: 1000060,
  padding: 0
};

const modalBox = {
  background: "#18181b",
  border: "none",
  width: "100%",
  maxWidth: "420px",
  padding: "16px 20px max(24px, env(safe-area-inset-bottom, 24px))",
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.6), 0 20px 60px rgba(0, 0, 0, 0.7)",
  boxSizing: "border-box",
  maxHeight: "90vh",
  overflowY: "auto"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingBottom: "12px",
  cursor: "grab"
};

const dragHandlePill = {
  width: "36px",
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "rgba(255, 255, 255, 0.16)"
};

const modalHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "12px",
  paddingBottom: "8px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
};

const modalTitle = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#f4f4f5",
  margin: 0,
  letterSpacing: "-0.01em"
};

const closeBtn = {
  background: "rgba(255, 255, 255, 0.06)",
  border: "none",
  color: "#a1a1aa",
  cursor: "pointer",
  width: "30px",
  height: "30px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.15s ease"
};

const subText = {
  color: "#a1a1aa",
  fontSize: "13px",
  margin: "0 0 2px 0",
  lineHeight: "1.4"
};

const reasonOption = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  padding: "9px 12px",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "all 0.15s ease"
};

const detailsTextarea = {
  width: "100%",
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "10px",
  padding: "9px 12px",
  color: "#f4f4f5",
  fontSize: "13px",
  resize: "none",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.15s ease"
};

const actionRow = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "10px",
  marginTop: "4px"
};

const cancelBtn = {
  background: "transparent",
  border: "none",
  color: "#71717a",
  padding: "10px 16px",
  borderRadius: "9999px",
  fontSize: "13px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "color 0.15s ease"
};

const submitBtn = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "#f4f4f5",
  border: "none",
  color: "#09090b",
  padding: "10px 20px",
  borderRadius: "9999px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
  transition: "all 0.15s ease"
};

const successContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "24px 16px"
};

const authPromptContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  padding: "16px 8px 8px 8px"
};

const authPromptTitle = {
  margin: "0 0 6px 0",
  color: "#f4f4f5",
  fontSize: "17px",
  fontWeight: "700",
  letterSpacing: "-0.01em"
};

const authPromptDesc = {
  margin: "0 0 16px 0",
  color: "#a1a1aa",
  fontSize: "13px",
  lineHeight: "1.45",
  maxWidth: "340px"
};

const iconBadgeSleek = {
  width: "48px",
  height: "48px",
  borderRadius: "16px",
  background: "rgba(56, 189, 248, 0.08)",
  border: "1px solid rgba(56, 189, 248, 0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "12px",
  boxShadow: "0 4px 16px rgba(56, 189, 248, 0.06)"
};

const iconBadgeAmber = {
  width: "48px",
  height: "48px",
  borderRadius: "16px",
  background: "rgba(251, 191, 36, 0.08)",
  border: "1px solid rgba(251, 191, 36, 0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "12px",
  boxShadow: "0 4px 16px rgba(251, 191, 36, 0.06)"
};

const actionRowFull = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  width: "100%",
  marginTop: "4px"
};

const primaryActionBtn = {
  width: "100%",
  padding: "12px",
  background: "#f4f4f5",
  border: "none",
  borderRadius: "9999px",
  color: "#09090b",
  fontWeight: "700",
  fontSize: "13.5px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.25)",
  transition: "all 0.15s ease"
};

const secondaryActionBtn = {
  width: "100%",
  padding: "10px",
  background: "transparent",
  border: "none",
  color: "#71717a",
  fontWeight: "500",
  fontSize: "13px",
  cursor: "pointer",
  transition: "color 0.15s ease"
};
