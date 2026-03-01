import React from "react";

export default function Privacy() {
  const headerStyle = { color: "#fff", marginTop: "40px", marginBottom: "15px", fontSize: "24px", borderBottom: "1px solid #333", paddingBottom: "10px" };
  const subHeaderStyle = { color: "#fff", marginTop: "25px", marginBottom: "10px", fontSize: "19px", fontWeight: "600" };
  const textBlockStyle = { marginBottom: "15px" };
  const highlightBox = { background: "#1a1a1a", padding: "20px", borderRadius: "8px", border: "1px solid #333", margin: "20px 0" };

  return (
    <div style={{ 
      lineHeight: "1.8", 
      color: "#b3b3b3", 
      fontSize: "15px", 
      display: "flex", 
      flexDirection: "column", 
      maxWidth: "950px",
      margin: "0 auto",
      padding: "40px 20px"
    }}>
      <p style={{ fontSize: "13px", opacity: 0.7 }}>Last Updated: February 2026</p>

      <div style={highlightBox}>
        <p style={{ margin: 0 }}>
          <strong>NOTE:</strong> This Privacy Notice is drafted in English. In the event of a conflict between the English version and any translation, the English version shall prevail.
        </p>
      </div>

      <section>
        <h1 style={headerStyle}>Introduction</h1>
        <p style={textBlockStyle}>
          <strong>Naija Homemade LLC</strong> (hereinafter “we”, “us” or “our”) operates the website 
          <strong> www.naijahomemade.com</strong> (hereinafter “Naijahomemade”) and is the controller of the information 
          collected or provided via the platform.
        </p>
        <p style={textBlockStyle}>
          Please read this Privacy Notice carefully. Your access to and use of Naijahomemade signifies that you have 
          read and understand all terms within this Privacy Notice. We respect your privacy and are committed to 
          protecting your personal data.
        </p>
      </section>

      <section>
        <h2 style={headerStyle}>1. Scope</h2>
        <p style={textBlockStyle}>
          This Privacy Notice applies to information we process on Naijahomemade and through your communications 
          with us via email, online support chats, or phone support. “Processing” refers to any operation performed 
          on personal data, including collection, storage, use, and erasure.
        </p>
      </section>

      <section>
        <h2 style={headerStyle}>2. Our Policy Towards Minors</h2>
        <div style={{ ...highlightBox, borderColor: "#ff4d4d" }}>
          <p style={{ margin: 0, color: "#fff" }}>
            <strong>STRICT PROHIBITION:</strong> Naijahomemade prohibits minors from using the platform. Access is 
            forbidden for persons under the age of 18. If you believe a minor has provided us with personal 
            information, contact <strong>support@naijahomemade.com</strong> immediately for deletion.
          </p>
        </div>
      </section>

      <section>
        <h2 style={headerStyle}>3. The Data We Process About You</h2>
        
        <h3 style={subHeaderStyle}>Unregistered Users</h3>
        <ul style={{ paddingLeft: "20px" }}>
          <li><strong>Activity Data:</strong> IP addresses, browser types, and search history.</li>
          <li><strong>Identifiers:</strong> Age verification data processed by trusted third-party providers.</li>
        </ul>

        <h3 style={subHeaderStyle}>Registered Users</h3>
        <ul style={{ paddingLeft: "20px" }}>
          <li><strong>Contact Data:</strong> Usernames and email addresses.</li>
          <li><strong>Sensitive Data:</strong> Information concerning sex life or sexual orientation provided via preferences or interactions.</li>
          <li><strong>Biometric Information:</strong> Facial recognition data used solely for identity and age verification.</li>
        </ul>

        <h3 style={subHeaderStyle}>Naijahomemade Models</h3>
        <ul style={{ paddingLeft: "20px" }}>
          <li><strong>Application Data:</strong> Legal name, address, and phone number.</li>
          <li><strong>Transaction Data:</strong> Tax Identification Numbers and payment details for revenue processing.</li>
          <li><strong>Profile Data:</strong> Stage names, ethnicity, and physical measurements for profile completion.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>4. Purposes of Processing</h2>
        <p style={textBlockStyle}>We process information to:</p>
        <ul style={{ paddingLeft: "20px" }}>
          <li>Provide and manage your account and services.</li>
          <li>Verify age and identity to maintain platform safety.</li>
          <li>Analyze metrics and customize advertising content.</li>
          <li>Combat illegal activities, including fraud and sexual exploitation.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>5. Disclosure of Information</h2>
        <p style={textBlockStyle}>We may disclose your personal information to:</p>
        <ul style={{ paddingLeft: "20px" }}>
          <li><strong>The Public:</strong> When you post content or comments.</li>
          <li><strong>Service Providers:</strong> For payment processing, age verification, and hosting.</li>
          <li><strong>Legal Authorities:</strong> To comply with the law, enforce terms, or protect rights.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>6. Biometric Information</h2>
        <p style={textBlockStyle}>
          We utilize third-party facial recognition technology to verify your identity. This creates a mathematical 
          representation of your features to match your selfie with your government-issued ID. We do not store this 
          raw biometric data on our servers; it is processed by authorized security partners.
        </p>
      </section>

      <section>
        <h2 style={headerStyle}>7. Your Rights</h2>
        <p style={textBlockStyle}>
          Depending on your jurisdiction (EEA, UK, Canada, or California), you have rights regarding your data:
        </p>
        
        <ul style={{ paddingLeft: "20px", marginTop: "15px" }}>
          <li><strong>Right of Access:</strong> Request a copy of the data we hold.</li>
          <li><strong>Right to Rectification:</strong> Correct inaccurate data.</li>
          <li><strong>Right to Erasure:</strong> The "Right to be Forgotten."</li>
          <li><strong>Right to Object:</strong> Object to processing based on legitimate interests.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>8. Contact Information</h2>
        <div style={highlightBox}>
          <p style={{ margin: "0 0 10px 0", color: "#fff" }}><strong>General Support:</strong> support@naijahomemade.com</p>
          <p style={{ margin: "0 0 10px 0", color: "#fff" }}><strong>Data Protection Officer:</strong> dpo@naijahomemade.com</p>
          <p style={{ margin: 0 }}>
            <strong>Address:</strong><br/>
            Naija Homemade LLC<br/>
            123 Legal Avenue<br/>
            Port Harcourt, Rivers State, Nigeria
          </p>
        </div>
      </section>

      <footer style={{ marginTop: "50px", padding: "20px 0", borderTop: "1px solid #333", textAlign: "center", fontSize: "13px" }}>
        <p>© 2026 Naijahomemade. All rights reserved.</p>
      </footer>
    </div>
  );
}