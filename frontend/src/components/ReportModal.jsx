import React, { useState, useEffect } from "react";
import { X, Flag, AlertTriangle, CheckCircle2, Loader2, ShieldAlert, MailCheck, LogIn } from "lucide-react";
import { APP_CONFIG } from "../config";
import { showToast, promptLogin } from "../utils/toast";
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
      showToast("Please verify your email address in Settings before submitting reports.", "warning");
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
    <div style={modalBackdrop} onClick={handleSafeClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Top Drag Handle Indicator */}
        <div style={dragHandleWrapper}>
          <div style={dragHandlePill} />
        </div>

        {/* Header */}
        <div style={modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Flag size={18} color="#f43f5e" />
            <h3 style={modalTitle}>Report Post</h3>
          </div>
          <button 
            type="button" 
            onClick={handleSafeClose} 
            style={closeBtn}
            aria-label="Close report modal"
          >
            <X size={18} />
          </button>
        </div>

        {checkingAuth ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
            <Loader2 size={32} color="#f43f5e" className="animate-spin" />
            <p style={{ color: "#71717a", fontSize: "13px", marginTop: "12px" }}>Checking verification status...</p>
          </div>
        ) : !currentUser ? (
          /* 🛑 Guest Prompt: Login Required */
          <div style={authPromptContainer}>
            <div style={iconBadgeRose}>
              <LogIn size={28} color="#f43f5e" />
            </div>
            <h4 style={authPromptTitle}>Account Required</h4>
            <p style={authPromptDesc}>
              To prevent abuse and maintain community safety, only registered and email-verified members can submit moderation reports.
            </p>
            <div style={actionRowFull}>
              <button
                type="button"
                onClick={() => {
                  handleSafeClose();
                  promptLogin("report");
                }}
                style={primaryActionBtn}
              >
                Log In or Sign Up
              </button>
              <button
                type="button"
                onClick={handleSafeClose}
                style={secondaryActionBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !isEmailVerified ? (
          /* 🛑 Unverified Account: Email Verification Required */
          <div style={authPromptContainer}>
            <div style={iconBadgeAmber}>
              <MailCheck size={28} color="#fbbf24" />
            </div>
            <h4 style={authPromptTitle}>Email Verification Required</h4>
            <p style={authPromptDesc}>
              Your account <strong>({currentUser.email || currentUser.username})</strong> must have a verified email address before you can flag or report content.
            </p>
            <div style={{ ...warningCard, marginBottom: "20px" }}>
              <AlertTriangle size={16} color="#fbbf24" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span style={{ fontSize: "12.5px", color: "#d4d4d8", lineHeight: "1.4" }}>
                Check your inbox for your verification OTP code, or verify your address in your Profile Settings.
              </span>
            </div>
            <div style={actionRowFull}>
              <button
                type="button"
                onClick={() => {
                  handleSafeClose();
                  window.dispatchEvent(new CustomEvent("openSettings"));
                }}
                style={primaryActionBtn}
              >
                Go to Settings & Verify
              </button>
              <button
                type="button"
                onClick={handleSafeClose}
                style={secondaryActionBtn}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : submitted ? (
          <div style={successContainer}>
            <CheckCircle2 size={44} color="#10b981" />
            <h4 style={{ color: "#f4f4f5", fontSize: "17px", fontWeight: "700", marginTop: "14px", marginBottom: "6px" }}>
              Report Received
            </h4>
            <p style={{ color: "#a1a1aa", fontSize: "13px", margin: 0, textAlign: "center", lineHeight: "1.4" }}>
              Thank you. Our moderation team will review this content against our Community Guidelines.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={subText}>
              Why are you reporting this video by <strong>@{video.uploader_handle || video.uploader_name || "creator"}</strong>?
            </p>

            {/* Reasons List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {reportReasons.map((item) => {
                const isSelected = reason === item.id;
                return (
                  <label
                    key={item.id}
                    style={{
                      ...reasonOption,
                      border: isSelected ? "1px solid #f43f5e" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: isSelected ? "rgba(244, 63, 94, 0.08)" : "rgba(255, 255, 255, 0.02)"
                    }}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={item.id}
                      checked={isSelected}
                      onChange={() => setReason(item.id)}
                      style={{ accentColor: "#f43f5e", marginTop: "2px" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: isSelected ? "700" : "500", color: "#f4f4f5" }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: "11.5px", color: "#a1a1aa", lineHeight: "1.3" }}>
                        {item.desc}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Additional details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: "600" }}>
                Additional Details (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                placeholder="Provide any specific context or timestamps for moderators..."
                rows={3}
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
              >
                Cancel
              </button>
              <button
                type="submit"
                style={submitBtn}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
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
        @keyframes reportSheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes reportBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.72)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  alignItems: "center",
  zIndex: 1000060,
  animation: "reportBackdropFade 0.2s ease"
};

const modalBox = {
  background: "#18181b",
  border: "none",
  borderRadius: "24px 24px 0 0",
  width: "100%",
  maxWidth: "480px",
  padding: "10px 18px max(24px, env(safe-area-inset-bottom, 24px))",
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.85)",
  boxSizing: "border-box",
  maxHeight: "88vh",
  overflowY: "auto",
  animation: "reportSheetSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingTop: "2px",
  paddingBottom: "10px",
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
  paddingBottom: "10px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
};

const modalTitle = {
  fontSize: "17px",
  fontWeight: "800",
  color: "#f4f4f5",
  margin: 0
};

const closeBtn = {
  background: "rgba(255, 255, 255, 0.08)",
  border: "none",
  color: "#a1a1aa",
  cursor: "pointer",
  padding: "6px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const subText = {
  color: "#f4f4f5",
  fontSize: "13.5px",
  margin: "0 0 4px 0",
  lineHeight: "1.4"
};

const reasonOption = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  padding: "10px 12px",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "all 0.15s ease"
};

const detailsTextarea = {
  width: "100%",
  background: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "8px",
  padding: "10px 12px",
  color: "#f4f4f5",
  fontSize: "13px",
  resize: "none",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit"
};

const actionRow = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "6px"
};

const cancelBtn = {
  background: "#27272a",
  border: "none",
  color: "#f4f4f5",
  padding: "11px 20px",
  borderRadius: "9999px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer"
};

const submitBtn = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "#f43f5e",
  border: "none",
  color: "#ffffff",
  padding: "11px 24px",
  borderRadius: "9999px",
  fontSize: "14px",
  fontWeight: "800",
  cursor: "pointer"
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
  padding: "20px 10px 10px 10px"
};

const authPromptTitle = {
  margin: "12px 0 6px 0",
  color: "#f4f4f5",
  fontSize: "17px",
  fontWeight: "800"
};

const authPromptDesc = {
  margin: "0 0 16px 0",
  color: "#a1a1aa",
  fontSize: "13px",
  lineHeight: "1.5",
  maxWidth: "380px"
};

const iconBadgeRose = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  background: "rgba(244, 63, 94, 0.12)",
  border: "1px solid rgba(244, 63, 94, 0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const iconBadgeAmber = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  background: "rgba(245, 158, 11, 0.12)",
  border: "1px solid rgba(245, 158, 11, 0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const warningCard = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  background: "rgba(245, 158, 11, 0.08)",
  border: "1px solid rgba(245, 158, 11, 0.2)",
  borderRadius: "10px",
  padding: "10px 14px",
  textAlign: "left",
  width: "100%",
  boxSizing: "border-box"
};

const actionRowFull = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  width: "100%",
  marginTop: "8px"
};

const primaryActionBtn = {
  width: "100%",
  padding: "12px",
  background: "#f43f5e",
  border: "none",
  borderRadius: "10px",
  color: "#ffffff",
  fontWeight: "700",
  fontSize: "14px",
  cursor: "pointer"
};

const secondaryActionBtn = {
  width: "100%",
  padding: "12px",
  background: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "10px",
  color: "#f4f4f5",
  fontWeight: "600",
  fontSize: "14px",
  cursor: "pointer"
};
