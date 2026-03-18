import { useState, useEffect, useCallback, useRef } from "react";

export function useVideos(currentCategory, limit = 12) {
  const [videos, setVideos] = useState([]);
  const [sidebarSuggestions, setSidebarSuggestions] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const isFetching = useRef(false);

  const fetchData = useCallback(async (targetPage, isNew) => {
    if (isFetching.current) return;
    
    isFetching.current = true;
    setLoading(true);

    try {
      let url = `https://videos.naijahomemade.com/api/videos?page=${targetPage}&limit=${limit}&category=${currentCategory}`;
      if (currentCategory === "trends") url += `&sort=trending`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data?.videos) {
        setVideos(prev => {
          const combined = isNew ? data.videos : [...prev, ...data.videos];
          const uniqueMap = new Map();
          combined.forEach(v => uniqueMap.set(`${v.chat_id}:${v.message_id}`, v));
          return Array.from(uniqueMap.values());
        });
        
        // 🟢 THE FIX: The math is simple again. If the server couldn't fill the limit, we hit the end!
        if (data.videos.length < limit) {
            setHasMore(false);
        } else {
            setHasMore(true);
        }
        setPage(targetPage + 1);
      }
    } catch (err) { 
      console.error("Fetch Error:", err); 
    } finally { 
      setLoading(false); 
      isFetching.current = false; 
    }
  }, [currentCategory, limit]);

  useEffect(() => {
    isFetching.current = false; 
    setHasMore(true);
    setVideos([]); 
    setPage(1);
    fetchData(1, true);
  }, [currentCategory, fetchData]);

  return { 
    videos, 
    sidebarSuggestions, 
    loading, 
    hasMore,
    loadMore: () => {
        if (!loading && hasMore) fetchData(page, false);
    }
  };
}