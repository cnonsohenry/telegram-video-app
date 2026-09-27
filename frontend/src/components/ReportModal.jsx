import React, { useState } from "react";
import { X, Flag, AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { APP_CONFIG } from "../config";
import { showToast } from "../utils/toast";

export default function ReportModal({ isOpen, onClose, video }) {
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

    setSubmitting(true);
    const token = localStorage.getItem("token");

    try {
      const messageId = video.message_id || video.id;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/videos/${encodeURIComponent(messageId)}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          reason,
          details: details.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit report");
      }

      setSubmitted(true);
      showToast(data.message || "Report submitted. Thank you for keeping our community safe.", "success");
      setTimeout(() => {
        setSubmitted(false);
        setDetails("");
        setReason("inappropriate");
        onClose();
      }, 1500);
    } catch (err) {
      showToast(err.message || "Failed to submit report. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Flag size={18} color="#fe2c55" />
            <h3 style={modalTitle}>Report Video</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={closeBtn}
            aria-label="Close report modal"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div style={successContainer}>
            <CheckCircle2 size={42} color="#00ba7c" />
            <h4 style={{ color: "#fff", fontSize: "17px", fontWeight: "700", marginTop: "12px", marginBottom: "6px" }}>
              Report Received
            </h4>
            <p style={{ color: "#71767b", fontSize: "13.5px", margin: 0, textAlign: "center", lineHeight: "1.4" }}>
              Our moderation team will review this content against our Community Guidelines.
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
                      border: isSelected ? "1px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: isSelected ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.02)"
                    }}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={item.id}
                      checked={isSelected}
                      onChange={() => setReason(item.id)}
                      style={{ accentColor: "#ffffff", marginTop: "2px" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: isSelected ? "700" : "500", color: "#fff" }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: "11.5px", color: "#71767b", lineHeight: "1.3" }}>
                        {item.desc}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Additional details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", color: "#71767b", fontWeight: "600" }}>
                Additional Details (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                placeholder="Provide any additional context for moderators..."
                rows={3}
                style={detailsTextarea}
              />
            </div>

            {/* Actions */}
            <div style={actionRow}>
              <button
                type="button"
                onClick={onClose}
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
    </div>
  );
}

const modalBackdrop = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 99999,
  padding: "16px"
};

const modalBox = {
  background: "#000000",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "16px",
  width: "100%",
  maxWidth: "460px",
  padding: "20px",
  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)",
  boxSizing: "border-box"
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
  color: "#fff",
  margin: 0
};

const closeBtn = {
  background: "none",
  border: "none",
  color: "#71767b",
  cursor: "pointer",
  padding: "4px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const subText = {
  color: "#e7e9ea",
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
  background: "#16181c",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "8px",
  padding: "10px 12px",
  color: "#ffffff",
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
  marginTop: "4px"
};

const cancelBtn = {
  background: "transparent",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  color: "#ffffff",
  padding: "9px 18px",
  borderRadius: "9999px",
  fontSize: "13.5px",
  fontWeight: "600",
  cursor: "pointer"
};

const submitBtn = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "#ffffff",
  border: "none",
  color: "#000000",
  padding: "9px 20px",
  borderRadius: "9999px",
  fontSize: "13.5px",
  fontWeight: "700",
  cursor: "pointer"
};

const successContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "24px 16px"
};
