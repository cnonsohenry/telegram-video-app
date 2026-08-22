import React from "react";
import { FaTelegram, FaXTwitter, FaInstagram, FaTiktok, FaSnapchat } from "react-icons/fa6";
// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function LegalFooter() {
  return (
    <footer style={footerStyle}>
      {/* 🟢 NEW: Social Media Icons (Single Line) */}
      <div style={socialFooterStyle}>
        <a href="https://t.me/+z-toLOLI2eVjMmYx" target="_blank" rel="noopener noreferrer" style={socialIconStyle}>
           <FaTelegram size={20} />
        </a>
        <a href="https://x.com/addicti18844563" target="_blank" rel="noopener noreferrer" style={socialIconStyle}>
           <FaXTwitter size={20} />
        </a>
        <a href="https://www.instagram.com/nyashbender" target="_blank" rel="noopener noreferrer" style={socialIconStyle}>
           <FaInstagram size={20} />
        </a>
        <a href="https://tiktok.com/@yourlink" target="_blank" rel="noopener noreferrer" style={socialIconStyle}>
           <FaTiktok size={20} />
        </a>
        <a href="https://snapchat.com/add/yourlink" target="_blank" rel="noopener noreferrer" style={socialIconStyle}>
           <FaSnapchat size={20} />
        </a>
      </div>

      {/* Legal Links with the border moved to the top of this container */}
      <div style={linkRowStyle}>
        <a href="/?legal=about" style={linkStyle}>About</a>
        <a href="/?legal=terms" style={linkStyle}>T&C</a>
        <a href="/?legal=privacy" style={linkStyle}>Privacy</a>
        <a href="/?legal=cookies" style={linkStyle}>Cookies</a>
        <a href="/?legal=dmca" style={linkStyle}>DMCA</a>
        <a href="/?legal=2257" style={linkStyle}>2257</a>
      </div>
      
      {/* 🟢 THE FIX: Dynamic Brand Name for the copyright */}
      <p style={copyrightStyle}>
        &copy; {new Date().getFullYear()} {APP_CONFIG.appNamePrefix} {APP_CONFIG.appNameSuffix}. All rights reserved.
      </p>
    </footer>
  );
}

// 🖌 Styles
const footerStyle = { 
  padding: "40px 0 80px", // 🟢 THE FIX: Increased bottom padding from 20px to 80px
  textAlign: "center", 
  marginTop: "20px",
  width: "100%", 
  boxSizing: "border-box" 
};

const socialFooterStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "nowrap", // Forces icons to stay on a single line
  gap: "15px",
  marginBottom: "25px" // Space between icons and the border
};

const socialIconStyle = { 
  display: "flex", 
  alignItems: "center",
  justifyContent: "center",
  color: "#8e8e8e", 
  textDecoration: "none", 
  padding: "10px", 
  background: "rgba(255,255,255,0.05)",
  borderRadius: "50%", 
  transition: "all 0.2s ease" 
};

const linkRowStyle = { 
  display: "flex", 
  flexWrap: "wrap", 
  justifyContent: "center", 
  gap: "15px", 
  marginBottom: "20px",
  borderTop: "1px solid #1a1a1a", /* Border moved here */
  paddingTop: "25px" /* Space between border and text links */
};

const linkStyle = { color: "#8e8e8e", fontSize: "12px", textDecoration: "none", fontWeight: "600", transition: "color 0.2s" };
const copyrightStyle = { color: "#555", fontSize: "11px", textTransform: "capitalize" };