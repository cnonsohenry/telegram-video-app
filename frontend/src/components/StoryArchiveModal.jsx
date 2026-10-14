import React, { useState, useEffect } from "react";
import { X, ArrowLeft, Check, Film, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";
import { showToast } from "../utils/toast";

export default function StoryArchiveModal({
  isOpen,
  onClose,
  username,
  onHighlightCreated
}) {
  const [step, setStep] = useState(1); // 1 = select stories, 2 = title & cover
  const [stories, setStories] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch story archive from backend
  useEffect(() => {
    if (!isOpen || !username) return;

    setStep(1);
    setSelectedIds([]);
    setTitle("");
    setCoverUrl("");
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchArchive = async () => {
      try {
        const res = await fetch(
          `${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(username)}/stories/archive`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (res.ok) {
          const data = await res.json();
          setStories(data.archive || []);
        } else {
          setStories([]);
        }
      } catch (err) {
        console.warn("[FETCH ARCHIVE ERROR]", err);
        setStories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchArchive();
  }, [isOpen, username]);

  if (!isOpen) return null;

  const toggleSelectStory = (storyId) => {
    setSelectedIds((prev) => {
      if (prev.includes(storyId)) {
        return prev.filter((id) => id !== storyId);
      } else {
        return [...prev, storyId];
      }
    });
  };

  const handleGoToStep2 = () => {
    if (selectedIds.length === 0) return;
    const firstSelected = stories.find((s) => s.id === selectedIds[0]);
    if (!coverUrl && firstSelected?.thumbnail_url) {
      setCoverUrl(firstSelected.thumbnail_url);
    }
    if (!title) {
      setTitle("Highlights");
    }
    setStep(2);
  };

  const handleSaveHighlight = async () => {
    if (selectedIds.length === 0 || saving) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    setSaving(true);
    try {
      const res = await fetch(
        `${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(username)}/highlights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title: title.trim() || "Highlights",
            cover_url: coverUrl || undefined,
            story_ids: selectedIds
          })
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Story Highlight created!", "success");
        if (onHighlightCreated) {
          onHighlightCreated(data.highlight);
        }
        onClose();
      } else {
        showToast(data.error || "Failed to create highlight", "error");
      }
    } catch (err) {
      console.error("[SAVE HIGHLIGHT ERROR]", err);
      showToast("Network error creating highlight", "error");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          height: "85vh",
          maxHeight: "720px",
          backgroundColor: "#18181b",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.9)",
          color: "#ffffff"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {step === 2 ? (
              <button
                onClick={() => setStep(1)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 0
                }}
              >
                <ArrowLeft size={22} />
              </button>
            ) : (
              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 0
                }}
              >
                <X size={22} />
              </button>
            )}
            <h2
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: "700",
                letterSpacing: "-0.2px"
              }}
            >
              {step === 1 ? "Story Archive" : "New Highlight"}
            </h2>
          </div>

          {step === 1 ? (
            <button
              onClick={handleGoToStep2}
              disabled={selectedIds.length === 0}
              style={{
                backgroundColor: selectedIds.length > 0 ? "#0095f6" : "rgba(255, 255, 255, 0.1)",
                color: selectedIds.length > 0 ? "#ffffff" : "rgba(255, 255, 255, 0.3)",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: selectedIds.length > 0 ? "pointer" : "default",
                transition: "all 0.2s ease"
              }}
            >
              Next {selectedIds.length > 0 && `(${selectedIds.length})`}
            </button>
          ) : (
            <button
              onClick={handleSaveHighlight}
              disabled={saving || !title.trim()}
              style={{
                backgroundColor: saving || !title.trim() ? "rgba(255, 255, 255, 0.1)" : "#0095f6",
                color: saving || !title.trim() ? "rgba(255, 255, 255, 0.3)" : "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: saving || !title.trim() ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Done"}
            </button>
          )}
        </div>

        {/* STEP 1: ARCHIVE STORY SELECTOR */}
        {step === 1 && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              boxSizing: "border-box"
            }}
          >
            <p
              style={{
                fontSize: "13px",
                color: "#a1a1aa",
                margin: "0 0 16px 0",
                lineHeight: "1.4"
              }}
            >
              Select stories from your archive to curate into a profile highlight reel.
            </p>

            {loading ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "300px",
                  gap: "12px",
                  color: "#a1a1aa"
                }}
              >
                <Loader2 size={28} className="animate-spin" />
                <span style={{ fontSize: "14px" }}>Loading stories...</span>
              </div>
            ) : stories.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "300px",
                  gap: "12px",
                  color: "#71717a",
                  textAlign: "center",
                  padding: "0 20px"
                }}
              >
                <Film size={40} strokeWidth={1.5} color="#52525b" />
                <span style={{ fontSize: "15px", fontWeight: "600", color: "#a1a1aa" }}>
                  No Archived Stories
                </span>
                <span style={{ fontSize: "13px", maxWidth: "280px" }}>
                  When you publish 24-hour status stories, they automatically save to your permanent archive upon expiration.
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px"
                }}
              >
                {stories.map((s) => {
                  const isSelected = selectedIds.includes(s.id);
                  const selIndex = selectedIds.indexOf(s.id) + 1;

                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSelectStory(s.id)}
                      style={{
                        position: "relative",
                        aspectRatio: "9/16",
                        borderRadius: "10px",
                        overflow: "hidden",
                        cursor: "pointer",
                        backgroundColor: "#27272a",
                        border: isSelected ? "2px solid #0095f6" : "1px solid rgba(255, 255, 255, 0.08)",
                        transition: "transform 0.15s ease",
                        boxSizing: "border-box"
                      }}
                    >
                      <img
                        src={s.thumbnail_url || "/assets/default-avatar.png"}
                        alt="Story"
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block"
                        }}
                      />

                      {/* Date Badge */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          left: "6px",
                          fontSize: "11px",
                          fontWeight: "600",
                          backgroundColor: "rgba(0, 0, 0, 0.65)",
                          color: "#ffffff",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backdropFilter: "blur(4px)"
                        }}
                      >
                        {formatDate(s.created_at)}
                      </div>

                      {/* Select Circle Indicator */}
                      <div
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          backgroundColor: isSelected ? "#0095f6" : "rgba(0, 0, 0, 0.45)",
                          border: isSelected ? "none" : "2px solid rgba(255, 255, 255, 0.8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: "700",
                          boxSizing: "border-box"
                        }}
                      >
                        {isSelected && selIndex}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: TITLE & COVER SELECTION */}
        {step === 2 && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
          >
            {/* Cover Preview Circle */}
            <div
              style={{
                width: "88px",
                height: "88px",
                borderRadius: "50%",
                padding: "3px",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                boxSizing: "border-box",
                marginBottom: "20px",
                position: "relative"
              }}
            >
              <img
                src={coverUrl || "/assets/default-avatar.png"}
                alt="Highlight Cover"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  display: "block"
                }}
              />
            </div>

            {/* Title Input */}
            <div style={{ width: "100%", marginBottom: "28px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "#a1a1aa",
                  marginBottom: "8px",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Highlight Name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 30))}
                placeholder="e.g. Vibes, Highlights, Vacation..."
                autoFocus
                style={{
                  width: "100%",
                  backgroundColor: "#27272a",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  color: "#ffffff",
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {/* Choose Cover Row */}
            <div style={{ width: "100%" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "#a1a1aa",
                  marginBottom: "10px",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Tap to Select Cover Story
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  overflowX: "auto",
                  paddingBottom: "8px"
                }}
              >
                {stories
                  .filter((s) => selectedIds.includes(s.id))
                  .map((s) => {
                    const isCover = coverUrl === s.thumbnail_url;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setCoverUrl(s.thumbnail_url)}
                        style={{
                          width: "60px",
                          height: "90px",
                          borderRadius: "8px",
                          overflow: "hidden",
                          flexShrink: 0,
                          cursor: "pointer",
                          position: "relative",
                          border: isCover ? "2.5px solid #0095f6" : "1.5px solid rgba(255, 255, 255, 0.1)",
                          boxSizing: "border-box"
                        }}
                      >
                        <img
                          src={s.thumbnail_url}
                          alt="Select Cover"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover"
                          }}
                        />
                        {isCover && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              backgroundColor: "rgba(0, 149, 246, 0.25)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            <Check size={18} color="#ffffff" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
