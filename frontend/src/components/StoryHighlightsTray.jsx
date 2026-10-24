import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useActiveStories } from "../context/StoryContext";
import { promptLogin, showToast } from "../utils/toast";
import { APP_CONFIG } from "../config";
import StoryArchiveModal from "./StoryArchiveModal";

export default function StoryHighlightsTray({
  highlights = [],
  creator,
  isOwner = false,
  onHighlightCreated,
  onHighlightDeleted,
  style = {}
}) {
  const { openCustomStories } = useActiveStories() || {};
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // If there are no highlights and the user is not the owner, do not show empty tray
  if (!isOwner && (!highlights || highlights.length === 0)) {
    return null;
  }

  const handleHighlightClick = (h) => {
    const token = localStorage.getItem("token");
    if (!token) {
      promptLogin("view highlights");
      return;
    }

    if (!h.stories || h.stories.length === 0) {
      showToast("No stories in this highlight", "info");
      return;
    }

    if (openCustomStories) {
      openCustomStories(h.stories, creator || {
        username: h.username,
        display_name: creator?.display_name || h.username,
        avatar_url: creator?.avatar_url || h.cover_url
      });
    } else {
      window.dispatchEvent(
        new CustomEvent("openStoryPlayer", {
          detail: {
            stories: h.stories,
            creator: creator || {
              username: h.username,
              display_name: creator?.display_name || h.username,
              avatar_url: creator?.avatar_url || h.cover_url
            }
          }
        })
      );
    }
  };

  const handleDeleteHighlight = async (e, h) => {
    e.stopPropagation();
    if (!isOwner || h.is_auto) return;

    if (!window.confirm(`Delete "${h.title}" highlight?`)) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    setDeletingId(h.id);
    try {
      const uname = creator?.username || h.username;
      const res = await fetch(
        `${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(uname)}/highlights/${h.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        showToast("Highlight removed", "info");
        if (onHighlightDeleted) {
          onHighlightDeleted(h.id);
        }
      } else {
        showToast("Failed to delete highlight", "error");
      }
    } catch (err) {
      console.error("[DELETE HIGHLIGHT ERROR]", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "18px",
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        padding: "4px 16px 14px 16px",
        boxSizing: "border-box",
        ...style
      }}
    >
      {/* 🟢 INSTAGRAM "+ New" BUTTON FOR CREATOR / OWNER */}
      {isOwner && (
        <div
          onClick={() => setShowArchiveModal(true)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            flexShrink: 0
          }}
          title="Create New Highlight"
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "#18181b",
              border: "1.5px solid rgba(255, 255, 255, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d4d4d8",
              transition: "transform 0.15s ease, border-color 0.15s ease",
              boxSizing: "border-box"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.04)";
              e.currentTarget.style.borderColor = "#0095f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.18)";
            }}
          >
            <Plus size={26} strokeWidth={2.2} />
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#d4d4d8",
              maxWidth: "68px",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            New
          </span>
        </div>
      )}

      {/* HIGHLIGHT ITEMS */}
      {highlights.map((h) => {
        const cover = h.cover_url || (h.stories && h.stories[0]?.thumbnail_url) || "/assets/default-avatar.png";

        return (
          <div
            key={h.id}
            onClick={() => handleHighlightClick(h)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              flexShrink: 0,
              position: "relative"
            }}
            title={h.title || "Highlights"}
          >
            {/* Highlight Circular Cover */}
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                padding: "2.5px",
                border: "1.5px solid rgba(255, 255, 255, 0.22)",
                boxSizing: "border-box",
                transition: "transform 0.15s ease, border-color 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.04)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.22)";
              }}
            >
              <img
                src={cover}
                alt={h.title}
                loading="lazy"
                decoding="async"
                onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  display: "block",
                  backgroundColor: "#18181b",
                  border: "1.5px solid #000"
                }}
              />
            </div>

            {/* Title */}
            <span
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#e4e4e7",
                maxWidth: "70px",
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {h.title || "Highlights"}
            </span>

            {/* Owner Delete Button */}
            {isOwner && !h.is_auto && (
              <button
                onClick={(e) => handleDeleteHighlight(e, h)}
                disabled={deletingId === h.id}
                title="Delete highlight"
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(0, 0, 0, 0.75)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        );
      })}

      {/* STORY ARCHIVE MODAL */}
      {showArchiveModal && (
        <StoryArchiveModal
          isOpen={showArchiveModal}
          onClose={() => setShowArchiveModal(false)}
          username={creator?.username}
          onHighlightCreated={(newHl) => {
            if (onHighlightCreated) {
              onHighlightCreated(newHl);
            }
          }}
        />
      )}
    </div>
  );
}
