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

        // Support both grouped creators and flat stories array
        if (Array.isArray(data.creators)) {
          data.creators.forEach((c) => {
            if (c.username) {
              map[String(c.username).toLowerCase().trim()] = c;
            }
          });
        } else if (Array.isArray(data.stories)) {
          data.stories.forEach((s) => {
            if (s.username) {
              const uname = String(s.username).toLowerCase().trim();
              if (!map[uname]) {
                map[uname] = {
                  creator_id: s.creator_id,
                  username: s.username,
                  display_name: s.display_name,
                  avatar_url: s.avatar_url,
                  is_verified: s.is_verified,
                  stories: [],
                  has_viewed_all: true
                };
              }
              map[uname].stories.push(s);
              if (!s.has_viewed) {
                map[uname].has_viewed_all = false;
              }
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
          const existing = prev[key];
          if (!existing) return prev;
          const updatedStories = (existing.stories || []).map((s) =>
            s.id === storyId ? { ...s, has_viewed: true } : s
          );
          const allViewed =
            updatedStories.length > 0 &&
            updatedStories.every((s) => s.has_viewed || (storyId && s.id === storyId));
          return {
            ...prev,
            [key]: {
              ...existing,
              stories: updatedStories,
              has_viewed_all: allViewed
            }
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
      const creatorInfo = storiesMap[key];
      if (!creatorInfo) return false;
      if (Array.isArray(creatorInfo.stories)) return creatorInfo.stories.length > 0;
      return true;
    },
    [storiesMap]
  );

  // Helper: check if user has viewed ALL active stories of this creator
  const isStoryViewed = useCallback(
    (username) => {
      if (!username) return false;
      const key = String(username).replace(/^@/, "").toLowerCase().trim();
      const creatorInfo = storiesMap[key];
      if (!creatorInfo) return false;

      // If active stories array exists, require every story to be viewed
      if (Array.isArray(creatorInfo.stories) && creatorInfo.stories.length > 0) {
        return creatorInfo.stories.every(
          (s) => s.has_viewed || localViewedIds.has(s.id)
        );
      }
      if (creatorInfo.has_viewed_all !== undefined) return creatorInfo.has_viewed_all;
      if (creatorInfo.has_viewed) return true;
      if (creatorInfo.id && localViewedIds.has(creatorInfo.id)) return true;
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

  // Open story handler with auth check - always fetches fresh authenticated story sequence
  const openStory = useCallback(
    async (username, fallbackCreator = null) => {
      const token = localStorage.getItem("token");
      if (!token) {
        promptLogin("view story");
        return;
      }

      const cleanUname = String(username || "").replace(/^@/, "").trim();
      if (!cleanUname) return;

      const cached = storiesMap[cleanUname.toLowerCase()];

      // 1. Fetch fresh authenticated stories from backend to guarantee latest sequence
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(cleanUname)}/story`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.has_active_story && (Array.isArray(data.stories) || data.story)) {
            const storiesList = Array.isArray(data.stories) && data.stories.length > 0
              ? data.stories
              : [data.story];
            
            const firstStory = data.story || storiesList[0];

            setActiveStoryModal({
              stories: storiesList,
              story: firstStory,
              creator: fallbackCreator || {
                username: cleanUname,
                display_name: firstStory?.display_name || cached?.display_name || cleanUname,
                avatar_url: firstStory?.avatar_url || cached?.avatar_url
              }
            });

            // Update map with fresh stories
            setStoriesMap((prev) => ({
              ...prev,
              [cleanUname.toLowerCase()]: {
                ...(prev[cleanUname.toLowerCase()] || {}),
                stories: storiesList,
                has_viewed_all: Boolean(data.has_viewed_all)
              }
            }));
            return;
          }
        }
      } catch (err) {
        console.warn("[OPEN STORY FETCH NOTICE]", err);
      }

      // 2. Fallback to cached in memory if network request fails
      if (cached) {
        const cachedStories = Array.isArray(cached.stories) && cached.stories.length > 0
          ? cached.stories
          : (cached.video_url ? [cached] : []);

        if (cachedStories.length > 0) {
          setActiveStoryModal({
            stories: cachedStories,
            story: cachedStories[0],
            creator: fallbackCreator || {
              username: cleanUname,
              display_name: cached.display_name || cleanUname,
              avatar_url: cached.avatar_url
            }
          });
        }
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

      {/* Global Multi-Story Player Modal */}
      {activeStoryModal && (
        <StoryPlayerModal
          isOpen={Boolean(activeStoryModal)}
          onClose={closeStory}
          stories={activeStoryModal.stories || (activeStoryModal.story ? [activeStoryModal.story] : [])}
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
