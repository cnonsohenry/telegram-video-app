import React from "react";

export default function AboutUs() {
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
      maxWidth: "900px",
      margin: "0 auto",
      padding: "40px 20px"
    }}>

      <section>
        <h1 style={headerStyle}>About Naijahomemade</h1>
        <p style={textBlockStyle}>
          Welcome to <strong>Naijahomemade</strong>, where passion meets privilege, and fandom reaches new heights! We're not just a platform; we're your exclusive gateway to an immersive world of entertainment and connection. Here, being a fan means more – it means having the key to unlock doors others can only dream of opening.
        </p>
        <p style={textBlockStyle}>
          Our Naijahomemade experience is designed for those who crave more than just the ordinary. It's a journey that begins with exploration, as you navigate through a curated universe of exclusive content and behind-the-scenes wonders. From unreleased tracks to intimate moments with your favorite creators, we ensure you're not just a spectator but an integral part of the magic.
        </p>
      </section>

      <section style={highlightBox}>
        <h2 style={{ ...subHeaderStyle, marginTop: 0 }}>Who Are We?</h2>
        <p style={textBlockStyle}>
          Founded on the belief in the transformative power of creativity, <strong>Naijahomemade</strong> was born from a desire to address the unique challenges faced by African content creators in the digital landscape. We understand the ambition and passion driving these individuals and are committed to providing the tools, resources, and community they need to succeed.
        </p>
        <p style={{ margin: 0 }}>
          Our team comprises dedicated professionals with a deep understanding of the African creative landscape. We blend the personalities of the <strong>Jester, Lover, Creator, and Explorer</strong>—bringing fun, fostering community, innovating content creation, and constantly seeking opportunities to showcase African talent to the world.
        </p>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
        <div style={highlightBox}>
          <h3 style={{ ...subHeaderStyle, marginTop: 0 }}>Our Mission</h3>
          <p style={{ margin: 0 }}>
            To empower the next generation of African creators by providing a global platform for monetization and fan engagement, enabling them to achieve financial freedom and artistic fulfillment.
          </p>
        </div>
        <div style={highlightBox}>
          <h3 style={{ ...subHeaderStyle, marginTop: 0 }}>Our Vision</h3>
          <p style={{ margin: 0 }}>
            A world where every African creator can effortlessly monetize their talent, build a sustainable career, and connect with a global audience.
          </p>
        </div>
      </div>

      <section>
        <h2 style={headerStyle}>Our Values</h2>
        <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <li><strong style={{ color: "#fff" }}>Passion:</strong> You should be able to make a living doing what you love.</li>
          <li><strong style={{ color: "#fff" }}>Sustainability:</strong> We build platforms for lasting careers, rewarding hard work and dedication.</li>
          <li><strong style={{ color: "#fff" }}>Transparency:</strong> Trust is essential. We are open and honest with our creators and fans.</li>
          <li><strong style={{ color: "#fff" }}>Innovation:</strong> We are constantly pushing boundaries to create new ways to connect and earn.</li>
          <li><strong style={{ color: "#fff" }}>Creativity:</strong> We celebrate the power of imagination and reward creative expression.</li>
        </ul>
      </section>

      <section>
        <h2 style={headerStyle}>What Makes Us Different</h2>
        <p style={textBlockStyle}>
          Unlike other platforms, <strong>Naijahomemade</strong> is specifically focused on empowering African creators. We understand the unique cultural context, challenges, and opportunities in the African market.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div>
            <strong style={{ color: "#fff" }}>Tailored Monetization:</strong> 
            <span style={{ marginLeft: "5px" }}>Revenue options including subscriptions, tips, merchandise, and brand partnerships.</span>
          </div>
          <div>
            <strong style={{ color: "#fff" }}>Global Reach:</strong> 
            <span style={{ marginLeft: "5px" }}>Access to a diverse international audience with dedicated promotion of African talent.</span>
          </div>
          <div>
            <strong style={{ color: "#fff" }}>Supportive Community:</strong> 
            <span style={{ marginLeft: "5px" }}>A network providing resources and mentorship specifically tailored to African needs.</span>
          </div>
          <div>
            <strong style={{ color: "#fff" }}>Safety & Sensitivity:</strong> 
            <span style={{ marginLeft: "5px" }}>A safe, inclusive environment sensitive to diverse cultural contexts.</span>
          </div>
        </div>
      </section>

      <section>
        <h2 style={headerStyle}>Looking Ahead</h2>
        <p style={textBlockStyle}>
          We envision <strong>Naijahomemade</strong> becoming the leading platform for African creators, driving economic growth within the continent's digital economy and showcasing incredible talent to the world. We are continuously developing new features and expanding our resources to further empower our community.
        </p>
      </section>

      <footer style={{ marginTop: "50px", padding: "20px 0", borderTop: "1px solid #333", textAlign: "center", fontSize: "13px" }}>
        <p>© 2026 Naijahomemade. All content is for personal, non-commercial use only.</p>
      </footer>
    </div>
  );
}