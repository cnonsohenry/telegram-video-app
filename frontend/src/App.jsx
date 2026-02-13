import { useEffect, useState, useMemo } from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import AdminUpload from "./pages/AdminUpload";
import AuthForm from "./components/AuthForm"; 
import { Home as HomeIcon, User, ShieldCheck } from "lucide-react";

export default function App() {
  // 🟢 1. The ONLY source of truth: localStorage
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [isFooterVisible, setIsFooterVisible] = useState(true);

  // 🟢 2. LOGIN: Updates storage AND state in one millisecond
  const onLoginSuccess = (userData, userToken) => {
    localStorage.setItem("token", userToken);
    setToken(userToken); // React notices this instantly
    setUser(userData);
    setActiveTab("home"); // Go home first to refresh the view
  };

  // 🟢 3. LOGOUT: Clears everything and HARD RESETS
  const onLogout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    setActiveTab("home");
    // This is the "kill switch" for Google GSI ghost sessions
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    window.location.href = "/"; // Force browser to drop all memory
  };

  // 🟢 4. SYNC: Fetch user data if token exists but user doesn't
  useEffect(() => {
    if (token && !user) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setUser(data))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
      });
    }
  }, [token, user]); // Only run when identity changes

  // 🟢 5. Determine if we are "Logged In" once per render
  const isLoggedIn = useMemo(() => !!token, [token]);

  return (
    <div className="min-h-screen bg-black text-white">
      <main style={{ paddingBottom: isFooterVisible ? "90px" : "0" }}> 
        
        {/* HOME: Always visible */}
        {activeTab === "home" && (
          <Home 
            user={user} 
            onProfileClick={() => setActiveTab("profile")}
            setHideFooter={(val) => setIsFooterVisible(!val)}
          />
        )}
        
        {/* PROFILE: Atomic Guard */}
        {activeTab === "profile" && (
          isLoggedIn ? (
            <Profile 
              user={user} 
              onLogout={onLogout} 
              setHideFooter={(val) => setIsFooterVisible(!val)} 
            />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )
        )}

        {/* ADMIN: Atomic Guard */}
        {activeTab === "admin" && (
          isLoggedIn && user?.role === 'admin' ? (
            <AdminUpload />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )
        )}
      </main>

      {/* FOOTER */}
      {isFooterVisible && (
        <nav style={navStyle}>
          <button onClick={() => setActiveTab("home")} style={{...btnStyle, color: activeTab === 'home' ? '#ff3b30' : '#8e8e8e'}}>
            <HomeIcon size={24} />
            <span style={labelStyle}>Home</span>
          </button>

          <button onClick={() => setActiveTab("profile")} style={{...btnStyle, color: activeTab === 'profile' ? '#ff3b30' : '#8e8e8e'}}>
            <User size={24} />
            <span style={labelStyle}>Profile</span>
          </button>

          {user?.role === 'admin' && (
            <button onClick={() => setActiveTab("admin")} style={{...btnStyle, color: activeTab === 'admin' ? '#ff3b30' : '#8e8e8e'}}>
              <ShieldCheck size={24} />
              <span style={labelStyle}>Admin</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

// Styles...
const navStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', backgroundColor: '#121212', borderTop: '1px solid #222', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 10000 };
const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1 };
const labelStyle = { fontSize: '10px', fontWeight: '700' };