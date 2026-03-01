import React from "react";

export default function Compliance2257() {
  const sectionHeaderStyle = { color: "#fff", marginTop: "25px", marginBottom: "10px", fontSize: "18px" };
  const textBlockStyle = { marginBottom: "15px" };

  return (
    <div style={{ 
      lineHeight: "1.7", 
      color: "#b3b3b3", 
      fontSize: "15px", 
      display: "flex", 
      flexDirection: "column", 
      maxWidth: "800px",
      margin: "0 auto",
      padding: "20px"
    }}>
      <h2 style={{ color: "#fff", borderBottom: "1px solid #333", paddingBottom: "10px", marginBottom: "20px" }}>
        RECORD-KEEPING REQUIREMENTS COMPLIANCE STATEMENT
      </h2>

      <p style={{ ...textBlockStyle, color: "#fff", fontWeight: "500" }}>
        All models, actors, and other persons appearing in visual depictions of actual or simulated sexually explicit conduct on this website were 18 years of age or older at the time of the creation of such depictions.
      </p>

      <div style={textBlockStyle}>
        <p>
          The operator of <strong>Naijahomemade</strong> is not the producer (whether primary or secondary as defined in 18 U.S.C. § 2257) of any of the content found on Naijahomemade. The operator’s activities are limited to the transmission, storage, retrieval, hosting and/or formatting of depictions posted by third-party users.
        </p>
      </div>

      <h3 style={sectionHeaderStyle}>Requests for Records</h3>
      <p style={textBlockStyle}>
        Please direct any request regarding §2257 records in relation to any content found on Naijahomemade directly to the respective uploader, amateur, producer, studio, or account holder of the content (<strong>"Verified Uploaders"</strong>).
      </p>
      
      <p style={textBlockStyle}>
        For further assistance in communicating with Verified Uploaders or questions regarding this notice, please contact our compliance department at: 
        <a href="mailto:support@Naijahomemade.com" style={{ color: "#fff", marginLeft: "5px" }}>support@Naijahomemade.com</a>.
      </p>

      <h3 style={sectionHeaderStyle}>Strict Compliance Procedures</h3>
      <p style={textBlockStyle}>Naijahomemade abides by the following mandatory procedures for all uploaded content:</p>
      
      <ul style={{ paddingLeft: "20px", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <li>
          <strong style={{ color: "#fff" }}>Identification:</strong> All Verified Uploaders must be over 18 (or the age of majority in their jurisdiction) and are personally identified and verified at account activation.
        </li>
        <li>
          <strong style={{ color: "#fff" }}>Consent & Age:</strong> Uploaders must certify that all individuals in the content are over 18 and freely consented to the production and upload.
        </li>
        <li>
          <strong style={{ color: "#fff" }}>§ 2257 Certification:</strong> As producers, Verified Uploaders certify compliance with record-keeping requirements under U.S.C. § 2257 and agree to deliver documentation promptly upon request.
        </li>
        <li>
          <strong style={{ color: "#fff" }}>Policy Adherence:</strong> Content must not violate our Child Sexual Abuse Material (CSAM) Policy or Non-Consensual Content Policy.
        </li>
      </ul>

      <div style={{ 
        background: "#1a1a1a", 
        padding: "25px", 
        borderRadius: "8px", 
        border: "1px solid #333", 
        marginTop: "10px" 
      }}>
        <h3 style={{ margin: "0 0 15px 0", color: "#fff", fontSize: "16px", textTransform: "uppercase" }}>
          Custodian of Records
        </h3>
        <p style={{ margin: 0, fontStyle: "normal", color: "#fff" }}>
          Compliance Department<br/>
          Naija Homemade LLC<br/>
          123 Legal Avenue<br/>
          Port Harcourt, Rivers State, Nigeria
        </p>
      </div>

      <footer style={{ marginTop: "40px", fontSize: "12px", textAlign: "center", opacity: "0.6" }}>
        This statement is made pursuant to 18 U.S.C. § 2257 and related regulations.
      </footer>
    </div>
  );
}