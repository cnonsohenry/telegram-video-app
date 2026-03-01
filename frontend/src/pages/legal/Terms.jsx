import React from "react";

export default function Terms() {
  const headerStyle = { color: "#fff", marginTop: "30px", marginBottom: "10px", fontSize: "20px" };
  const subHeaderStyle = { color: "#fff", marginTop: "20px", marginBottom: "8px", fontSize: "17px" };
  const textBlockStyle = { marginBottom: "15px" };

  return (
    <div style={{ 
      lineHeight: "1.7", 
      color: "#b3b3b3", 
      fontSize: "15px", 
      display: "flex", 
      flexDirection: "column", 
      padding: "20px",
      maxWidth: "900px",
      margin: "0 auto" 
    }}>
      <p><strong>Last Updated: February 2026</strong></p>

      <section>
        <h2 style={headerStyle}>1. Acceptance of Terms</h2>
        <div style={textBlockStyle}>
          <p>By accessing, using, or visiting this Website, any of its Content, functionalities, and services, you signify your agreement to these Terms of Service including policies and related guidelines (for instance, Child Sexual Abuse Material Policy, and Non-Consensual Content Policy) and our Privacy Notice.</p>
          <p>You may terminate these Terms of Service at any time by deleting your account and refraining from further use of our services. These Terms apply to all users, including Content Partners, Models, and Verified Uploaders.</p>
        </div>

        <h3 style={subHeaderStyle}>Ability to Accept Terms of Service</h3>
        <p style={textBlockStyle}>
          You affirm that you are at least <strong>18 years of age</strong> and the age of majority in your jurisdiction. If you are under 18, please do not use this Website. We reserve the right to use third-party age verification service providers to determine eligibility.
        </p>

        <h3 style={subHeaderStyle}>Changes to the Terms</h3>
        <p style={textBlockStyle}>
          We may amend these Terms from time to time. We will provide reasonable, advance notice via pop-up notifications or email. Continued use of the Website after changes come into effect constitutes agreement to the new terms.
        </p>
      </section>

      <hr style={{ border: "0", borderTop: "1px solid #333", margin: "20px 0" }} />

      <section>
        <h2 style={headerStyle}>2. Content & Website Usage</h2>
        <p style={textBlockStyle}>
          This Website allows for the general viewing of adult-oriented Content. It also allows for uploading by Content Partners, Verified Uploaders, and Models. Content is provided "AS IS" for your personal use only.
        </p>
        <ul style={{ paddingLeft: "20px", marginBottom: "15px" }}>
          <li><strong>Personal Use:</strong> This Website is for personal use and shall not be used for commercial endeavors except those specifically endorsed.</li>
          <li><strong>Third-Party Links:</strong> We assume no responsibility for the content or practices of third-party sites linked from our platform.</li>
          <li><strong>Advertising:</strong> Your license to use this site is conditioned on displaying the site whole and intact, including advertising. Use of ad-blocking software is a violation of these terms.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>3. Rules for Uploaders & Content Partners</h2>
        <p style={textBlockStyle}>
          To upload Content, you must be a Verified Uploader, Content Partner, or Model. You represent and warrant that:
        </p>
        <ul style={{ paddingLeft: "20px", marginBottom: "15px" }}>
          <li>The Content does not contravene applicable laws.</li>
          <li>You own the rights to the Content and have obtained consent/releases for every individual appearing in it.</li>
          <li>All individuals in the Content are at least 18 years of age.</li>
          <li>You maintain records required under 18 U.S.C. § 2257 (where applicable).</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>4. Account Security & Verification</h2>
        <p style={textBlockStyle}>
          You are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately of any unauthorized access at <strong>support@yourdomain.com</strong>. Verification may require high-resolution scans of government ID and biometric processing through third-party providers.
        </p>
      </section>

      <section>
        <h2 style={headerStyle}>5. Prohibited Uses</h2>
        <p style={textBlockStyle}>You specifically agree NOT to:</p>
        <ul style={{ paddingLeft: "20px", marginBottom: "15px" }}>
          <li>Post content depicting anyone under 18 or non-consensual sexual activity.</li>
          <li>Engage in harassment, stalking, or invasive behavior.</li>
          <li>Use automated means (robots/spiders) to scrape or monitor the site.</li>
          <li>Promote or facilitate human trafficking or prostitution.</li>
          <li>Circumvent digital rights management (DRM) or age-verification tools.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>6. Monitoring, Enforcement & Termination</h2>
        <p style={textBlockStyle}>
          We reserve the right to monitor communications, restrict visibility of content, and suspend or terminate accounts that violate these terms. We cooperate fully with law enforcement regarding illegal content, especially child exploitation material.
        </p>
      </section>

      <section>
        <h2 style={headerStyle}>7. Data Retention Schedule</h2>
        <p style={textBlockStyle}>
          We retain data for Abuse Prevention, Compliance, Financial Operations, and Fraud Prevention. An account is considered <strong>Inactive</strong> if the user has not logged in or received views within three (3) years, or upon a deletion request.
        </p>
      </section>

      <section>
        <h2 style={headerStyle}>8. Contact & Communication</h2>
        <p style={textBlockStyle}>
          By registering, you consent to receive electronic communications relating to your account. For Digital Services Act (DSA) inquiries, you may contact <strong>dsa@yourdomain.com</strong>.
        </p>
      </section>

      <footer style={{ marginTop: "40px", padding: "20px 0", borderTop: "1px solid #333", textAlign: "center", fontSize: "13px" }}>
        <p>© 2026 Your Website Name. All rights reserved.</p>
      </footer>
    </div>
  );
}