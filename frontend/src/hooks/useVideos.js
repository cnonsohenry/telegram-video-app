import { useState, useEffect, useCallback, useRef } from "react";

export function useVideos(currentCategory) {
  const [videos, setVideos] = useState([]);
  const [dashboardVideos, setDashboardVideos] = useState({});
  const [sidebarSuggestions, setSidebarSuggestions] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Ref to prevent double-fetching in React Strict Mode
  const isFetching = useRef(false);

  // 1. Fetch Top 4 from all categories for Mobile Home Dashboard
  const fetchDashboard = useCallback(async () => {
    try {
      const categories = ["knacks", "hotties", "baddies", "trends"];
      const results = {};
      
      // Fetch all 4 categories in parallel
      const responses = await Promise.all(
        categories.map(cat => 
          fetch(`https://videos.naijahomemade.com/api/videos?page=1&limit=4&category=${cat}`)
            .then(res => res.json())
        )
      );
      
      responses.forEach((data, i) => { 
        results[categories[i]] = data.videos || []; 
      });
      
      setDashboardVideos(results);
    } catch (err) { 
      console.error("Dashboard Fetch Error:", err); 
    }
  }, []);

  // 2. Main Data Fetcher for Grid/Explore
  const fetchData = useCallback(async (targetPage, isNew) => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);

    try {
      let url = `https://videos.naijahomemade.com/api/videos?page=${targetPage}&limit=20&category=${currentCategory}`;
      if (currentCategory === "trends") url += `&sort=trending`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data?.videos) {
        setVideos(prev => {
          // Combine old and new videos
          const combined = isNew ? data.videos : [...prev, ...data.videos];
          
          // Filter out duplicates using chat_id + message_id
          const uniqueMap = new Map();
          combined.forEach(v => uniqueMap.set(`${v.chat_id}:${v.message_id}`, v));
          return Array.from(uniqueMap.values());
        });
        
        // Save sidebar suggestions if provided
        if (data.suggestions) {
          setSidebarSuggestions(data.suggestions);
        }
        
        setPage(targetPage + 1);
      }
    } catch (err) { 
      console.error("Fetch Error:", err); 
    } finally { 
      setLoading(false); 
      isFetching.current = false; 
    }
  }, [currentCategory]);

  // 3. Initial Load Effect
  useEffect(() => {
    setVideos([]); // Clear videos when tab changes
    fetchData(1, true); // Load Page 1
    
    // Only fetch dashboard once per session
    if (Object.keys(dashboardVideos).length === 0) {
      fetchDashboard();
    }
  }, [currentCategory, fetchData, fetchDashboard]);

  // 4. Return the data and functions to the component
  return { 
    videos, 
    dashboardVideos, 
    sidebarSuggestions, 
    loading, 
    loadMore: () => fetchData(page, false), 
    setVideos 
  };
}