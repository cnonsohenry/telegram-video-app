import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, CheckCircle, Share2, Heart, Lock, Grid3X3, 
  MapPin, Calendar, Globe, Sparkles, Send, Play, Loader2, MessageCircle
} from "lucide-react";
import { APP_CONFIG } from "../config";
import VideoCard from "./VideoCard";
import CreatorTipModal from "./CreatorTipModal";
import CreatorSubscribeModal from "./CreatorSubscribeModal";

export default function CreatorProfileModal({ 
  creatorUsername, 
  currentUser, 
  onClose, 
  onVideoClick, 
  setShowPaywall 
}) {
  const [creatorData, setCreatorData] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("posts");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [videoPage, setVideoPage] = useState(1);
  const [hasMoreVideos, setHasMoreVideos] = useState(false);
  const [loadingMoreVideos, setLoadingMoreVideos] = useState(false);

  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    const fetchCreator = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${creatorUsername}`, { headers });
        if (!res.ok) throw new Error("Creator not found");

        const data = await res.json();
        if (isMounted) {
          setCreatorData(data.creator);
          setVideos(data.videos || []);
          setIsSubscribed(Boolean(data.creator.is_subscribed));
          setSubscribersCount(Number(data.creator.stats?.subscribers || 0));
          setHasMoreVideos(Boolean(data.videos && data.videos.length >= 12));
          setVideoPage(1);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCreator();

    return () => {
      isMounted = false;
    };
  }, [creatorUsername]);

  const handleLoadMoreVideos = async () => {
    if (loadingMoreVideos || !hasMoreVideos) return;
    setLoadingMoreVideos(true);
    const nextPage = videoPage + 1;
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(creatorUsername)}/videos?page=${nextPage}&limit=12`);
      const data = await res.json();
      if (data?.videos && data.videos.length > 0) {
        setVideos(prev => {
          const map = new Map();
          prev.forEach(v => map.set(`${v.chat_id}:${v.message_id}`, v));
          data.videos.forEach(v => map.set(`${v.chat_id}:${v.message_id}`, v));
          return Array.from(map.values());
        });
        setVideoPage(nextPage);
        setHasMoreVideos(Boolean(data.hasMore));
      } else {
        setHasMoreVideos(false);
      }
    } catch (err) {
      console.error("Failed to load more videos", err);
    } finally {
      setLoadingMoreVideos(false);
    }
  };

  const handleSubscribeToggle = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to subscribe to creators!");
      return;
    }

    if (creatorData?.is_owner) {
      alert("This is your own profile!");
      return;
    }

    const price = Number(creatorData?.subscription_price || 0);

    // If currently subscribed, confirm cancellation
    if (isSubscribed) {
      const confirmed = window.confirm(`Are you sure you want to cancel your subscription to @${creatorData?.username || creatorUsername}?`);
      if (!confirmed) return;

      setIsSubscribing(true);
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${creatorUsername}/subscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to cancel subscription");
        }
        setIsSubscribed(false);
        setSubscribersCount(data.subscribers_count);
      } catch (e) {
        alert(e.message || "Failed to cancel subscription");
      } finally {
        setIsSubscribing(false);
      }
      return;
    }

    // If paid subscription, launch NOWPayments crypto checkout!
    if (price > 0) {
      setShowSubscribeModal(true);
      return;
    }

    // Free subscription (price === 0)
    setIsSubscribing(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${creatorUsername}/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update subscription");
      }
      setIsSubscribed(data.subscribed);
      setSubscribersCount(data.subscribers_count);
    } catch (e) {
      alert(e.message || "Failed to update subscription");
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/?creator=${creatorUsername}`;
    if (navigator.share) {
      navigator.share({
        title: `${creatorData?.display_name || creatorUsername} on ${APP_CONFIG.appNamePrefix}`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Profile link copied to clipboard!");
    }
  };

  const banner = creatorData?.banner_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80";
  const avatar = creatorData?.avatar_url || "/assets/default-avatar.png";
  const price = Number(creatorData?.subscription_price || 0);

  return (
    <div style={containerStyle}>
      {/* Top Navbar */}
      <div style={topNavStyle}>
        <button onClick={onClose} style={navBtnStyle}>
          <ArrowLeft size={22} color="#fff" />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={topNavNameStyle}>{creatorData?.display_name || creatorUsername}</span>
          <CheckCircle size={15} color="#00aff0" fill="#00aff0" />
        </div>
        <button onClick={handleShare} style={navBtnStyle}>
          <Share2 size={20} color="#fff" />
        </button>
      </div>

      {loading ? (
        <div style={loaderCenterStyle}>
          <Loader2 size={32} className="animate-spin" color="var(--primary-color)" />
          <span style={{ marginTop: "12px", color: "#8e8e93", fontSize: "14px" }}>Loading creator profile...</span>
        </div>
      ) : error ? (
        <div style={errorCenterStyle}>
          <span style={{ fontSize: "16px", color: "#fff", fontWeight: "700" }}>Creator Not Found</span>
          <p style={{ color: "#8e8e93", fontSize: "13px", marginTop: "4px" }}>The requested creator could not be found or has not set up their profile yet.</p>
          <button onClick={onClose} style={errorBackBtnStyle}>Back to Feed</button>
        </div>
      ) : (
        <div style={scrollContentStyle}>
          
          {/* Cover Banner */}
          <div style={{ ...bannerContainerStyle, backgroundImage: `url(${banner})` }}>
            <div style={bannerGradientOverlay} />
          </div>

          <div style={profileInnerContainer}>
            {/* Avatar & Main Action Buttons Row */}
            <div style={avatarRowStyle}>
              <div style={avatarWrapperStyle}>
                <img 
                  src={avatar} 
                  alt={creatorData?.display_name} 
                  style={avatarImgStyle}
                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                />
                <div style={onlineDotStyle} />
              </div>

              <div style={actionsContainerStyle}>
                <button
                  onClick={() => setShowTipModal(true)}
                  style={tipBtnStyle}
                  title="Send a Tip"
                >
                  <Heart size={16} fill="#f91880" color="#f91880" />
                  <span>Tip</span>
                </button>

                <button
                  onClick={handleSubscribeToggle}
                  disabled={isSubscribing}
                  style={{
                    ...subscribeBtnStyle,
                    background: isSubscribed ? "#222" : "linear-gradient(135deg, #00aff0, #0088cc)",
                    borderColor: isSubscribed ? "#444" : "transparent"
                  }}
                >
                  {isSubscribed ? (
                    <span style={{ color: "#00aff0", fontWeight: "700" }}>Subscribed ✓</span>
                  ) : (
                    <span>{price > 0 ? `Subscribe ₦${price.toLocaleString()}/mo` : "Subscribe for Free"}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Creator Identity */}
            <div style={identityBlockStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h1 style={creatorDisplayNameStyle}>{creatorData?.display_name || creatorUsername}</h1>
                <CheckCircle size={18} color="#00aff0" fill="#00aff0" />
              </div>

              <div style={handleRowStyle}>
                <span style={handleTextStyle}>@{creatorData?.username || creatorUsername}</span>
                <span style={categoryBadgeStyle}>{creatorData?.creator_category || "Creator"}</span>
              </div>

              {creatorData?.creator_bio && (
                <p style={bioTextStyle}>{creatorData.creator_bio}</p>
              )}

              {/* Meta & Location */}
              <div style={metaRowStyle}>
                {creatorData?.location && (
                  <div style={metaItemStyle}>
                    <MapPin size={14} color="#8e8e93" />
                    <span>{creatorData.location}</span>
                  </div>
                )}
                {creatorData?.website && (
                  <a 
                    href={creatorData.website.startsWith("http://") || creatorData.website.startsWith("https://") ? creatorData.website : `https://${creatorData.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={metaItemStyle}
                  >
                    <Globe size={14} color="#00aff0" />
                    <span style={{ color: "#00aff0" }}>{creatorData.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                <div style={metaItemStyle}>
                  <Calendar size={14} color="#8e8e93" />
                  <span>Joined {new Date(creatorData?.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                </div>
              </div>
            </div>

            {/* Stats Bar */}
            <div style={statsBarStyle}>
              <div style={statBoxStyle}>
                <span style={statNumberStyle}>{creatorData?.stats?.posts || videos.length}</span>
                <span style={statLabelStyle}>Posts</span>
              </div>
              <div style={statBoxStyle}>
                <span style={statNumberStyle}>{Intl.NumberFormat('en-US', { notation: 'compact' }).format(subscribersCount)}</span>
                <span style={statLabelStyle}>Fans</span>
              </div>
              <div style={statBoxStyle}>
                <span style={statNumberStyle}>{Intl.NumberFormat('en-US', { notation: 'compact' }).format(creatorData?.stats?.likes || 0)}</span>
                <span style={statLabelStyle}>Likes</span>
              </div>
              <div style={statBoxStyle}>
                <span style={statNumberStyle}>{Intl.NumberFormat('en-US', { notation: 'compact' }).format(creatorData?.stats?.views || 0)}</span>
                <span style={statLabelStyle}>Views</span>
              </div>
            </div>

            {/* Profile Tabs */}
            <div style={tabsNavStyle}>
              <button 
                onClick={() => setActiveTab("posts")} 
                style={{ ...tabBtnStyle, borderBottomColor: activeTab === "posts" ? "#00aff0" : "transparent", color: activeTab === "posts" ? "#fff" : "#8e8e93" }}
              >
                <Grid3X3 size={18} />
                <span>POSTS ({videos.length})</span>
              </button>
              <button 
                onClick={() => setActiveTab("premium")} 
                style={{ ...tabBtnStyle, borderBottomColor: activeTab === "premium" ? "#00aff0" : "transparent", color: activeTab === "premium" ? "#fff" : "#8e8e93" }}
              >
                <Lock size={18} />
                <span>VIP EXCLUSIVE</span>
              </button>
            </div>

            {/* Content Area */}
            {activeTab === "posts" && (
              videos.length === 0 ? (
                <div style={emptyVideosStyle}>
                  <Grid3X3 size={32} color="#555" />
                  <span style={{ marginTop: "10px", color: "#888", fontSize: "14px" }}>No public posts uploaded yet.</span>
                </div>
              ) : (
                <>
                  <div style={{
                    ...gridStyle,
                    gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)"
                  }}>
                    {videos.map((v) => (
                      <VideoCard 
                        key={`${v.chat_id}:${v.message_id}`}
                        video={v}
                        onOpen={(vData, e) => onVideoClick(vData, e)}
                        showDetails={true}
                      />
                    ))}
                  </div>
                  {hasMoreVideos && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: "24px", marginBottom: "20px" }}>
                      <button
                        onClick={handleLoadMoreVideos}
                        disabled={loadingMoreVideos}
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          borderRadius: "25px",
                          padding: "10px 24px",
                          color: "#fff",
                          fontSize: "13px",
                          fontWeight: "700",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          transition: "all 0.2s ease"
                        }}
                      >
                        {loadingMoreVideos && <Loader2 size={16} className="animate-spin" />}
                        <span>{loadingMoreVideos ? "Loading more..." : "Load More Posts"}</span>
                      </button>
                    </div>
                  )}
                </>
              )
            )}

            {activeTab === "premium" && (
              <div style={premiumTabContainerStyle}>
                <div style={lockedBannerStyle}>
                  <Lock size={36} color="#00aff0" />
                  <h3 style={{ margin: "14px 0 6px 0", fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                    VIP Exclusive Drops
                  </h3>
                  <p style={{ margin: "0 0 18px 0", color: "#8e8e93", fontSize: "13px", maxWidth: "340px", lineHeight: "1.5" }}>
                    Subscribe to {creatorData?.display_name || creatorUsername} to unlock private full-length videos, uncensored photo sets, and priority DMs.
                  </p>
                  <button 
                    onClick={handleSubscribeToggle}
                    style={unlockNowBtnStyle}
                  >
                    <span>{isSubscribed ? "You have VIP Access" : "Unlock Creator VIP"}</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Tip Modal */}
      {showTipModal && (
        <CreatorTipModal 
          creator={creatorData}
          onClose={() => setShowTipModal(false)}
          onTipSuccess={(amt) => {
            alert(`🎉 Successfully sent ₦${amt.toLocaleString()} tip to @${creatorData?.username}!`);
          }}
        />
      )}

      {/* Subscribe Modal (NOWPayments Crypto Flow) */}
      {showSubscribeModal && (
        <CreatorSubscribeModal 
          creator={creatorData}
          onClose={() => setShowSubscribeModal(false)}
          onSubscribeSuccess={() => {
            setIsSubscribed(true);
            setSubscribersCount(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}

// 🖌 Styles
const containerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  backgroundColor: "#000",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const topNavStyle = {
  height: "54px",
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "rgba(0, 0, 0, 0.85)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  zIndex: 100,
  flexShrink: 0
};

const navBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: "6px" };
const topNavNameStyle = { fontWeight: "700", fontSize: "15px", color: "#fff" };
const scrollContentStyle = { flex: 1, overflowY: "auto", paddingBottom: "60px" };

const bannerContainerStyle = {
  width: "100%",
  height: "170px",
  backgroundSize: "cover",
  backgroundPosition: "center",
  position: "relative"
};

const bannerGradientOverlay = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%)"
};

const profileInnerContainer = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "0 16px",
  position: "relative"
};

const avatarRowStyle = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  marginTop: "-45px",
  marginBottom: "12px",
  position: "relative",
  zIndex: 10
};

const avatarWrapperStyle = {
  position: "relative",
  width: "90px",
  height: "90px"
};

const avatarImgStyle = {
  width: "90px",
  height: "90px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "3.5px solid #000",
  backgroundColor: "#111"
};

const onlineDotStyle = {
  position: "absolute",
  bottom: "4px",
  right: "4px",
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  backgroundColor: "#00d084",
  border: "2.5px solid #000"
};

const actionsContainerStyle = { display: "flex", gap: "8px", alignItems: "center" };

const tipBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  backgroundColor: "rgba(249, 24, 128, 0.12)",
  border: "1px solid rgba(249, 24, 128, 0.3)",
  color: "#f91880",
  borderRadius: "20px",
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer"
};

const subscribeBtnStyle = {
  padding: "8px 18px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "800",
  color: "#fff",
  border: "1px solid transparent",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(0, 175, 240, 0.3)"
};

const identityBlockStyle = { marginTop: "6px" };
const creatorDisplayNameStyle = { margin: 0, fontSize: "20px", fontWeight: "800", color: "#fff" };
const handleRowStyle = { display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" };
const handleTextStyle = { color: "#8e8e93", fontSize: "14px" };

const categoryBadgeStyle = {
  backgroundColor: "rgba(0, 175, 240, 0.15)",
  color: "#00aff0",
  border: "1px solid rgba(0, 175, 240, 0.3)",
  borderRadius: "12px",
  padding: "2px 8px",
  fontSize: "10px",
  fontWeight: "800",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const bioTextStyle = { color: "#e5e5ea", fontSize: "14px", lineHeight: "1.5", margin: "10px 0" };

const metaRowStyle = { display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "6px" };
const metaItemStyle = { display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#8e8e93", textDecoration: "none" };

const statsBarStyle = {
  display: "flex",
  justifyContent: "space-around",
  backgroundColor: "#111",
  borderRadius: "16px",
  padding: "12px 16px",
  marginTop: "16px",
  border: "1px solid #222"
};

const statBoxStyle = { display: "flex", flexDirection: "column", alignItems: "center" };
const statNumberStyle = { fontWeight: "800", fontSize: "16px", color: "#fff" };
const statLabelStyle = { fontSize: "11px", color: "#8e8e93", textTransform: "uppercase", marginTop: "2px" };

const tabsNavStyle = {
  display: "flex",
  borderBottom: "1px solid #222",
  marginTop: "18px",
  gap: "24px"
};

const tabBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 6px",
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer"
};

const gridStyle = { display: "grid", gap: "10px", marginTop: "14px" };

const emptyVideosStyle = {
  padding: "50px 20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center"
};

const premiumTabContainerStyle = { padding: "40px 16px", display: "flex", justifyContent: "center" };

const lockedBannerStyle = {
  backgroundColor: "#111",
  border: "1px solid #2a2a2c",
  borderRadius: "20px",
  padding: "36px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  width: "100%",
  maxWidth: "420px"
};

const unlockNowBtnStyle = {
  background: "linear-gradient(135deg, #00aff0, #0088cc)",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "12px 24px",
  fontWeight: "800",
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(0, 175, 240, 0.4)"
};

const loaderCenterStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "300px"
};

const errorCenterStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
  textAlign: "center"
};

const errorBackBtnStyle = {
  marginTop: "16px",
  backgroundColor: "#222",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: "10px",
  padding: "8px 18px",
  cursor: "pointer"
};
