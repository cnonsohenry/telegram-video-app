import React from "react";
// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../../config";

export default function Cookies() {
  const headerStyle = { color: "#fff", marginTop: "40px", marginBottom: "15px", fontSize: "24px", borderBottom: "1px solid #333", paddingBottom: "10px" };
  const subHeaderStyle = { color: "#fff", marginTop: "25px", marginBottom: "10px", fontSize: "18px", fontWeight: "600" };
  const textBlockStyle = { marginBottom: "15px" };
  const tableWrapperStyle = { overflowX: "auto", marginBottom: "30px", borderRadius: "8px", border: "1px solid #333" };
  const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" };
  const thStyle = { background: "#1a1a1a", color: "#fff", padding: "12px", borderBottom: "1px solid #333" };
  const tdStyle = { padding: "12px", borderBottom: "1px solid #222" };

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
      maxWidth: "1000px",
      margin: "0 auto",
      padding: "40px 20px"
    }}>
      <p style={{ fontSize: "13px", opacity: 0.7 }}><strong>Last Updated: February 2026</strong></p>

      <section>
        <p style={textBlockStyle}>
          This Cookie Notice applies to cookies and other similar technologies which may be placed when you visit different pages on <strong>{domainName}</strong> (the “Website”), which is operated by <strong>{brandName}</strong> (hereinafter “we” or “us”).
        </p>

        <h2 style={headerStyle}>What are cookies?</h2>
        
        <p style={textBlockStyle}>
          A cookie is a small piece of data that asks your browser to store information on your computer or mobile device. This allows the website to "remember" your actions or preferences over time, such as your language settings or login credentials.
        </p>
        <ul style={{ paddingLeft: "20px", marginBottom: "20px" }}>
          <li><strong>First-Party Cookies:</strong> Set directly by us to improve your user experience and store security data.</li>
          <li><strong>Third-Party Cookies:</strong> Set by domains other than ours (e.g., Google, Twitter) to track browsing history for personalized advertising.</li>
          <li><strong>Session vs. Persistent:</strong> Session cookies expire when you close your browser, while persistent cookies remain until they expire or are manually deleted.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>How we use cookies</h2>
        <p style={textBlockStyle}>
          We use cookies to make our Website function correctly and to understand how you interact with our content. This helps us customize your experience and deliver better products tailored to your interests.
        </p>
      </section>

      <section>
        <h2 style={subHeaderStyle}>1. Essential Cookies</h2>
        <p style={textBlockStyle}>These are necessary for the functioning of the Website and cannot be switched off.</p>
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Cookie Name</th>
                <th style={thStyle}>Purpose</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>AccessAgeDisclaimerNH</td>
                <td style={tdStyle}>Saves the users' age disclaimer selection</td>
                <td style={tdStyle}>First Party</td>
                <td style={tdStyle}>1 Year</td>
              </tr>
              <tr>
                <td style={tdStyle}>cookieConsent</td>
                <td style={tdStyle}>Stores user's cookie consent selection</td>
                <td style={tdStyle}>First Party</td>
                <td style={tdStyle}>1 Year</td>
              </tr>
              <tr>
                <td style={tdStyle}>SIDCC / HSID</td>
                <td style={tdStyle}>Security cookies to confirm visitor authenticity and prevent fraud</td>
                <td style={tdStyle}>Third Party (Google)</td>
                <td style={tdStyle}>1-2 Years</td>
              </tr>
              <tr>
                <td style={tdStyle}>platform</td>
                <td style={tdStyle}>Loads the correct template for the user’s device</td>
                <td style={tdStyle}>First Party</td>
                <td style={tdStyle}>7 Days</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 style={subHeaderStyle}>2. Functional Cookies</h2>
        <p style={textBlockStyle}>These cookies implement additional features and enhance website performance.</p>
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Cookie Name</th>
                <th style={thStyle}>Purpose</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>autocomplete_search</td>
                <td style={tdStyle}>Displays previous recent searches</td>
                <td style={tdStyle}>First Party</td>
                <td style={tdStyle}>1 Day</td>
              </tr>
              <tr>
                <td style={tdStyle}>videoRated</td>
                <td style={tdStyle}>Stores the last 10 videos rated by the user</td>
                <td style={tdStyle}>First Party</td>
                <td style={tdStyle}>Session</td>
              </tr>
              <tr>
                <td style={tdStyle}>vlc</td>
                <td style={tdStyle}>Saves user likes while logged out to sync upon login</td>
                <td style={tdStyle}>First Party</td>
                <td style={tdStyle}>1 Year</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 style={subHeaderStyle}>3. Targeting & Advertising Cookies</h2>
        <p style={textBlockStyle}>These enable us and our partners to serve ads relevant to your interests.</p>
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Cookie Name</th>
                <th style={thStyle}>Purpose</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>_Secure-3PSID</td>
                <td style={tdStyle}>Builds a profile of interests for retargeting ads</td>
                <td style={tdStyle}>Third Party (Google)</td>
                <td style={tdStyle}>2 Years</td>
              </tr>
              <tr>
                <td style={tdStyle}>tj_UUID</td>
                <td style={tdStyle}>Used to serve relevant ads via Traffic Junkie</td>
                <td style={tdStyle}>First Party</td>
                <td style={tdStyle}>30 Days</td>
              </tr>
              <tr>
                <td style={tdStyle}>ua</td>
                <td style={tdStyle}>Unique ID for third-party advertiser targeting</td>
                <td style={tdStyle}>First Party</td>
                <td style={tdStyle}>1 Day</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 style={headerStyle}>Local Storage</h2>
        <p style={textBlockStyle}>
          Local storage allows our Website to store information locally on your device. Unlike cookies, local storage 
          data is not sent to the server with every request and can only be read by your browser.
        </p>
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Purpose</th>
                <th style={thStyle}>Type</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>recentSearch</td>
                <td style={tdStyle}>Stores list of recent searches for the dropdown menu</td>
                <td style={tdStyle}>First Party</td>
              </tr>
              <tr>
                <td style={tdStyle}>phLivePlayerQuality</td>
                <td style={tdStyle}>Sets video quality preferences for the Live Player</td>
                <td style={tdStyle}>First Party</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 style={headerStyle}>How To Control and Delete Cookies</h2>
        <div style={{ background: "#1a1a1a", padding: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={subHeaderStyle}>Cookie Banner</h3>
          <p style={textBlockStyle}>
            You can use our cookie banner to accept all cookies or choose only essential ones. For logged-in users, 
            we refresh this consent once a year or upon major policy changes.
          </p>
          <h3 style={subHeaderStyle}>Browser Settings</h3>
          <p style={{ margin: 0 }}>
            You can set your browser to refuse all cookies or alert you when they are being sent. Consult your 
            browser's "Help" or "Settings" menu (e.g., Chrome, Safari, Firefox) to manage these preferences.
          </p>
        </div>
      </section>

      <footer style={{ marginTop: "50px", padding: "20px 0", borderTop: "1px solid #333", textAlign: "center", fontSize: "13px" }}>
        {/* 🟢 THE FIX: Dynamic Copyright Year and Brand Name */}
        <p>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
      </footer>
    </div>
  );
}