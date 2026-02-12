import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import AdminUpload from "./pages/AdminUpload";
import AuthForm from "./components/AuthForm"; // 🟢 Added AuthForm
import { Home as HomeIcon, User, ShieldCheck } from "lucide-react";

export default function App() {
  const [user, setUser] = useState(null); // 🟢 Global User State
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [activeTab, setActiveTab] = useState("home");
  const [refreshKey, setRefreshKey] = useState({ home: 0, profile: 0 });

  const handleTabClick = (tab) => {
    if (activeTab === tab) {
      setRefreshKey((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setActiveTab(tab);
    }
  };

  // 🟢 1. Handle Successful Login
  const onLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("token", userToken);
  };

  // 🟢 2. Load Google Script & Check Auth on Mount
  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    // Initial session check (Replace with your /api/auth/me call)
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
      });
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") setActiveTab("admin");
  }, []);

  // 🟢 3. Force Login if no user is found
  if (!user && !token) {
    return <AuthForm onLoginSuccess={onLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="pb-20">
        {activeTab === "home" && (
          <Home key={`home-${refreshKey.home}`} user={user} />
        )}
        
        {activeTab === "profile" && (
          <Profile key={`profile-${refreshKey.profile}`} user={user} />
        )}

        {activeTab === "admin" && (
          <AdminUpload />
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav style={navStyle}>
        <button 
          onClick={() => handleTabClick("home")}
          style={{...btnStyle, color: activeTab === 'home' ? '#fff' : '#666'}}
        >
          <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span style={labelStyle}>Home</span>
        </button>

        <button 
          onClick={() => handleTabClick("profile")}
          style={{...btnStyle, color: activeTab === 'profile' ? '#fff' : '#666'}}
        >
          <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span style={labelStyle}>Profile</span>
        </button>

        {activeTab === "admin" && (
          <button 
            onClick={() => setActiveTab("admin")}
            style={{...btnStyle, color: '#ff3b30'}}
          >
            <ShieldCheck size={24} />
            <span style={labelStyle}>Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
}

// 🎨 Styles (Kept your original styles)
const navStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', backgroundColor: '#121212', borderTop: '1px solid #222', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 1000, paddingBottom: 'env(safe-area-inset-bottom)' };
const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' };
const labelStyle = { fontSize: '10px', fontWeight: '600' };