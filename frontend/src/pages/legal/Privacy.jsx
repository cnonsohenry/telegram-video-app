import React from "react";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../../config";

export default function Privacy() {
  const headerStyle = { color: "#fff", marginTop: "40px", marginBottom: "15px", fontSize: "24px", borderBottom: "1px solid #333", paddingBottom: "10px" };
  const subHeaderStyle = { color: "#fff", marginTop: "25px", marginBottom: "10px", fontSize: "19px", fontWeight: "600" };
  const textBlockStyle = { marginBottom: "15px" };
  const highlightBox = { background: "#1a1a1a", padding: "20px", borderRadius: "8px", border: "1px solid #333", margin: "20px 0" };

  // 🟢 THE FIX: Auto-format the brand name, domain, and DPO email
  const brandName = APP_CONFIG.appNamePrefix.charAt(0).toUpperCase() + 
                    APP_CONFIG.appNamePrefix.slice(1).toLowerCase() + 
                    APP_CONFIG.appNameSuffix.toLowerCase();
                    
  const cleanDomain = `${APP_CONFIG.appNamePrefix.toLowerCase()}${APP_CONFIG.appNameSuffix.toLowerCase()}.com`;
  const domainName = `www.${cleanDomain}`;
  const dpoEmail = `dpo@${cleanDomain}`;

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
          {/* 🟢 THE FIX: Dynamic Company Name and Domain */}
          <strong>{APP_CONFIG.companyName}</strong> (hereinafter “we”, “us” or “our”) operates the website 
          <strong> {domainName}</strong> (hereinafter “{brandName}”) and is the controller of the information 
          collected or provided via the platform.
        </p>
        <p style={textBlockStyle}>
          Please read this Privacy Notice carefully. Your access to and use of {brandName} signifies that you have 
          read and understand all terms within this Privacy Notice. We respect your privacy and are committed to 
          protecting your personal data.
        </p>
      </section>

      <section>
        <h2 style={headerStyle}>1. Scope</h2>
        <p style={textBlockStyle}>
          This Privacy Notice applies to information we process on {brandName} and through your communications 
          with us via email, online support chats, or phone support. “Processing” refers to any operation performed 
          on personal data, including collection, storage, use, and erasure.
        </p>
      </section>

      <section>
        <h2 style={headerStyle}>2. Our Policy Towards Minors</h2>
        <div style={{ ...highlightBox, borderColor: "#ff4d4d" }}>
          <p style={{ margin: 0, color: "#fff" }}>
            <strong>STRICT PROHIBITION:</strong> {brandName} prohibits minors from using the platform. Access is 
            forbidden for persons under the age of 18. If you believe a minor has provided us with personal 
            information, contact <strong>{APP_CONFIG.supportEmail}</strong> immediately for deletion.
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

        <h3 style={subHeaderStyle}>Google Sign-In & OAuth Users</h3>
        <p style={textBlockStyle}>
          When you choose to register or log in using Google Sign-In (OAuth 2.0), we receive specific profile information 
          from Google with your explicit permission:
        </p>
        <ul style={{ paddingLeft: "20px" }}>
          <li><strong>Google Account Identifier:</strong> A unique numeric Google ID (<code>sub</code>) to securely identify your account.</li>
          <li><strong>Full Name:</strong> Used to set your public display name on {brandName}.</li>
          <li><strong>Verified Email Address:</strong> Used to authenticate your account, send critical account security notices, and prevent fraud.</li>
          <li><strong>Profile Picture URL:</strong> Used as your default profile avatar on the platform (which you can change anytime).</li>
        </ul>

        <h3 style={subHeaderStyle}>{brandName} Models</h3>
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
          <li>Provide and manage your user account, login sessions, and community interactions.</li>
          <li>Verify age, consent, and identity to maintain strict platform safety and 18+ compliance.</li>
          <li>Deliver purchased creator subscriptions and process creator revenue disbursements.</li>
          <li>Analyze platform usage, server performance, and optimize technical stability.</li>
          <li>Detect, prevent, and combat unlawful activities, fraud, unauthorized access, and non-consensual content.</li>
        </ul>
      </section>

      {/* 🟢 CRITICAL: Dedicated Google API & OAuth 2.0 Policy Section */}
      <section>
        <h2 style={headerStyle}>5. Google API Services & OAuth 2.0 User Data Policy</h2>
        <div style={{ ...highlightBox, borderColor: "#00a859" }}>
          <p style={{ margin: "0 0 12px 0", color: "#fff", fontWeight: "700", fontSize: "16px" }}>
            Google User Data Protection & Limited Use Disclosure
          </p>
          <p style={{ margin: "0 0 10px 0", lineHeight: "1.7" }}>
            {brandName} complies strictly with Google's API Services User Data Policy regarding data accessed through Google OAuth:
          </p>
          <ul style={{ paddingLeft: "20px", margin: "0 0 14px 0", lineHeight: "1.7" }}>
            <li><strong>Limited Access:</strong> We only request basic Google identity scopes (<code>profile</code>, <code>email</code>, <code>openid</code>) necessary to create and authenticate your account. We never request access to your Google Drive, Gmail messages, Contacts, or Calendar.</li>
            <li><strong>No Selling of Google Data:</strong> We <strong>never sell, lease, rent, or trade</strong> your Google user data to any third-party advertisers, data brokers, or commercial marketing entities.</li>
            <li><strong>No Third-Party AI Training:</strong> Your Google user data is never used or transferred to develop, train, or improve any generalized Artificial Intelligence (AI) or Machine Learning (ML) models.</li>
            <li><strong>Data Sharing Restrictions:</strong> Google user data is only shared with trusted cloud infrastructure providers (e.g., our secure database hosting) strictly as required to provide you with the {brandName} service, and never for secondary purposes.</li>
          </ul>
          <p style={{ margin: "0", color: "#e7e9ea", fontStyle: "italic", borderTop: "1px solid #333", paddingTop: "10px" }}>
            <strong>Mandatory Google Limited Use Compliance:</strong> {brandName}’s use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#00e676", textDecoration: "underline" }}>Google API Services User Data Policy</a>, including the Limited Use requirements.
          </p>
        </div>
      </section>

      <section>
        <h2 style={headerStyle}>6. Disclosure of Information</h2>
        <p style={textBlockStyle}>We may disclose your personal information only in the following limited circumstances:</p>
        <ul style={{ paddingLeft: "20px" }}>
          <li><strong>Public Community Information:</strong> Your username, public display name, and avatar are visible when you post comments, like videos, or share creator content.</li>
          <li><strong>Essential Service Providers:</strong> Trusted third parties who assist in operating the website, including secure database providers, Cloudflare CDN, and payment gateways. All service providers are contractually bound to confidentiality and data protection.</li>
          <li><strong>Legal Authorities:</strong> When required by lawful court order, subpoena, or to protect the vital interests, safety, and legal rights of our users and the public.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>7. Biometric Information</h2>
        <p style={textBlockStyle}>
          We utilize third-party facial recognition technology solely for verified creator identity and 18+ age verification. 
          This creates a mathematical representation of facial features to match a creator's selfie with their government-issued ID. 
          We do not store raw biometric data on our servers; it is processed securely by certified third-party verification partners and deleted per statutory retention guidelines.
        </p>
      </section>

      <section>
        <h2 style={headerStyle}>8. Data Retention & Account Deletion (Right to Erasure)</h2>
        <p style={textBlockStyle}>
          We retain your personal data and Google OAuth information only for as long as your account remains active or as necessary to provide you with services.
        </p>
        <div style={highlightBox}>
          <p style={{ margin: "0 0 10px 0", color: "#fff", fontWeight: "700" }}>How to Request Immediate Data Deletion:</p>
          <p style={{ margin: "0 0 8px 0" }}>
            You have the absolute right to delete your account, personal data, and revoke Google authentication credentials at any time:
          </p>
          <ul style={{ paddingLeft: "20px", margin: "0 0 10px 0" }}>
            <li><strong>In-App Deletion:</strong> Navigate to <strong>Settings</strong> ➡️ <strong>Account</strong> ➡️ <strong>Delete Account</strong>.</li>
            <li><strong>Email Request:</strong> Send an email with the subject "Data Deletion Request" from your registered email address to <strong>{APP_CONFIG.supportEmail}</strong> or <strong>{dpoEmail}</strong>.</li>
            <li><strong>Google Account Permissions:</strong> You can also instantly revoke {brandName}'s access directly via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: "#00e676", textDecoration: "underline" }}>Google Account Security Permissions</a>.</li>
          </ul>
          <p style={{ margin: "0", fontSize: "13px", color: "#aaa" }}>
            Upon receiving an account deletion request, your profile, authentication tokens, uploaded media, and activity logs are permanently expunged from our live databases within <strong>30 days</strong>.
          </p>
        </div>
      </section>

      <section>
        <h2 style={headerStyle}>9. Your Rights</h2>
        <p style={textBlockStyle}>
          Depending on your jurisdiction (including GDPR in Europe, UK Data Protection Act, and CCPA/CPRA in California), you possess the following statutory rights regarding your personal data:
        </p>
        
        <ul style={{ paddingLeft: "20px", marginTop: "15px" }}>
          <li><strong>Right of Access:</strong> Request a comprehensive copy of all personal and authentication data we hold about you.</li>
          <li><strong>Right to Rectification:</strong> Request correction of inaccurate, outdated, or incomplete data.</li>
          <li><strong>Right to Erasure:</strong> Request permanent deletion of your data and revocation of authentication credentials.</li>
          <li><strong>Right to Restrict or Object:</strong> Restrict processing or object to data processing based on legitimate interests.</li>
          <li><strong>Right to Data Portability:</strong> Receive your personal data in a structured, commonly used, machine-readable format.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>10. Contact Information</h2>
        <div style={highlightBox}>
          {/* 🟢 THE FIX: Dynamic Emails and Legal Address */}
          <p style={{ margin: "0 0 10px 0", color: "#fff" }}><strong>General Support:</strong> {APP_CONFIG.supportEmail}</p>
          <p style={{ margin: "0 0 10px 0", color: "#fff" }}><strong>Data Protection Officer:</strong> {dpoEmail}</p>
          <p style={{ margin: 0 }}>
            <strong>Address:</strong><br/>
            {APP_CONFIG.companyName}<br/>
            {APP_CONFIG.legalAddress.map((line, index) => (
              <React.Fragment key={index}>
                {line}<br/>
              </React.Fragment>
            ))}
          </p>
        </div>
      </section>

      <footer style={{ marginTop: "50px", padding: "20px 0", borderTop: "1px solid #333", textAlign: "center", fontSize: "13px" }}>
        {/* 🟢 THE FIX: Dynamic Copyright */}
        <p>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
      </footer>
    </div>
  );
}