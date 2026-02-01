import { useState, useEffect, useCallback } from "react";

export function useVideos(currentCategory) {
  const [videos, setVideos] = useState([]);
  const [dashboardVideos, setDashboardVideos] = useState({}); // { knacks: [...], hotties: [...] }
  const [sidebarSuggestions, setSidebarSuggestions] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // 🟢 NEW: Fetch top 4 from all categories for the Home Dashboard
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const categories = ["knacks", "hotties", "baddies", "trends"];
      const results = {};
      
      // We fetch all categories in parallel for speed
      await Promise.all(categories.map(async (cat) => {
        const url = `https://videos.naijahomemade.com/api/videos?page=1&limit=4&category=${cat}`;
        const res = await fetch(url);
        const data = await res.json();
        results[cat] = data.videos || [];
      }));
      
      setDashboardVideos(results);
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVideos = useCallback(async (isNewTab = false) => {
    if (loading) return;
    setLoading(true);
    
    setPage(prevPage => {
      const pageToFetch = isNewTab ? 1 : prevPage;
      const fetchData = async () => {
        try {
          let url = `https://videos.naijahomemade.com/api/videos?page=${pageToFetch}&limit=20&category=${currentCategory}`;
          if (currentCategory === "trends") url += `&sort=trending`;
          
          const res = await fetch(url);
          const data = await res.json();
          
          if (data?.videos) {
            setVideos(prev => {
              const combined = isNewTab ? data.videos : [...prev, ...data.videos];
              const uniqueMap = new Map();
              combined.forEach(v => uniqueMap.set(`${v.chat_id}:${v.message_id}`, v));
              return Array.from(uniqueMap.values());
            });

            if (data.suggestions) setSidebarSuggestions(data.suggestions);
          }
        } catch (err) { console.error(err); } finally { setLoading(false); }
      };

      fetchData();
      return isNewTab ? 2 : prevPage + 1;
    });
  }, [currentCategory, loading]);

  useEffect(() => {
    setVideos([]);
    loadVideos(true);
  }, [currentCategory, loadVideos]);

  // Load dashboard data once on mount
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { 
    videos, 
    dashboardVideos, 
    sidebarSuggestions, 
    loading, 
    loadMore: () => loadVideos(false), 
    refreshDashboard: fetchDashboard,
    setVideos 
  };
}