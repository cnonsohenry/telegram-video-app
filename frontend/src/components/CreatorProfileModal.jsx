import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, CheckCircle, Share2, Heart, Lock, Grid3X3, 
  MapPin, Calendar, Globe, Sparkles, Send, Play, Loader2, MessageCircle,
  Film, Link2, ChevronDown, Plus
} from "lucide-react";
import { APP_CONFIG } from "../config";
import VideoCard from "./VideoCard";
import InstagramMediaCard from "./InstagramMediaCard";
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

  const formatStat = (num) => {
    const n = Number(num) || 0;
    return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  };

  const avatar = creatorData?.avatar_url || "/assets/default-avatar.png";
  const price = Number(creatorData?.subscription_price || 0);
  const postsCount = creatorData?.stats?.posts || videos.length || 0;
  const likesCount = creatorData?.stats?.likes || 0;

  const highlights = [
    { id: "vip", title: "VIP Drops", icon: Sparkles, color: "#FFD700", tab: "premium" },
    { id: "reels", title: "Reels", icon: Film, color: "#0095f6", tab: "reels" },
    { id: "posts", title: "All Posts", icon: Grid3X3, color: "#fff", tab: "posts" }
  ];

  const displayedVideos = activeTab === "reels" 
    ? videos.filter(v => !v.is_group) 
    : activeTab === "premium"
    ? videos.filter(v => v.category === "premium")
    : videos;

  return (
    <div style={containerStyle}>
      {/* Top Navbar */}
      <div style={topNavStyle}>
        <button onClick={onClose} style={navBtnStyle} title="Back">
          <ArrowLeft size={22} color="#fff" />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={topNavNameStyle}>{creatorData?.username || creatorUsername}</span>
          <CheckCircle size={15} color="#0095f6" fill="#0095f6" />
        </div>
        <button onClick={handleShare} style={navBtnStyle} title="Share Profile">
          <Share2 size={20} color="#fff" />
        </button>
      </div>

      {loading ? (
        <div style={loaderCenterStyle}>
          <Loader2 size={32} className="animate-spin" color="#0095f6" />
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
          <div style={profileInnerContainer}>
            
            {/* MOBILE HEADER */}
            {!isDesktop ? (
              <div style={{ padding: "16px 16px 8px 16px" }}>
                {/* Row 1: Avatar + 3 Stat Columns */}
                <div style={{ display: "flex", alignItems: "center", marginBottom: "14px" }}>
                  <div style={storyGradientRingMobile}>
                    <div style={avatarInnerCircleMobile}>
                      <img 
                        src={avatar} 
                        alt={creatorData?.display_name} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flex: 1, justifyContent: "space-around", alignItems: "center", marginLeft: "12px" }}>
                    <div style={statColStyle}>
                      <span style={statNumberStyle}>{formatStat(postsCount)}</span>
                      <span style={statLabelStyle}>posts</span>
                    </div>
                    <div style={statColStyle}>
                      <span style={statNumberStyle}>{formatStat(subscribersCount)}</span>
                      <span style={statLabelStyle}>followers</span>
                    </div>
                    <div style={statColStyle}>
                      <span style={statNumberStyle}>{formatStat(likesCount)}</span>
                      <span style={statLabelStyle}>likes</span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Identity & Bio */}
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h1 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                      {creatorData?.display_name || creatorUsername}
                    </h1>
                    <CheckCircle size={15} color="#0095f6" fill="#0095f6" />
                    <span style={creatorBadgeTagStyle}>CREATOR</span>
                  </div>

                  <div style={{ fontSize: "12.5px", color: "#8e8e93", marginTop: "2px", fontWeight: "500" }}>
                    {creatorData?.creator_category || "Digital Creator"}
                  </div>

                  {creatorData?.creator_bio && (
                    <p style={{
                      fontSize: "13.5px",
                      color: "#f5f5f5",
                      lineHeight: "1.42",
                      margin: "8px 0 6px 0",
                      whiteSpace: "pre-wrap"
                    }}>
                      {creatorData.creator_bio}
                    </p>
                  )}

                  {/* Links & Meta */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginTop: "6px", fontSize: "13px" }}>
                    {creatorData?.website && (
                      <a 
                        href={creatorData.website.startsWith("http://") || creatorData.website.startsWith("https://") ? creatorData.website : `https://${creatorData.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={websiteLinkStyle}
                      >
                        <Link2 size={13} color="#0095f6" />
                        <span>{creatorData.website.replace(/^https?:\/\//, "")}</span>
                      </a>
                    )}
                    {creatorData?.location && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#8e8e93" }}>
                        <MapPin size={13} color="#8e8e93" />
                        <span>{creatorData.location}</span>
                      </span>
                    )}
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#8e8e93" }}>
                      <Calendar size={13} color="#8e8e93" />
                      <span>Joined {new Date(creatorData?.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                    </span>
                  </div>

                  {price > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <span style={vipPricingBadgeStyle}>
                        <Sparkles size={12} color="#FFD700" />
                        <span>VIP Channel: ₦{price.toLocaleString()}/mo</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Row 3: Action Buttons */}
                <div style={mobileActionButtonsRow}>
                  <button
                    onClick={handleSubscribeToggle}
                    disabled={isSubscribing}
                    style={{
                      ...mobileSubscribeBtn,
                      backgroundColor: isSubscribed ? "#262626" : "#0095f6",
                      color: "#ffffff"
                    }}
                  >
                    {isSubscribed ? (
                      <span>Subscribed ✓</span>
                    ) : (
                      <span>{price > 0 ? `Subscribe · ₦${price.toLocaleString()}/mo` : "Follow"}</span>
                    )}
                  </button>

                  <button
                    onClick={() => setShowTipModal(true)}
                    style={mobileSecondaryBtn}
                    title="Send a Tip"
                  >
                    <Heart size={15} fill="#f91880" color="#f91880" />
                    <span>Tip</span>
                  </button>

                  <button
                    onClick={handleShare}
                    style={mobileIconBtn}
                    title="Share Profile"
                  >
                    <Share2 size={16} color="#fff" />
                  </button>
                </div>
              </div>
            ) : (
              /* DESKTOP HEADER */
              <div style={{ display: "flex", gap: "60px", alignItems: "flex-start", padding: "36px 20px 20px 20px", marginBottom: "16px" }}>
                <div style={{ flexShrink: 0, position: "relative", paddingLeft: "15px" }}>
                  <div style={storyGradientRingDesktop}>
                    <div style={avatarInnerCircleDesktop}>
                      <img 
                        src={avatar} 
                        alt={creatorData?.display_name} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  {/* Row 1: Username + Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <h2 style={{ fontSize: "20px", fontWeight: "400", color: "#fff", margin: 0 }}>
                        {creatorData?.username || creatorUsername}
                      </h2>
                      <CheckCircle size={18} color="#0095f6" fill="#0095f6" />
                      <span style={creatorBadgeTagStyle}>CREATOR</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        onClick={handleSubscribeToggle}
                        disabled={isSubscribing}
                        style={{
                          ...desktopSubscribeBtn,
                          backgroundColor: isSubscribed ? "#262626" : "#0095f6",
                          color: "#ffffff"
                        }}
                      >
                        {isSubscribed ? (
                          <span>Subscribed ✓</span>
                        ) : (
                          <span>{price > 0 ? `Subscribe · ₦${price.toLocaleString()}/mo` : "Follow"}</span>
                        )}
                      </button>

                      <button
                        onClick={() => setShowTipModal(true)}
                        style={desktopSecondaryBtn}
                      >
                        <Heart size={15} fill="#f91880" color="#f91880" />
                        <span>Send Tip</span>
                      </button>

                      <button onClick={handleShare} style={desktopIconBtnStyle} title="Share Profile">
                        <Share2 size={16} color="#fff" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Stats */}
                  <div style={{ display: "flex", gap: "40px", marginBottom: "18px", fontSize: "15px" }}>
                    <div>
                      <strong style={{ color: "#fff" }}>{formatStat(postsCount)}</strong>{" "}
                      <span style={{ color: "#8e8e93" }}>posts</span>
                    </div>
                    <div>
                      <strong style={{ color: "#fff" }}>{formatStat(subscribersCount)}</strong>{" "}
                      <span style={{ color: "#8e8e93" }}>followers</span>
                    </div>
                    <div>
                      <strong style={{ color: "#fff" }}>{formatStat(likesCount)}</strong>{" "}
                      <span style={{ color: "#8e8e93" }}>likes</span>
                    </div>
                  </div>

                  {/* Row 3: Name, Category, Bio, Links */}
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                      {creatorData?.display_name || creatorUsername}
                    </div>

                    <div style={{ fontSize: "13px", color: "#8e8e93", marginTop: "2px" }}>
                      {creatorData?.creator_category || "Digital Creator"}
                    </div>

                    {creatorData?.creator_bio && (
                      <p style={{
                        fontSize: "14px",
                        color: "#f5f5f5",
                        lineHeight: "1.45",
                        margin: "8px 0 8px 0",
                        whiteSpace: "pre-wrap",
                        maxWidth: "540px"
                      }}>
                        {creatorData.creator_bio}
                      </p>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", fontSize: "13px" }}>
                      {creatorData?.website && (
                        <a 
                          href={creatorData.website.startsWith("http://") || creatorData.website.startsWith("https://") ? creatorData.website : `https://${creatorData.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={websiteLinkStyle}
                        >
                          <Link2 size={13} color="#0095f6" />
                          <span>{creatorData.website.replace(/^https?:\/\//, "")}</span>
                        </a>
                      )}
                      {creatorData?.location && (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#8e8e93" }}>
                          <MapPin size={13} color="#8e8e93" />
                          <span>{creatorData.location}</span>
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#8e8e93" }}>
                        <Calendar size={13} color="#8e8e93" />
                        <span>Joined {new Date(creatorData?.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 🌟 STORY HIGHLIGHTS */}
            <div style={{ padding: isDesktop ? "0 20px 14px 20px" : "0 16px 14px 16px" }}>
              <div style={highlightsContainerStyle}>
                {highlights.map((h) => {
                  const Icon = h.icon;
                  const isActive = activeTab === h.tab;
                  return (
                    <div 
                      key={h.id} 
                      onClick={() => setActiveTab(h.tab)} 
                      style={highlightItemStyle}
                    >
                      <div style={{
                        ...highlightCircleOuterStyle,
                        borderColor: isActive ? "#0095f6" : "rgba(255, 255, 255, 0.16)"
                      }}>
                        <div style={highlightCircleInnerStyle}>
                          <Icon size={18} color={h.color} />
                        </div>
                      </div>
                      <span style={{
                        ...highlightLabelStyle,
                        color: isActive ? "#fff" : "#8e8e93",
                        fontWeight: isActive ? "700" : "500"
                      }}>
                        {h.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 🌟 INSTAGRAM TABS */}
            <div style={{ 
              ...tabsContainerStyle, 
              justifyContent: isDesktop ? "center" : "space-around",
              gap: isDesktop ? "50px" : "0",
              borderTop: "1px solid #262626"
            }}>
              <button 
                onClick={() => setActiveTab("posts")} 
                style={{ 
                  ...tabBtnStyle, 
                  borderTop: (isDesktop && activeTab === "posts") ? "1px solid #ffffff" : "none",
                  borderBottom: (!isDesktop && activeTab === "posts") ? "2px solid #ffffff" : "none",
                  opacity: activeTab === "posts" ? 1 : 0.4, 
                  color: activeTab === "posts" ? "#ffffff" : "#a8a8a8" 
                }}
              >
                <Grid3X3 size={isDesktop ? 16 : 22} />
                {isDesktop && <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px" }}>POSTS</span>}
              </button>
              <button 
                onClick={() => setActiveTab("reels")} 
                style={{ 
                  ...tabBtnStyle, 
                  borderTop: (isDesktop && activeTab === "reels") ? "1px solid #ffffff" : "none",
                  borderBottom: (!isDesktop && activeTab === "reels") ? "2px solid #ffffff" : "none",
                  opacity: activeTab === "reels" ? 1 : 0.4, 
                  color: activeTab === "reels" ? "#ffffff" : "#a8a8a8" 
                }}
              >
                <Film size={isDesktop ? 16 : 22} />
                {isDesktop && <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px" }}>REELS</span>}
              </button>
              <button 
                onClick={() => setActiveTab("premium")} 
                style={{ 
                  ...tabBtnStyle, 
                  borderTop: (isDesktop && activeTab === "premium") ? "1px solid #ffffff" : "none",
                  borderBottom: (!isDesktop && activeTab === "premium") ? "2px solid #ffffff" : "none",
                  opacity: activeTab === "premium" ? 1 : 0.4, 
                  color: activeTab === "premium" ? "#ffffff" : "#a8a8a8" 
                }}
              >
                <Lock size={isDesktop ? 16 : 22} />
                {isDesktop && <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px" }}>VIP EXCLUSIVE</span>}
              </button>
            </div>

            {/* 🌟 3-COLUMN INSTAGRAM SQUARE MEDIA GRID */}
            {activeTab === "premium" && !isSubscribed && !creatorData?.is_owner ? (
              <div style={premiumTabContainerStyle}>
                <div style={lockedBannerStyle}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "rgba(255, 215, 0, 0.12)", border: "1px solid rgba(255, 215, 0, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                    <Lock size={26} color="#FFD700" />
                  </div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                    VIP Exclusive Drops
                  </h3>
                  <p style={{ margin: "0 0 20px 0", color: "#8e8e93", fontSize: "13px", maxWidth: "340px", lineHeight: "1.5" }}>
                    Subscribe to @{creatorData?.username || creatorUsername} to unlock private full-length videos, uncensored drops, and member-only updates.
                  </p>
                  <button 
                    onClick={handleSubscribeToggle}
                    style={unlockNowBtnStyle}
                  >
                    <span>{price > 0 ? `Unlock VIP for ₦${price.toLocaleString()}/mo` : "Join VIP Community"}</span>
                  </button>
                </div>
              </div>
            ) : (
              displayedVideos.length === 0 ? (
                <div style={emptyVideosStyle}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "50%", border: "2px solid #333", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                    <Grid3X3 size={26} color="#555" />
                  </div>
                  <span style={{ color: "#fff", fontWeight: "700", fontSize: "15px" }}>No Posts Yet</span>
                  <span style={{ marginTop: "4px", color: "#8e8e93", fontSize: "13px" }}>When @{creatorUsername} uploads posts or reels, they will appear here.</span>
                </div>
              ) : (
                <div style={{ padding: isDesktop ? "16px 0" : "0" }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: isDesktop ? "4px" : "2px",
                    width: "100%"
                  }}>
                    {displayedVideos.map((v) => (
                      <InstagramMediaCard 
                        key={`${v.chat_id}:${v.message_id}`}
                        video={v}
                        onClick={(vData, e) => onVideoClick(vData, e)}
                        isDesktop={isDesktop}
                      />
                    ))}
                  </div>

                  {hasMoreVideos && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: "24px", marginBottom: "20px" }}>
                      <button
                        onClick={handleLoadMoreVideos}
                        disabled={loadingMoreVideos}
                        style={{
                          background: "#262626",
                          border: "1px solid #363636",
                          borderRadius: "8px",
                          padding: "8px 20px",
                          color: "#fff",
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px"
                        }}
                      >
                        {loadingMoreVideos && <Loader2 size={16} className="animate-spin" />}
                        <span>{loadingMoreVideos ? "Loading more..." : "Load More Posts"}</span>
                      </button>
                    </div>
                  )}
                </div>
              )
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

// 🖌 Styles (Clean AMOLED Instagram Dark Theme)
const containerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  backgroundColor: "#000000",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const topNavStyle = {
  height: "48px",
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#000000",
  borderBottom: "1px solid #1c1c1e",
  zIndex: 100,
  flexShrink: 0
};

const navBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center" };
const topNavNameStyle = { fontWeight: "700", fontSize: "16px", color: "#fff" };
const scrollContentStyle = { flex: 1, overflowY: "auto", paddingBottom: "60px" };

const profileInnerContainer = {
  maxWidth: "935px",
  margin: "0 auto",
  width: "100%"
};

// Story Gradient Rings
const storyGradientRingMobile = {
  padding: "2.5px",
  borderRadius: "50%",
  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
  display: "inline-block",
  flexShrink: 0
};

const avatarInnerCircleMobile = {
  width: "78px",
  height: "78px",
  borderRadius: "50%",
  border: "2.5px solid #000000",
  overflow: "hidden",
  backgroundColor: "#1c1c1e"
};

const storyGradientRingDesktop = {
  padding: "3.5px",
  borderRadius: "50%",
  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
  display: "inline-block"
};

const avatarInnerCircleDesktop = {
  width: "140px",
  height: "140px",
  borderRadius: "50%",
  border: "3.5px solid #000000",
  overflow: "hidden",
  backgroundColor: "#1c1c1e"
};

// Stat Columns
const statColStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center"
};

const statNumberStyle = {
  fontSize: "17px",
  fontWeight: "700",
  color: "#ffffff"
};

const statLabelStyle = {
  fontSize: "13px",
  color: "#a8a8a8",
  marginTop: "1px",
  fontWeight: "400"
};

// Badges and Links
const creatorBadgeTagStyle = {
  fontSize: "9px",
  fontWeight: "800",
  color: "#FFD700",
  backgroundColor: "rgba(255, 215, 0, 0.12)",
  border: "1px solid rgba(255, 215, 0, 0.3)",
  borderRadius: "4px",
  padding: "2px 6px",
  letterSpacing: "0.5px"
};

const websiteLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  color: "#0095f6",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: "600"
};

const vipPricingBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  backgroundColor: "rgba(255, 215, 0, 0.08)",
  border: "1px solid rgba(255, 215, 0, 0.25)",
  borderRadius: "6px",
  padding: "3px 8px",
  fontSize: "12px",
  fontWeight: "700",
  color: "#FFD700"
};

// Mobile Action Buttons
const mobileActionButtonsRow = {
  display: "flex",
  gap: "8px",
  marginTop: "12px"
};

const mobileSubscribeBtn = {
  flex: 1,
  height: "34px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "700",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const mobileSecondaryBtn = {
  height: "34px",
  padding: "0 16px",
  backgroundColor: "#262626",
  color: "#ffffff",
  border: "1px solid #363636",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer"
};

const mobileIconBtn = {
  height: "34px",
  width: "36px",
  backgroundColor: "#262626",
  border: "1px solid #363636",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};

// Desktop Action Buttons
const desktopSubscribeBtn = {
  height: "34px",
  padding: "0 20px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "700",
  border: "none",
  cursor: "pointer"
};

const desktopSecondaryBtn = {
  height: "34px",
  padding: "0 16px",
  backgroundColor: "#262626",
  color: "#ffffff",
  border: "1px solid #363636",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer"
};

const desktopIconBtnStyle = {
  background: "#262626",
  border: "1px solid #363636",
  borderRadius: "8px",
  width: "36px",
  height: "34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};

// Story Highlights
const highlightsContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  overflowX: "auto",
  paddingBottom: "8px",
  scrollbarWidth: "none",
  msOverflowStyle: "none"
};

const highlightItemStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer",
  flexShrink: 0
};

const highlightCircleOuterStyle = {
  width: "64px",
  height: "64px",
  borderRadius: "50%",
  border: "1.5px solid rgba(255, 255, 255, 0.16)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "3px",
  transition: "border-color 0.2s ease"
};

const highlightCircleInnerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  backgroundColor: "#16181c",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const highlightLabelStyle = {
  fontSize: "11px",
  color: "#a8a8a8",
  textAlign: "center",
  maxWidth: "68px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

// Tabs
const tabsContainerStyle = {
  display: "flex",
  position: "sticky",
  top: 0,
  background: "#000000",
  zIndex: 90
};

const tabBtnStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  background: "none",
  border: "none",
  padding: "14px 0",
  cursor: "pointer",
  flex: 1,
  transition: "all 0.15s ease"
};

// Empty & Locked States
const emptyVideosStyle = {
  padding: "80px 20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center"
};

const premiumTabContainerStyle = {
  padding: "50px 16px",
  display: "flex",
  justifyContent: "center"
};

const lockedBannerStyle = {
  backgroundColor: "#16181c",
  border: "1px solid #262626",
  borderRadius: "16px",
  padding: "36px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  width: "100%",
  maxWidth: "400px"
};

const unlockNowBtnStyle = {
  background: "#0095f6",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 24px",
  fontWeight: "700",
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(0, 149, 246, 0.3)"
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
  backgroundColor: "#262626",
  color: "#fff",
  border: "1px solid #363636",
  borderRadius: "8px",
  padding: "8px 18px",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "600"
};

