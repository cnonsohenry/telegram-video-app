import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { APP_CONFIG } from "../config";
import { promptLogin } from "../utils/toast";
import StoryPlayerModal from "../components/StoryPlayerModal";

const StoryContext = createContext(null);

export function StoryProvider({ children }) {
  const [storiesMap, setStoriesMap] = useState({});
  const [localViewedIds, setLocalViewedIds] = useState(new Set());
  const [activeStoryModal, setActiveStoryModal] = useState(null);

  // 1. Load locally cached viewed stories for instant responsiveness
  const refreshLocalViews = useCallback(() => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userId = payload?.id;
        if (userId) {
          const storageKey = `viewed_stories_${userId}`;
          const views = JSON.parse(localStorage.getItem(storageKey) || "[]");
          setLocalViewedIds(new Set(views));
        }
      } else {
        setLocalViewedIds(new Set());
      }
    } catch (e) {
      setLocalViewedIds(new Set());
    }
  }, []);

  // 2. Fetch active stories from backend
  const fetchActiveStories = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/stories/active`, { headers });
      if (res.ok) {
        const data = await res.json();
        const map = {};
        if (Array.isArray(data.stories)) {
          data.stories.forEach((s) => {
            if (s.username) {
              map[String(s.username).toLowerCase().trim()] = s;
            }
          });
        }
        setStoriesMap(map);
      }
    } catch (err) {
      console.warn("[STORY CONTEXT FETCH NOTICE]", err);
    }
  }, []);

  useEffect(() => {
    refreshLocalViews();
    fetchActiveStories();

    // Periodic refresh every 60s
    const interval = setInterval(fetchActiveStories, 60000);

    // Refresh on tab visibility
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchActiveStories();
        refreshLocalViews();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Refresh on user change
    const handleRefreshUser = () => {
      refreshLocalViews();
      fetchActiveStories();
    };
    window.addEventListener("refreshUser", handleRefreshUser);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("refreshUser", handleRefreshUser);
    };
  }, [fetchActiveStories, refreshLocalViews]);

  // 3. Listen to live storyViewed event
  useEffect(() => {
    const handleStoryViewed = (e) => {
      const { storyId, username } = e.detail || {};
      if (storyId) {
        setLocalViewedIds((prev) => new Set([...prev, storyId]));
      }
      if (username) {
        const key = String(username).toLowerCase().trim();
        setStoriesMap((prev) => {
          if (!prev[key]) return prev;
          return {
            ...prev,
            [key]: { ...prev[key], has_viewed: true }
          };
        });
      }
    };
    window.addEventListener("storyViewed", handleStoryViewed);
    return () => window.removeEventListener("storyViewed", handleStoryViewed);
  }, []);

  // Helper: check if a creator has active story
  const hasActiveStory = useCallback(
    (username) => {
      if (!username) return false;
      const key = String(username).replace(/^@/, "").toLowerCase().trim();
      return Boolean(storiesMap[key]);
    },
    [storiesMap]
  );

  // Helper: check if user has viewed the story
  const isStoryViewed = useCallback(
    (username) => {
      if (!username) return false;
      const key = String(username).replace(/^@/, "").toLowerCase().trim();
      const s = storiesMap[key];
      if (!s) return false;
      if (s.has_viewed) return true;
      if (s.id && localViewedIds.has(s.id)) return true;
      return false;
    },
    [storiesMap, localViewedIds]
  );

  const getStory = useCallback(
    (username) => {
      if (!username) return null;
      const key = String(username).replace(/^@/, "").toLowerCase().trim();
      return storiesMap[key] || null;
    },
    [storiesMap]
  );

  // Open story handler with auth check
  const openStory = useCallback(
    async (username, fallbackCreator = null) => {
      const token = localStorage.getItem("token");
      if (!token) {
        promptLogin("view story");
        return;
      }

      const cleanUname = String(username || "").replace(/^@/, "").trim();
      const cached = storiesMap[cleanUname.toLowerCase()];

      // If cached story has video_url:
      if (cached?.video_url) {
        setActiveStoryModal({
          story: cached,
          creator: fallbackCreator || {
            username: cleanUname,
            display_name: cached.display_name,
            avatar_url: cached.avatar_url
          }
        });
        return;
      }

      // Otherwise fetch authenticated story from API
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(cleanUname)}/story`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.has_active_story && data.story) {
            setActiveStoryModal({
              story: data.story,
              creator: fallbackCreator || {
                username: cleanUname,
                display_name: data.story.display_name || cached?.display_name,
                avatar_url: data.story.avatar_url || cached?.avatar_url
              }
            });
            // Update map
            setStoriesMap((prev) => ({
              ...prev,
              [cleanUname.toLowerCase()]: data.story
            }));
          }
        }
      } catch (err) {
        console.warn("[OPEN STORY FETCH NOTICE]", err);
      }
    },
    [storiesMap]
  );

  const closeStory = useCallback(() => {
    setActiveStoryModal(null);
  }, []);

  // 4. Global openStoryPlayer event listener
  useEffect(() => {
    const handleOpenEvent = (e) => {
      const { story, creator, username } = e.detail || {};
      openStory(username || creator?.username || story?.username, creator || story);
    };
    window.addEventListener("openStoryPlayer", handleOpenEvent);
    return () => window.removeEventListener("openStoryPlayer", handleOpenEvent);
  }, [openStory]);

  return (
    <StoryContext.Provider
      value={{
        storiesMap,
        hasActiveStory,
        isStoryViewed,
        getStory,
        openStory,
        fetchActiveStories,
        refreshLocalViews
      }}
    >
      {children}

      {/* Global Story Player Modal */}
      {activeStoryModal && (
        <StoryPlayerModal
          isOpen={Boolean(activeStoryModal)}
          onClose={closeStory}
          story={activeStoryModal.story}
          creator={activeStoryModal.creator}
        />
      )}
    </StoryContext.Provider>
  );
}

export function useActiveStories() {
  const context = useContext(StoryContext);
  if (!context) {
    return {
      storiesMap: {},
      hasActiveStory: () => false,
      isStoryViewed: () => false,
      getStory: () => null,
      openStory: () => {},
      fetchActiveStories: () => {},
      refreshLocalViews: () => {}
    };
  }
  return context;
}
