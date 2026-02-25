import React from "react";

export default function LegalFooter() {
  return (
    <footer style={footerStyle}>
      <div style={linkRowStyle}>
        <a href="/?legal=info" style={linkStyle}>Information</a>
        <a href="/?legal=terms" style={linkStyle}>Terms & Conditions</a>
        <a href="/?legal=privacy" style={linkStyle}>Privacy Notice</a>
        <a href="/?legal=cookies" style={linkStyle}>Cookie Notice</a>
        <a href="/?legal=dmca" style={linkStyle}>DMCA</a>
        <a href="/?legal=2257" style={linkStyle}>18 U.S.C. 2257</a>
        <a href="/?legal=law-enforcement" style={linkStyle}>Law Enforcement</a>
        <a href="/?legal=accessibility" style={linkStyle}>Accessibility</a>
      </div>
      <p style={copyrightStyle}>&copy; {new Date().getFullYear()} Naija Homemade. All rights reserved.</p>
    </footer>
  );
}

// 🖌 Styles
const footerStyle = { padding: "40px 20px", textAlign: "center", borderTop: "1px solid #1a1a1a", marginTop: "40px" };
const linkRowStyle = { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "15px", marginBottom: "20px" };
const linkStyle = { color: "#8e8e8e", fontSize: "12px", textDecoration: "none", fontWeight: "600", transition: "color 0.2s" };
const copyrightStyle = { color: "#555", fontSize: "11px" };