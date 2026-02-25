import React from "react";

export default function Terms() {
  return (
    <div style={{ lineHeight: "1.7", color: "#b3b3b3", fontSize: "15px", display: "flex", flexDirection: "column", gap: "15px" }}>
      <p>Last Updated: February 2026</p>
      
      <h3 style={{ color: "#fff", marginTop: "20px" }}>1. Acceptance of Terms</h3>
      <p>By accessing this website, you confirm that you are at least 18 years of age (or the age of majority in your jurisdiction) and agree to be bound by these Terms of Service. If you do not agree, you must exit immediately.</p>
      
      {/* YOU CAN PASTE 5,000 WORDS OF TERMS HERE */}
      
      <h3 style={{ color: "#fff", marginTop: "20px" }}>2. Content Usage</h3>
      <p>All content on this platform is for personal, non-commercial use only. You may not download, scrape, redistribute, or sell any videos, images, or text found on Naija Homemade.</p>
    </div>
  );
}