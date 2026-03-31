import React from "react";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../../config";

export default function DMCA() {
  const headerStyle = { color: "#fff", marginTop: "30px", marginBottom: "15px", fontSize: "22px", borderBottom: "1px solid #333", paddingBottom: "10px" };
  const subHeaderStyle = { color: "#fff", marginTop: "20px", marginBottom: "10px", fontSize: "17px", fontWeight: "600" };
  const textBlockStyle = { marginBottom: "15px" };
  const highlightBox = { background: "#1a1a1a", padding: "20px", borderRadius: "8px", border: "1px solid #333", margin: "20px 0" };

  // 🟢 THE FIX: Auto-format the brand name and domain
  const brandName = APP_CONFIG.appNamePrefix.charAt(0).toUpperCase() + 
                    APP_CONFIG.appNamePrefix.slice(1).toLowerCase() + 
                    APP_CONFIG.appNameSuffix.toLowerCase();
                    
  const domainName = `www.${APP_CONFIG.appNamePrefix.toLowerCase()}${APP_CONFIG.appNameSuffix.toLowerCase()}.com`;

  return (
    <div style={{ 
      lineHeight: "1.7", 
      color: "#b3b3b3", 
      fontSize: "15px", 
      display: "flex", 
      flexDirection: "column", 
      maxWidth: "900px",
      margin: "0 auto",
      padding: "40px 20px"
    }}>
      <h1 style={headerStyle}>Reporting Claims of Copyright Infringement</h1>
      
      <p style={textBlockStyle}>
        We take claims of copyright infringement seriously. We will respond to notices of alleged copyright infringement that comply with the Digital Millennium Copyright Act (the “DMCA”) or any other applicable intellectual property legislation or laws. Responses may include removing, blocking, or disabling access to material claimed to be the subject of infringing activity, terminating the user’s access to <strong>https://{domainName}</strong>, or all of the foregoing.
      </p>

      <p style={textBlockStyle}>
        If you believe any material accessible on <strong>{brandName}</strong> infringes your copyright, you may submit a notification. These requests should only be submitted by the copyright owner, or an agent authorized to act on the owner’s behalf.
      </p>

      <h2 style={headerStyle}>Filing a DMCA Notice</h2>
      <p style={textBlockStyle}>
        If you choose to request removal of content, please remember that you are initiating a legal process. Do not make false claims. Misuse of this process may result in the suspension of your account or other legal consequences.
      </p>

      <div style={highlightBox}>
        <p style={{ ...textBlockStyle, color: "#fff" }}><strong>Your DMCA Notice must include the following:</strong></p>
        <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <li>Identification of the copyrighted work you believe to have been infringed.</li>
          <li>Identification of the material you believe to be infringing, including the <strong>exact URL(s)</strong>.</li>
          <li>Your contact information (name, address, telephone number, and email).</li>
          <li>A statement of "good faith belief" that the use is not authorized by the owner.</li>
          <li>A statement that the information is accurate, under penalty of perjury.</li>
          <li>A physical or electronic signature of the copyright owner or authorized representative.</li>
        </ul>
      </div>

      <h3 style={subHeaderStyle}>Designated Copyright Agent</h3>
      <div style={{ ...highlightBox, borderColor: "#444" }}>
        <p style={{ margin: 0, color: "#fff" }}>
          <strong>Compliance Officer</strong><br/>
          {/* 🟢 THE FIX: Dynamic Company Name and Address */}
          {APP_CONFIG.companyName}<br/>
          {APP_CONFIG.legalAddress.map((line, index) => (
            <React.Fragment key={index}>
              {line}<br/>
            </React.Fragment>
          ))}
          <strong>Email:</strong> <a href={`mailto:${APP_CONFIG.supportEmail}`} style={{ color: "#fff" }}>{APP_CONFIG.supportEmail}</a>
        </p>
      </div>

      <h2 style={headerStyle}>Counter-Notification Procedures</h2>
      <p style={textBlockStyle}>
        If you believe that material you posted on <strong>{brandName}</strong> was removed by mistake or misidentification, you may file a counter-notification with our designated agent listed above.
      </p>

      <div style={highlightBox}>
        <p style={{ ...textBlockStyle, color: "#fff" }}><strong>The Counter-Notice must include:</strong></p>
        <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <li>Your name, address, and phone number.</li>
          <li>Identification of the content and its location before removal.</li>
          <li>A statement under penalty of perjury of your good faith belief that removal was a mistake.</li>
          <li>A statement of consent to the jurisdiction of the U.S. Federal District Court (or local equivalent) and acceptance of service of process.</li>
        </ul>
      </div>

      <h2 style={headerStyle}>Repeat Infringers</h2>
      <p style={textBlockStyle}>
        In accordance with the DMCA and other applicable law, we have adopted a policy of terminating or disabling, in appropriate circumstances and at our sole discretion, the accounts of users who are deemed to be repeat infringers.
      </p>

      <h2 style={headerStyle}>Content Fingerprinting</h2>
      <p style={textBlockStyle}>
        <strong>{brandName}</strong> uses automated audiovisual identification systems to assist us in identifying and blocking potentially infringing content from being uploaded. Videos uploaded to our platform are compared against a database of digital fingerprints. When a video is matched to a digital fingerprint, access to it is disabled.
      </p>

      <footer style={{ marginTop: "50px", padding: "20px 0", borderTop: "1px solid #333", textAlign: "center", fontSize: "13px" }}>
        {/* 🟢 THE FIX: Dynamic Copyright Year and Brand Name */}
        <p>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
      </footer>
    </div>
  );
}