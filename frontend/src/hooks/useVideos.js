import { useState, useEffect, useCallback, useRef } from "react";

// 🟢 1. Added limit parameter with a default of 12
export function useVideos(currentCategory, limit = 12) {
  const [videos, setVideos] = useState([]);
  const [sidebarSuggestions, setSidebarSuggestions] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Ref to prevent race conditions
  const isFetching = useRef(false);

  // Main Data Fetcher
  const fetchData = useCallback(async (targetPage, isNew) => {
    // Prevent overlapping fetches
    if (isFetching.current) return;
    
    isFetching.current = true;
    setLoading(true);

    try {
      // 🟢 2. Dynamically inject the limit into the API request
      let url = `https://videos.naijahomemade.com/api/videos?page=${targetPage}&limit=${limit}&category=${currentCategory}`;
      if (currentCategory === "trends") url += `&sort=trending`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data?.videos) {
        setVideos(prev => {
          // If it's a new category/refresh, replace the array. Otherwise append.
          const combined = isNew ? data.videos : [...prev, ...data.videos];
          
          // Filter duplicates (Just in case)
          const uniqueMap = new Map();
          combined.forEach(v => uniqueMap.set(`${v.chat_id}:${v.message_id}`, v));
          return Array.from(uniqueMap.values());
        });
        
        // Save sidebar suggestions if provided (only on first page)
        if (targetPage === 1 && data.suggestions) {
          setSidebarSuggestions(data.suggestions);
        }
        
        // 🟢 3. Update pagination check to use the dynamic limit
        if (data.videos.length < limit) {
            setHasMore(false);
        }

        setPage(targetPage + 1);
      }
    } catch (err) { 
      console.error("Fetch Error:", err); 
    } finally { 
      setLoading(false); 
      isFetching.current = false; 
    }
  }, [currentCategory, limit]); // 🟢 4. Added limit to dependency array

  // Initial Load Effect (LOOP PROOF)
  useEffect(() => {
    // Reset state specifically for the new category
    isFetching.current = false; // Reset lock
    setHasMore(true);
    setVideos([]); // Visual reset
    setPage(1);
    
    // Trigger the first fetch
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