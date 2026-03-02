import React, { useEffect, useState } from 'react';

export default function HTMLSitemap() {
  const [links, setLinks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      // 🟢 1. Build the URL safely
      const baseUrl = import.meta.env.VITE_API_URL || "https://videos.naijahomemade.com";
      const targetUrl = `${baseUrl}/api/search?q=&limit=50`;
      
      console.log("Sitemap trying to fetch from:", targetUrl); // 👀 Check your browser console!

      try {
        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        
        const data = await res.json();
        setLinks(data.videos || []);
      } catch (err) {
        console.error("Sitemap Fetch Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  return (
    <div style={{ padding: '40px', color: '#fff', backgroundColor: '#000', minHeight: '100vh' }}>
      <h1 style={{ color: '#ff3b30' }}>HTML Sitemap</h1>
      
      {loading && <p>Loading links...</p>}
      
      {/* 🟢 Display the error right on the screen if it fails */}
      {error && (
        <div style={{ background: '#330000', padding: '15px', borderRadius: '8px', border: '1px solid red' }}>
          <strong>Error loading sitemap:</strong> {error}
          <p style={{ fontSize: '12px', marginTop: '10px' }}>
            (Check your browser console to see the exact URL it tried to fetch. Make sure VITE_API_URL is set in your .env file!)
          </p>
        </div>
      )}

      {!loading && !error && (
        <ul style={{ lineHeight: '1.8' }}>
          <li><a href="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</a></li>
          {links.map(video => (
            <li key={video.message_id}>
               <a href={`/?v=${video.message_id}`} style={{ color: '#888', textDecoration: 'none' }}>
                 {video.caption || `Video ${video.message_id}`}
               </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}