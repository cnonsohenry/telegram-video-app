import { useEffect, useState, useCallback, useRef } from "react"; 
import { createPortal } from "react-dom";
import Home from "./pages/Home";
import Explore from "./pages/Explore"; 
import Profile from "./pages/Profile";
import AdminDashboard from "./components/AdminDashboard"; 
import AuthForm from "./components/AuthForm";
import FullscreenPlayer from "./components/FullscreenPlayer"; 
import PaywallModal from "./components/PaywallModal"; 
import LegalPages from "./pages/LegalPages"; 
import CommentSectionModal from "./components/CommentSectionModal"; 
import CreatorProfileModal from "./components/CreatorProfileModal";
import AppToast from "./components/AppToast";
import LoginPromptModal from "./components/LoginPromptModal";
import EmailVerificationModal from "./components/EmailVerificationModal";
import DiscoverCreatorsModal from "./components/DiscoverCreatorsModal";
import { useAdZapper } from "./hooks/useAdZapper";
import { Home as HomeIcon, Compass, User, ShieldCheck } from "lucide-react";

import { APP_CONFIG } from "./config";
import { isUserSubscribedToCreator, getVideoCreatorHandle, isUserAdExempt } from "./utils/subscription";
import { triggerSmartlinkIfEligible, syncVipAdFreeState } from "./utils/adManager";
import { showToast, promptLogin } from "./utils/toast";

export default function App() {
  const [token, setToken] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const redirectToken = params.get("auth_token");
      if (redirectToken) {
        localStorage.setItem("token", redirectToken);
        return redirectToken;
      }
    } catch (e) {}
    return localStorage.getItem("token");
  });
  const [user, setUser] = useState(null);
  
  // 🟢 Initialize activeTab from URL search params if present (?tab=explore, ?tab=profile, etc.)
  // When a user visits the domain without explicit parameters, randomly display between Home or Explore
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && ["home", "explore", "profile", "admin"].includes(tabParam.toLowerCase())) {
      return tabParam.toLowerCase();
    }
    if (params.get("admin") === "true") return "admin";
    if (window.location.pathname === "/login") return "profile";
    if (params.get("cat")) return "home";

    // 🎲 Randomly display between Home and Explore on root visit
    return Math.random() < 0.5 ? "home" : "explore";
  });

  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null); 
  const [showPaywall, setShowPaywall] = useState(false);
  // 🟢 Initialize activeLegalPage from URL query param (?legal=about, ?legal=terms) OR direct path (/privacy, /terms)
  const [activeLegalPage, setActiveLegalPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const legalParam = params.get("legal");
    if (legalParam) return legalParam;

    const path = window.location.pathname.toLowerCase().replace(/\/+$/, "");
    if (path === "/privacy" || path === "/privacy-policy") return "privacy";
    if (path === "/terms" || path === "/terms-of-service" || path === "/tos") return "terms";
    if (path === "/dmca") return "dmca";
    if (path === "/2257") return "2257";
    if (path === "/about") return "about";
    if (path === "/contact") return "contact";
    if (path === "/cookies") return "cookies";

    return null;
  }); 
  const [isSharedVideoView, setIsSharedVideoView] = useState(false);
  
  const [activeCommentVideo, setActiveCommentVideo] = useState(null);
  const [viewingCreator, setViewingCreator] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("creator")) return params.get("creator");
    const path = window.location.pathname;
    if (path.startsWith("/@")) return path.slice(2).trim();
    return null;
  });
  const [creatorAutoSubscribe, setCreatorAutoSubscribe] = useState(false);
  // 🟢 Dynamic Window Manager: Auto-incrementing Z-Index stacking
  const topZIndexRef = useRef(1000030);
  const getNextZIndex = useCallback(() => {
    topZIndexRef.current += 2;
    return topZIndexRef.current;
  }, []);

  const [videoZIndex, setVideoZIndex] = useState(1000030);
  const [creatorZIndex, setCreatorZIndex] = useState(1000040);
  const [commentZIndex, setCommentZIndex] = useState(1000050);
  const [discoverZIndex, setDiscoverZIndex] = useState(1000060);
  const [paywallZIndex, setPaywallZIndex] = useState(1000070);
  const [loginPromptAction, setLoginPromptAction] = useState(null);
  const [emailVerificationState, setEmailVerificationState] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const showAuthModalRef = useRef(false);

  useEffect(() => {
    showAuthModalRef.current = showAuthModal;
    if (showAuthModal && !window.history.state?.authModal) {
      window.history.pushState(
        { ...(window.history.state || {}), authModal: true },
        document.title
      );
    }
  }, [showAuthModal]);

  const handleCloseAuthModal = useCallback(() => {
    if (showAuthModalRef.current && window.history.state?.authModal) {
      showAuthModalRef.current = false;
      window.history.back();
    }
    setShowAuthModal(false);
  }, []);

  const [showDiscoverCreators, setShowDiscoverCreators] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("page") === "discover-creators" || params.get("discover") === "creators";
  });
  const showDiscoverCreatorsRef = useRef(false);
  useEffect(() => {
    showDiscoverCreatorsRef.current = showDiscoverCreators;
  }, [showDiscoverCreators]);

  // 🟢 THE FIX: App Height Lock Architecture (With resilient 100dvh fallback for tab wakeups)
  const windowWidth = useRef(typeof window !== "undefined" ? window.innerWidth : 0);
  const [appHeight, setAppHeight] = useState(() => {
    if (typeof window !== "undefined" && window.innerHeight > 0) {
      return `${window.innerHeight}px`;
    }
    return "100dvh";
  });

  // 🟢 1. Track the active tab in a Ref so our callbacks can check it without re-rendering
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
    window.__activeTab = activeTab;
    // Reset footer to visible whenever the user switches tabs!
    setIsFooterVisible(true);
  }, [activeTab]);

  // 🟢 Switch footer tabs with browser history integration
  const handleTabSwitch = useCallback((tabName, fromHistory = false) => {
    if (activeTabRef.current === tabName && !fromHistory) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.dispatchEvent(new CustomEvent("tabReselected", { detail: tabName }));
      return;
    }

    const prevTab = activeTabRef.current;
    activeTabRef.current = tabName;
    setActiveTab(tabName);

    // 🟢 Close any active overlays when switching footer tabs
    if (activeVideoRef.current) {
      activeVideoRef.current = null;
      setActiveVideo(null);
      setIsSharedVideoView(false);
    }
    if (viewingCreatorRef.current) {
      viewingCreatorRef.current = null;
      setViewingCreator(null);
      setCreatorAutoSubscribe(false);
    }
    if (showDiscoverCreatorsRef.current) {
      showDiscoverCreatorsRef.current = false;
      setShowDiscoverCreators(false);
    }
    if (activeCommentVideoRef.current) {
      activeCommentVideoRef.current = null;
      setActiveCommentVideo(null);
    }
    if (showPaywallRef.current) {
      showPaywallRef.current = false;
      setShowPaywall(false);
    }

    if (!fromHistory) {
      let targetUrl = "/";
      const currentState = window.history.state || {};
      const stateData = { ...currentState, tab: tabName };

      // Clean up overlay modal flags from new tab state
      delete stateData.videoPlayer;
      delete stateData.messageId;
      delete stateData.commentModal;
      delete stateData.paywall;
      delete stateData.searchOpen;
      delete stateData.albumOpen;
      delete stateData.creatorProfile;
      delete stateData.creatorPushed;
      delete stateData.discoverCreators;
      delete stateData.authModal;
      delete stateData.loginPrompt;

      if (tabName === "home") {
        const cat = stateData.cat || new URLSearchParams(window.location.search).get("cat");
        if (cat) {
          targetUrl = `/?cat=${encodeURIComponent(cat)}`;
        } else {
          targetUrl = "/";
        }
      } else {
        targetUrl = `/?tab=${encodeURIComponent(tabName)}`;
      }

      // 🟢 Deterministic Tab Navigation Architecture:
      // 1. Moving from Home to any secondary tab (Explore, Profile, Admin):
      //    Push state so pressing the device/browser Back button returns cleanly to Home!
      // 2. Returning to Home from a secondary tab:
      //    Always replace state with Home root. Never use window.history.back() on explicit tab clicks!
      // 3. Switching between secondary tabs (e.g. Explore <-> Profile):
      //    Replace state so secondary tabs do not build an infinite stack.
      if (tabName === "home") {
        delete stateData.fromHome;
        window.history.replaceState(stateData, document.title, targetUrl);
      } else if (prevTab === "home") {
        stateData.fromHome = true;
        window.history.pushState(stateData, document.title, targetUrl);
      } else {
        stateData.fromHome = Boolean(currentState.fromHome);
        window.history.replaceState(stateData, document.title, targetUrl);
      }
    }
  }, []);

  // 🟢 Normalize initial history state on mount
  useEffect(() => {
    const currentState = window.history.state || {};
    if (!currentState.tab) {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const currentTab = tabParam && ["home", "explore", "profile", "admin"].includes(tabParam.toLowerCase())
        ? tabParam.toLowerCase()
        : (params.get("admin") === "true" ? "admin" : (window.location.pathname === "/login" ? "profile" : activeTab));
      
      const catParam = params.get("cat");
      const legalParam = params.get("legal");
      const creatorParam = params.get("creator") || (window.location.pathname.startsWith("/@") ? window.location.pathname.slice(2).trim() : null);
      window.history.replaceState({
        ...currentState,
        tab: currentTab,
        ...(catParam ? { cat: catParam } : {}),
        ...(legalParam ? { legal: legalParam } : {}),
        ...(creatorParam ? { creatorProfile: creatorParam } : {})
      }, document.title, window.location.href);
    }
  }, [activeTab]);

  // 🟢 2. Create exclusive, stable callbacks for each specific tab
  const handleHomeHideFooter = useCallback((hide) => {
    if (activeTabRef.current === "home") setIsFooterVisible(!hide);
  }, []);

  const handleProfileHideFooter = useCallback((hide) => {
    if (activeTabRef.current === "profile") setIsFooterVisible(!hide);
  }, []);

  const handleExploreHideFooter = useCallback((hide) => {
    if (activeTabRef.current === "explore") setIsFooterVisible(!hide);
  }, []);

  // 🟢 Browser History & Back Button Management for Video/Modals
  const activeVideoRef = useRef(null);
  const activeCommentVideoRef = useRef(null);
  const showPaywallRef = useRef(false);
  const activeLegalPageRef = useRef(null);
  const viewingCreatorRef = useRef(null);
  const lastOpenCreatorTargetRef = useRef(null);
  const lastOpenCreatorTimeRef = useRef(0);

  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);

  useEffect(() => {
    activeCommentVideoRef.current = activeCommentVideo;
  }, [activeCommentVideo]);

  useEffect(() => {
    showPaywallRef.current = showPaywall;
  }, [showPaywall]);

  useEffect(() => {
    activeLegalPageRef.current = activeLegalPage;
  }, [activeLegalPage]);

  useEffect(() => {
    viewingCreatorRef.current = viewingCreator;
  }, [viewingCreator]);

  // 🟢 Synchronize browser history when opening a video
  useEffect(() => {
    if (activeVideo && activeVideo.message_id) {
      const currentState = window.history.state;
      const targetPath = `/v/${activeVideo.message_id}`;
      const nextState = { ...(currentState || {}), videoPlayer: true, messageId: String(activeVideo.message_id) };
      delete nextState.searchOpen;
      delete nextState.storyPlayer;
      delete nextState.commentModal;
      delete nextState.profileFollowList;
      delete nextState.creatorFollowList;
      delete nextState.creatorFollowListUser;

      // Only push a new history entry if videoPlayer was not already open.
      // If videoPlayer was already active (swiped or clicked next video in player), use replaceState so hitting back once exits cleanly!
      if (!currentState?.videoPlayer) {
        window.history.pushState(
          nextState,
          document.title,
          targetPath
        );
      } else if (currentState?.messageId !== String(activeVideo.message_id)) {
        window.history.replaceState(
          nextState,
          document.title,
          targetPath
        );
      }
    }
  }, [activeVideo?.message_id]);

  // 🟢 Synchronize browser history when opening comment modal
  useEffect(() => {
    if (activeCommentVideo && activeCommentVideo.message_id) {
      if (!window.history.state?.commentModal) {
        window.history.pushState(
          { 
            ...(window.history.state || {}), 
            commentModal: true, 
            videoPlayer: !!activeVideoRef.current, 
            messageId: String(activeCommentVideo.message_id) 
          },
          document.title
        );
      }
    }
  }, [activeCommentVideo]);

  // 🟢 Synchronize browser history when opening paywall modal
  useEffect(() => {
    if (showPaywall) {
      if (!window.history.state?.paywall) {
        window.history.pushState(
          { ...(window.history.state || {}), paywall: true },
          document.title
        );
      }
    }
  }, [showPaywall]);

  // 🟢 Handle browser Back button (popstate) to close overlays and switch tabs
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state || {};

      // 0. If auth modal was open and state no longer has authModal, close auth modal
      if (showAuthModalRef.current && !state.authModal) {
        showAuthModalRef.current = false;
        setShowAuthModal(false);
      } else if (state.authModal && !showAuthModalRef.current) {
        showAuthModalRef.current = true;
        setShowAuthModal(true);
      }

      // 1. If comments modal was open and state no longer has commentModal, close comments
      if (activeCommentVideoRef.current && !state.commentModal) {
        activeCommentVideoRef.current = null;
        setActiveCommentVideo(null);
      }

      // 2. If video player was open and state no longer has videoPlayer, close video
      if (activeVideoRef.current && !state.videoPlayer) {
        activeVideoRef.current = null;
        setActiveVideo(null);
        setIsSharedVideoView(false);
      }

      // 3. If paywall was open and state no longer has paywall, close paywall
      if (showPaywallRef.current && !state.paywall) {
        showPaywallRef.current = false;
        setShowPaywall(false);
      } else if (state.paywall && !showPaywallRef.current) {
        setPaywallZIndex(getNextZIndex());
        showPaywallRef.current = true;
        setShowPaywall(true);
      }

      // 4. If legal page was open and state no longer has legal, close legal page
      if (activeLegalPageRef.current && !state.legal) {
        activeLegalPageRef.current = null;
        setActiveLegalPage(null);
      } else if (state.legal && state.legal !== activeLegalPageRef.current) {
        activeLegalPageRef.current = state.legal;
        setActiveLegalPage(state.legal);
      }

      // 5. Creator Profile popstate sync
      if (viewingCreatorRef.current && !state.creatorProfile) {
        viewingCreatorRef.current = null;
        lastOpenCreatorTargetRef.current = null;
        setViewingCreator(null);
        setCreatorAutoSubscribe(false);
      } else if (state.creatorProfile) {
        if (state.creatorProfile !== viewingCreatorRef.current) {
          viewingCreatorRef.current = state.creatorProfile;
          lastOpenCreatorTargetRef.current = state.creatorProfile ? state.creatorProfile.toLowerCase() : null;
          lastOpenCreatorTimeRef.current = Date.now();
          setViewingCreator(state.creatorProfile);
          setCreatorAutoSubscribe(false);
        }
        if (!state.discoverCreators) {
          setCreatorZIndex(getNextZIndex());
        }
      }

      // 5.5 Discover Creators popstate sync
      if (showDiscoverCreatorsRef.current && !state.discoverCreators) {
        showDiscoverCreatorsRef.current = false;
        setShowDiscoverCreators(false);
      } else if (state.discoverCreators) {
        showDiscoverCreatorsRef.current = true;
        setShowDiscoverCreators(true);
        // Discover Creators must strictly sit on top of any underlying creator profile in this state
        setDiscoverZIndex(getNextZIndex());
      }

      // 6. If search overlay or profile follow list was open, their popstate listeners handle it
      if (state.searchOpen || state.profileFollowList) {
        if (state.tab && state.tab !== activeTabRef.current) {
          activeTabRef.current = state.tab;
          setActiveTab(state.tab);
        }
        return;
      }

      // 7. Global Footer Tabs navigation
      const params = new URLSearchParams(window.location.search);
      const targetTab = state.tab || params.get("tab") || (params.get("admin") === "true" ? "admin" : "home");

      if (targetTab !== activeTabRef.current) {
        activeTabRef.current = targetTab;
        setActiveTab(targetTab);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [getNextZIndex]);

  // 🟢 Seamless in-app legal page navigation
  const handleOpenLegal = useCallback((pageId) => {
    setActiveLegalPage(pageId);
    activeLegalPageRef.current = pageId;
    const currentState = window.history.state || {};
    const url = pageId === "privacy" ? "/privacy" : (pageId === "terms" ? "/terms" : `/?legal=${encodeURIComponent(pageId)}`);
    window.history.pushState(
      { ...currentState, legal: pageId },
      document.title,
      url
    );
  }, []);

  const handleCloseLegal = useCallback(() => {
    activeLegalPageRef.current = null;
    setActiveLegalPage(null);
    if (window.history.state?.legal) {
      window.history.back();
    } else {
      const currentState = window.history.state || {};
      const currentTab = currentState.tab || "home";
      const targetUrl = currentTab === "home"
        ? (currentState.cat ? `/?cat=${encodeURIComponent(currentState.cat)}` : "/")
        : `/?tab=${encodeURIComponent(currentTab)}`;
      window.history.replaceState({ ...currentState, legal: null }, document.title, targetUrl);
    }
  }, []);

  useEffect(() => {
    const handleOpenLegalEvent = (e) => {
      if (e.detail) {
        handleOpenLegal(e.detail);
      }
    };
    window.addEventListener("openLegalPage", handleOpenLegalEvent);
    return () => window.removeEventListener("openLegalPage", handleOpenLegalEvent);
  }, [handleOpenLegal]);

  // 🟢 Seamless Discover Creators navigation
  const handleOpenDiscoverCreators = useCallback(() => {
    setDiscoverZIndex(getNextZIndex());
    setShowDiscoverCreators(true);
    showDiscoverCreatorsRef.current = true;
    const currentState = window.history.state || {};
    if (!currentState.discoverCreators) {
      const nextState = { ...currentState, discoverCreators: true };
      delete nextState.searchOpen;
      delete nextState.storyPlayer;
      delete nextState.commentModal;
      delete nextState.profileFollowList;
      delete nextState.creatorFollowList;
      delete nextState.creatorFollowListUser;
      window.history.pushState(
        nextState,
        document.title,
        window.location.search ? `${window.location.search}&discover=creators` : `/?discover=creators`
      );
    }
  }, [getNextZIndex]);

  const handleCloseDiscoverCreators = useCallback(() => {
    showDiscoverCreatorsRef.current = false;
    setShowDiscoverCreators(false);
    if (window.history.state?.discoverCreators) {
      window.history.back();
    } else {
      const currentState = window.history.state || {};
      delete currentState.discoverCreators;
      const params = new URLSearchParams(window.location.search);
      params.delete("discover");
      const qs = params.toString() ? `?${params.toString()}` : (currentState.tab === "home" ? "/" : `/?tab=${currentState.tab || "explore"}`);
      window.history.replaceState(currentState, document.title, qs);
    }
  }, []);

  // 🟢 Seamless Creator Profile navigation
  const handleOpenCreator = useCallback((target, options = {}) => {
    const rawUsername = typeof target === 'string' ? target : (target.username || target.creatorUsername);
    if (!rawUsername) return;
    const username = String(rawUsername).replace(/^@/, '').trim();
    if (!username) return;

    const normalizedUname = username.toLowerCase();
    const now = Date.now();

    // 🛑 Prevent rapid duplicate dispatches (e.g. avatar click bubbling to card click)
    if (
      lastOpenCreatorTargetRef.current === normalizedUname &&
      now - lastOpenCreatorTimeRef.current < 450
    ) {
      return;
    }

    // 🛑 If already viewing this exact creator, do not push another history entry
    if (viewingCreatorRef.current && viewingCreatorRef.current.toLowerCase() === normalizedUname) {
      return;
    }

    lastOpenCreatorTargetRef.current = normalizedUname;
    lastOpenCreatorTimeRef.current = now;

    setCreatorZIndex(getNextZIndex());

    const autoSub = Boolean(options.autoSubscribe || target.autoSubscribe);
    setCreatorAutoSubscribe(autoSub);
    setViewingCreator(username);
    viewingCreatorRef.current = username;
    const currentState = window.history.state || {};
    const nextState = { ...currentState, creatorProfile: username, creatorPushed: true };
    delete nextState.searchOpen;
    delete nextState.storyPlayer;
    delete nextState.commentModal;
    delete nextState.profileFollowList;
    delete nextState.creatorFollowList;
    delete nextState.creatorFollowListUser;

    // If top of history state is already for this creator, replace instead of pushing
    if (currentState.creatorProfile && currentState.creatorProfile.toLowerCase() === normalizedUname) {
      window.history.replaceState(
        nextState,
        document.title,
        `/?creator=${encodeURIComponent(username)}`
      );
    } else {
      window.history.pushState(
        nextState,
        document.title,
        `/?creator=${encodeURIComponent(username)}`
      );
    }
  }, [getNextZIndex]);

  const handleCloseCreator = useCallback(() => {
    if (window.history.state?.creatorPushed) {
      window.history.back();
      return;
    }
    viewingCreatorRef.current = null;
    lastOpenCreatorTargetRef.current = null;
    setViewingCreator(null);
    setCreatorAutoSubscribe(false);
    const currentState = { ...(window.history.state || {}) };
    delete currentState.creatorProfile;
    delete currentState.creatorPushed;
    delete currentState.creatorFollowList;
    delete currentState.creatorFollowListUser;
    const targetTab = currentState.tab || "home";
    const targetUrl = targetTab === "home" ? "/" : `/?tab=${encodeURIComponent(targetTab)}`;
    window.history.replaceState(currentState, document.title, targetUrl);
  }, []);

  const refreshUser = useCallback(async () => {
    const activeToken = localStorage.getItem("token");
    if (!activeToken) return;
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (e) {
      console.error("Failed to refresh user subscriptions:", e);
    }
  }, []);

  useEffect(() => {
    const handleOpenCreatorEvent = (e) => {
      if (e.detail) {
        if (typeof e.detail === "string") {
          handleOpenCreator(e.detail);
        } else if (typeof e.detail === "object") {
          handleOpenCreator(e.detail.username || e.detail.creator, {
            autoSubscribe: Boolean(e.detail.autoSubscribe)
          });
        }
      }
    };
    const handleOpenLoginPrompt = (e) => {
      setLoginPromptAction(e.detail?.action || "continue");
    };
    const handleOpenEmailVerification = (e) => {
      setEmailVerificationState(e.detail || { reason: "download" });
    };
    const handleOpenAuthModal = () => {
      setShowAuthModal(true);
    };

    window.addEventListener("openCreatorProfile", handleOpenCreatorEvent);
    window.addEventListener("openDiscoverCreators", handleOpenDiscoverCreators);
    window.addEventListener("openDiscoverCreatorsModal", handleOpenDiscoverCreators);
    window.addEventListener("refreshUser", refreshUser);
    window.addEventListener("openLoginPrompt", handleOpenLoginPrompt);
    window.addEventListener("promptLogin", handleOpenLoginPrompt);
    window.addEventListener("openEmailVerification", handleOpenEmailVerification);
    window.addEventListener("openAuthModal", handleOpenAuthModal);
    return () => {
      window.removeEventListener("openCreatorProfile", handleOpenCreatorEvent);
      window.removeEventListener("openDiscoverCreators", handleOpenDiscoverCreators);
      window.removeEventListener("openDiscoverCreatorsModal", handleOpenDiscoverCreators);
      window.removeEventListener("refreshUser", refreshUser);
      window.removeEventListener("openLoginPrompt", handleOpenLoginPrompt);
      window.removeEventListener("promptLogin", handleOpenLoginPrompt);
      window.removeEventListener("openEmailVerification", handleOpenEmailVerification);
      window.removeEventListener("openAuthModal", handleOpenAuthModal);
    };
  }, [handleOpenCreator, handleOpenDiscoverCreators, refreshUser]);

  const handleCloseVideo = useCallback(() => {
    activeVideoRef.current = null;
    setActiveVideo(null);
    setIsSharedVideoView(false);
    if (window.history.state?.videoPlayer) {
      window.history.back();
    } else if (window.location.pathname.startsWith('/v/') || window.location.search.includes('v=')) {
      const remainingState = { ...(window.history.state || {}) };
      delete remainingState.videoPlayer;
      delete remainingState.messageId;
      window.history.replaceState(remainingState, document.title, "/");
    }
  }, []);

  const handleOpenComments = useCallback((video) => {
    if (!video) return;
    setCommentZIndex(getNextZIndex());
    activeCommentVideoRef.current = video;
    setActiveCommentVideo(video);
  }, [getNextZIndex]);

  const handleCloseComments = useCallback((isTransitioning = false) => {
    activeCommentVideoRef.current = null;
    setActiveCommentVideo(null);
    if (!isTransitioning && window.history.state?.commentModal) {
      window.history.back();
    }
  }, []);

  const handleSetShowPaywall = useCallback((show) => {
    const shouldShow = Boolean(show);
    if (shouldShow) {
      setPaywallZIndex(getNextZIndex());
    }
    showPaywallRef.current = shouldShow;
    setShowPaywall(shouldShow);
  }, [getNextZIndex]);

  const handleClosePaywall = useCallback(() => {
    showPaywallRef.current = false;
    setShowPaywall(false);
    if (window.history.state?.paywall) {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    // 🟢 Let React mount and render the UI, then tell Prerender to take the snapshot instantly
    // We use a small 1.5-second timeout to ensure your feed videos have fetched from the DB
    const timer = setTimeout(() => {
      if (window.prerenderReady === false) {
        window.prerenderReady = true;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const updateDimensions = (force = false) => {
      if (typeof window === "undefined") return;
      const h = window.innerHeight;
      const w = window.innerWidth;
      if (h <= 0) return;

      const isInputFocused = document.activeElement && 
        (document.activeElement.tagName === "INPUT" || 
         document.activeElement.tagName === "TEXTAREA" || 
         document.activeElement.isContentEditable);

      // Recalculate if:
      // 1. Force update (e.g. on tab wakeup / visibilitychange / pageshow)
      // 2. Width changed (device rotation / window resize)
      // 3. Height changed AND no input is currently focused (not an on-screen keyboard opening)
      if (force || w !== windowWidth.current || !isInputFocused) {
        setAppHeight(`${h}px`);
        windowWidth.current = w;
      }
    };

    const handleResize = () => updateDimensions(false);
    window.addEventListener('resize', handleResize);

    // 🟢 Tab Wakeup & Visibility Recovery (Prevents blank/black screen when returning after a long time)
    const handleWakeup = () => {
      if (document.visibilityState === "visible") {
        updateDimensions(true);
        // Force GPU compositor re-rasterization to restore unpainted tile textures
        requestAnimationFrame(() => {
          const root = document.getElementById("root");
          if (root) {
            root.style.transform = "translateZ(0)";
            requestAnimationFrame(() => {
              root.style.transform = "";
            });
          }
        });
        // Gracefully refresh user auth and subscriptions
        refreshUser();
      }
    };

    document.addEventListener("visibilitychange", handleWakeup);
    window.addEventListener("pageshow", handleWakeup);
    window.addEventListener("focus", handleWakeup);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener("visibilitychange", handleWakeup);
      window.removeEventListener("pageshow", handleWakeup);
      window.removeEventListener("focus", handleWakeup);
    };
  }, [refreshUser]);

  const isLoggedIn = !!token;

  useEffect(() => {
    if (showPaywall && !isLoggedIn) {
      setShowPaywall(false);
      promptLogin("subscribe");
    }
  }, [showPaywall, isLoggedIn]);

  useEffect(() => {
    document.title = `${APP_CONFIG.appNamePrefix}${APP_CONFIG.appNameSuffix}`;
  }, []);

  // 🟢 Synchronize VIP Ad-Free status to localStorage and ad scripts
  useEffect(() => {
    syncVipAdFreeState(user);
  }, [user]);

  const isVipExempt = isUserAdExempt(user);
  const isAdFreeZone = isVipExempt || activeTab === "profile" || activeTab === "admin" || (showPaywall && isLoggedIn) || !!activeLegalPage || !!viewingCreator || (!!activeVideo && !isSharedVideoView) || !!activeCommentVideo;
  
  useAdZapper(isAdFreeZone);

  useEffect(() => {
    const styleId = "nuclear-ad-blocker";
    let styleEl = document.getElementById(styleId);

    if (isAdFreeZone) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        styleEl.innerHTML = `
          div[id^="container-"], 
          iframe[src*="adsterra"], 
          iframe[src*="topcreativeformat"],
          .adsterra-social-bar,
          .adsterra-wrapper,
          [id*="effectivegatecpm"],
          div[style*="z-index: 2147483647"],
          div[style*="z-index: 2147483646"] { 
            display: none !important; 
            opacity: 0 !important; 
            pointer-events: none !important; 
            visibility: hidden !important; 
            z-index: -9999 !important;
            width: 0 !important;
            height: 0 !important;
          }
        `;
        document.head.appendChild(styleEl);
      }

      // Initial clean sweep without repetitive battery-draining intervals
      const ads = document.querySelectorAll('iframe[src*="adsterra"], div[id^="container-"], .adsterra-social-bar, [id*="effectivegatecpm"], .adsterra-wrapper');
      ads.forEach(ad => ad.remove());
      
      if (document.body.style.paddingTop) document.body.style.paddingTop = "";
      if (document.body.style.marginTop) document.body.style.marginTop = "";
    } else {
      if (styleEl) styleEl.remove();
    }
  }, [isAdFreeZone]);

  useEffect(() => {
    const preventOverscroll = (e) => {
      // 🟢 Never block touch gestures inside Admin Dashboard or admin viewports
      if (
        activeTab === "admin" ||
        e.target.closest('.admin-dashboard-root, .admin-main-content, .content-area, .admin-sidebar, .admin-table-scroll') ||
        document.querySelector('.admin-dashboard-root')
      ) {
        return;
      }

      // Check if user is touching a scrollable element (by class or inline style)
      const scrollable = e.target.closest(
        '.content-area, .admin-sidebar, .admin-table-scroll, .scrollable-content, ' +
        '[style*="overflow-y: auto"], [style*="overflowY: auto"], [style*="overflow-y:scroll"], [style*="overflowY:scroll"], ' +
        '[style*="overflow: auto"], [style*="overflow: scroll"], [style*="overflow: hidden auto"], [style*="overflow: auto hidden"]'
      );
      if (scrollable) return;

      // Also inspect computedStyle up the element tree so custom-styled scroll containers are not locked
      let el = e.target;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
          const style = window.getComputedStyle(el);
          if (
            style.overflowY === 'auto' || style.overflowY === 'scroll' ||
            style.overflowX === 'auto' || style.overflowX === 'scroll'
          ) {
            return;
          }
        }
        el = el.parentElement;
      }

      // Block only true non-scrollable bounce touches outside any scrollable view
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', preventOverscroll, { passive: false });
    return () => document.removeEventListener('touchmove', preventOverscroll);
  }, [activeTab]);

  const applyTheme = useCallback((theme) => {
    localStorage.setItem("theme", theme);
    if (theme === "orange") {
      document.body.classList.add("theme-orange");
    } else {
      document.body.classList.remove("theme-orange");
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "red";
    applyTheme(savedTheme);
  }, [applyTheme]);

  useEffect(() => {
    const handleCustomCommentModal = (e) => {
      if (e.detail?.video) {
        handleOpenComments(e.detail.video);
      }
    };
    window.addEventListener("openCommentModal", handleCustomCommentModal);
    return () => window.removeEventListener("openCommentModal", handleCustomCommentModal);
  }, [handleOpenComments]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let sharedVideoId = params.get("v");

    if (!sharedVideoId && window.location.pathname.startsWith('/v/')) {
      sharedVideoId = window.location.pathname.split('/')[2];
    }

    if (sharedVideoId) {
      setIsSharedVideoView(true);
      // Replace direct URL with '/' so browser back button returns to the home feed instead of leaving the site
      window.history.replaceState({ tab: 'home' }, document.title, "/");
      window.history.pushState(
        { videoPlayer: true, messageId: String(sharedVideoId) },
        document.title,
        `/v/${sharedVideoId}`
      );
      const fetchSharedVideo = async () => {
        try {
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/video/details?message_id=${sharedVideoId}`);
          if (res.ok) {
            const videoData = await res.json();
            const isPremium = videoData.category === "premium" || videoData.is_premium === true;
            if (isPremium) {
              const hasAccess = isUserSubscribedToCreator(user, videoData);
              if (!hasAccess) {
                const token = localStorage.getItem("token");
                if (!token) {
                  promptLogin("subscribe");
                  return;
                }
                const creatorHandle = getVideoCreatorHandle(videoData);
                window.dispatchEvent(new CustomEvent("openCreatorProfile", {
                  detail: { username: creatorHandle, autoSubscribe: true }
                }));
                return;
              }
            }
            
            const token = localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const playRes = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${videoData.chat_id}&message_id=${videoData.message_id}`, { headers });
            if (playRes.ok) {
              const playData = await playRes.json();
              if (playData.video_url) {
                const ts = Date.now();
                const separator = playData.video_url.includes('?') ? '&' : '?';
                setActiveVideo({ ...videoData, video_url: `${playData.video_url}${separator}cb=${ts}` });
              }
            }
          }
        } catch (error) {
          console.error("Failed to load shared video:", error);
        } finally {
          // 🟢 Tell Prerender the video is loaded and ready for snapshotting
          if (window.prerenderReady === false) {
            window.prerenderReady = true;
          }
        }
      };
      fetchSharedVideo();
    }
  }, []);

  const onLoginSuccess = (userData, userToken) => {
    localStorage.setItem("token", userToken);
    setToken(userToken);
    setUser(userData);
    syncVipAdFreeState(userData);
    if (userData.settings?.theme) applyTheme(userData.settings.theme);
    window.dispatchEvent(new CustomEvent("refreshUser", { detail: userData }));

    // Never switch tabs away if the user was interacting with a creator profile or watching a video
    if (viewingCreatorRef.current || activeVideoRef.current) {
      return;
    }

    // Only switch to profile if user logged in directly from the profile tab
    if (activeTabRef.current === "profile") {
      handleTabSwitch("profile");
    }
  };

  const onLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("post_login_ad_free");
    localStorage.removeItem("last_login_timestamp");
    localStorage.removeItem("vip_ad_free");
    setToken(null);
    setUser(null);
    handleTabSwitch("home", true);
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    window.location.href = "/"; 
  }, [handleTabSwitch]);

  useEffect(() => {
    if (token && !user) {
      fetch(`${APP_CONFIG.apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setUser(data);
        if (data.settings?.theme) applyTheme(data.settings.theme);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
      });
    }
    
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_token")) {
      params.delete("auth_token");
      const cleanQs = params.toString() ? `?${params.toString()}` : window.location.pathname;
      window.history.replaceState(window.history.state || {}, document.title, cleanQs);
    }
    if (params.get("auth_error")) {
      try {
        showToast(decodeURIComponent(params.get("auth_error")), "error");
      } catch (e) {}
      params.delete("auth_error");
      const cleanQs = params.toString() ? `?${params.toString()}` : window.location.pathname;
      window.history.replaceState(window.history.state || {}, document.title, cleanQs);
    }
    if (params.get("admin") === "true") handleTabSwitch("admin", true);
    
    const legalParam = params.get("legal");
    if (legalParam) {
      setActiveLegalPage(legalParam);
    }

    if (window.location.pathname === "/login") {
      handleTabSwitch("profile", true); 
      window.history.replaceState({ tab: "profile" }, document.title, "/"); 
    }
  }, [token, user, applyTheme, handleTabSwitch]);

  // 🟢 FIX: Only hide the footer when logged out if we are currently on the profile tab (showing AuthForm)
  const shouldShowFooter = isFooterVisible && !activeVideo && !showPaywall && activeTab !== "admin" && !activeCommentVideo && (activeTab !== "profile" || isLoggedIn);

  const handleSetActiveVideo = useCallback((val) => {
    if (val) {
      setVideoZIndex(getNextZIndex());
    }
    setActiveVideo(val);
  }, [getNextZIndex]);

  const handleOpenVideo = async (video) => {
    setVideoZIndex(getNextZIndex());
    try {
      if (video.category === "premium" || video.is_premium) {
        const creatorPrice = video.subscription_price !== undefined ? Number(video.subscription_price) : null;
        const hasFee = creatorPrice === null ? true : creatorPrice > 0;
        const hasAccess = Boolean(video.is_subscribed || !hasFee || isUserSubscribedToCreator(user, video));
        if (!hasAccess) {
          const token = localStorage.getItem("token");
          if (!token) {
            promptLogin("subscribe");
            return;
          }
          const creatorHandle = getVideoCreatorHandle(video);
          handleOpenCreator(creatorHandle, { autoSubscribe: true });
          return;
        }
      } else {
        // Free video from Explore or Creator profile: check ad eligibility
        await triggerSmartlinkIfEligible(user);
      }

      // Clear completely first
      activeCommentVideoRef.current = null;
      setActiveCommentVideo(null);
      setActiveVideo(null);
      // 🟢 Pause any existing feed videos to release HTTP range-request socket locks
      try {
        document.querySelectorAll('video').forEach(el => el.pause());
      } catch (_) {}

      await new Promise(resolve => setTimeout(resolve, 50));
      
      const ts = Date.now();
      if (video.video_url) {
        console.log("⚡ Instant Fullscreen (Busting browser cache lock)");
        const separator = video.video_url.includes('?') ? '&' : '?';
        const freshUrl = `${video.video_url}${separator}cb=${ts}`;
        
        setActiveVideo({ ...video, video_url: freshUrl });
        return;
      }

      // Fallback for shared links or components that don't pass the URL
      setActiveVideo({ ...video, video_url: null });
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`, { headers });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      
      if (data.video_url) {
        const separator = data.video_url.includes('?') ? '&' : '?';
        const freshUrl = `${data.video_url}${separator}cb=${ts}`;
        setActiveVideo({ ...video, video_url: freshUrl });
      }
    } catch (e) { 
      setActiveVideo(null);
      showToast(`🚨 Playback Error: ${e.message}`, "error"); 
    }
  };

  return (
    <div style={{ 
      height: appHeight && appHeight !== "0px" ? appHeight : "100dvh",
      minHeight: "100%",
      width: '100vw', 
      backgroundColor: 'var(--bg-color)', 
      color: '#d4d4d8', 
      overflow: 'hidden',
      position: 'fixed',
      inset: 0,
      top: 0, 
      left: 0
    }}>
      <main 
        style={{ 
          position: 'relative',
          width: '100%',
          height: '100%',
          paddingBottom: "0px",
        }}
      > 
        <div style={{ 
          ...slideContainerStyle,
          transform: activeTab === "home" ? "translateX(0)" : "translateX(-100%)",
          opacity: activeTab === "home" ? 1 : 0,
          pointerEvents: activeTab === "home" ? "auto" : "none"
        }}>
          <Home 
            user={user} 
            onProfileClick={() => handleTabSwitch("profile")}
            setHideFooter={handleHomeHideFooter} // 🟢 UPDATED
            setActiveVideo={handleSetActiveVideo}
            setShowPaywall={handleSetShowPaywall} 
            onCreatorClick={handleOpenCreator}
          />
        </div>

        <div style={{ 
          ...slideContainerStyle,
          transform: activeTab === "explore" ? "translateX(0)" : (activeTab === "home" ? "translateX(100%)" : "translateX(-100%)"),
          opacity: activeTab === "explore" ? 1 : 0,
          pointerEvents: activeTab === "explore" ? "auto" : "none"
        }}>
          <Explore 
            user={user} 
            onProfileClick={() => handleTabSwitch("profile")}
            onNavigateTab={handleTabSwitch}
            setHideFooter={handleExploreHideFooter} 
            onVideoClick={handleOpenVideo}
            onCommentClick={handleOpenComments}
            onCreatorClick={handleOpenCreator}
            onOpenDiscoverCreators={handleOpenDiscoverCreators}
            isAnyModalOpen={!!activeVideo || !!activeCommentVideo || showPaywall || !!activeLegalPage || !!viewingCreator || showDiscoverCreators || activeTab !== "explore"} 
          />
        </div>
        
        <div style={{ 
          ...slideContainerStyle,
          transform: activeTab === "profile" ? "translateX(0)" : "translateX(100%)",
          opacity: activeTab === "profile" ? 1 : 0,
          pointerEvents: activeTab === "profile" ? "auto" : "none"
        }}>
          {isLoggedIn ? (
            <Profile 
              user={user} 
              onLogout={onLogout} 
              setActiveVideo={handleSetActiveVideo} 
              setHideFooter={handleProfileHideFooter} 
              setShowPaywall={handleSetShowPaywall} 
              onUpdateUser={(updated) => setUser(prev => ({ ...prev, ...updated }))}
              onCreatorClick={handleOpenCreator}
              onOpenDiscoverCreators={handleOpenDiscoverCreators}
              onCommentClick={handleOpenComments}
            />
          ) : (
            (activeTab === "profile" && !showAuthModal) ? (
              <AuthForm 
                onLoginSuccess={onLoginSuccess} 
                onClose={() => handleTabSwitch("home")} 
              />
            ) : null
          )}
        </div>
      </main>

      {activeTab === "admin" && (
        <AdminDashboard 
          user={user}
          onLogout={() => {
            window.history.replaceState({}, document.title, "/"); 
            handleTabSwitch("home", true); 
          }} 
        />
      )}

      {activeTab !== "admin" && !activeVideo && !showPaywall && !activeCommentVideo && (activeTab !== "profile" || isLoggedIn) && (
        <nav style={{
          ...navStyle,
          transform: isFooterVisible ? "translateY(0)" : "translateY(100%)",
          opacity: isFooterVisible ? 1 : 0,
          pointerEvents: isFooterVisible ? "auto" : "none",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease"
        }}>
          <button 
            onClick={() => handleTabSwitch("home")} 
            style={{...btnStyle, color: activeTab === 'home' ? '#f4f4f5' : '#71717a'}}
          >
            <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} fill={activeTab === 'home' ? 'currentColor' : 'none'} />
            <span style={labelStyle}>Home</span>
          </button>

          <button 
            onClick={() => handleTabSwitch("explore")} 
            style={{...btnStyle, color: activeTab === 'explore' ? '#d4d4d8' : '#71717a'}}
          >
            <Compass size={24} strokeWidth={activeTab === 'explore' ? 2.5 : 2} fill={activeTab === 'explore' ? 'currentColor' : 'none'} />
            <span style={labelStyle}>Explore</span>
          </button>

          <button 
            onClick={() => handleTabSwitch("profile")} 
            style={{...btnStyle, color: activeTab === 'profile' ? '#d4d4d8' : '#71717a'}}
          >
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} fill={activeTab === 'profile' ? 'currentColor' : 'none'} />
            <span style={labelStyle}>Profile</span>
          </button>

          {user?.role === 'admin' && (
            <button 
              onClick={() => handleTabSwitch("admin")} 
              style={{...btnStyle, color: activeTab === 'admin' ? '#d4d4d8' : '#71717a'}}
            >
              <ShieldCheck size={24} strokeWidth={activeTab === 'admin' ? 2.5 : 2} fill={activeTab === 'admin' ? 'currentColor' : 'none'} />
              <span style={labelStyle}>Admin</span>
            </button>
          )}
        </nav>
      )}

      {showPaywall && isLoggedIn && (
        <PaywallModal user={user} onClose={handleClosePaywall} zIndex={paywallZIndex} />
      )}

      {activeLegalPage && (
        <LegalPages 
          initialPage={activeLegalPage} 
          onBack={handleCloseLegal} 
        />
      )}

      {activeVideo && (
        <div style={{ position: "fixed", inset: 0, zIndex: videoZIndex, background: "var(--bg-color)" }}>
          <FullscreenPlayer 
            video={activeVideo}
            currentUser={user} 
            onClose={handleCloseVideo} 
            isDesktop={window.innerWidth > 1024} 
            onCommentClick={handleOpenComments}
            onCreatorClick={handleOpenCreator}
          />
        </div>
      )}

      {/* 🟢 THE FIX: Actually render the Comment Modal when activeCommentVideo is set */}
      {activeCommentVideo && (
        <CommentSectionModal 
          video={activeCommentVideo} 
          onClose={handleCloseComments} 
          zIndex={commentZIndex}
        />
      )}

      {/* 🌟 DISCOVER CREATORS MODAL */}
      {showDiscoverCreators && (
        <DiscoverCreatorsModal 
          isOpen={showDiscoverCreators}
          currentUser={user}
          onClose={handleCloseDiscoverCreators}
          onCreatorClick={(uname, options) => {
            handleOpenCreator(uname, options);
          }}
          onVideoClick={handleOpenVideo}
          zIndex={discoverZIndex}
        />
      )}

      {/* 🟢 CREATOR PROFILE MODAL */}
      {viewingCreator && (
        <CreatorProfileModal 
          creatorUsername={viewingCreator} 
          currentUser={user} 
          autoOpenSubscribe={creatorAutoSubscribe}
          onClose={handleCloseCreator} 
          onVideoClick={handleOpenVideo} 
          setShowPaywall={handleSetShowPaywall} 
          onSubscriptionUpdated={refreshUser}
          onCommentClick={handleOpenComments}
          zIndex={creatorZIndex}
        />
      )}

      {/* 🟢 GLOBAL TOAST NOTIFICATIONS */}
      <AppToast />

      {/* 🟢 APP-NATIVE LOGIN PROMPT MODAL */}
      <LoginPromptModal 
        isOpen={Boolean(loginPromptAction)} 
        action={loginPromptAction || "continue"} 
        onClose={() => setLoginPromptAction(null)} 
        onLogin={() => {
          setLoginPromptAction(null);
          setShowAuthModal(true);
        }} 
      />

      {/* 🟢 APP-NATIVE EMAIL VERIFICATION MODAL */}
      <EmailVerificationModal
        isOpen={Boolean(emailVerificationState)}
        reason={emailVerificationState?.reason || "download"}
        initialEmail={emailVerificationState?.email || user?.email || ""}
        currentUser={user}
        onClose={() => setEmailVerificationState(null)}
        onVerified={(updatedUser) => {
          const cb = emailVerificationState?.onVerified;
          setEmailVerificationState(null);
          if (cb) cb(updatedUser);
        }}
      />

      {/* 🟢 TOP-LEVEL AUTH MODAL (ALWAYS ON TOP OF PLAYERS AND MODALS) */}
      {showAuthModal && !isLoggedIn && (
        createPortal(
          <div 
            style={{ position: "fixed", inset: 0, zIndex: 1000350 }}
            onClick={(e) => e.stopPropagation()}
          >
            <AuthForm 
              onLoginSuccess={(u, t) => {
                onLoginSuccess(u, t);
                handleCloseAuthModal();
              }} 
              onClose={handleCloseAuthModal} 
            />
          </div>,
          document.body
        )
      )}
      
    </div>
  );
}

// 🖌 STYLES
const navStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', backgroundColor: '#09090b', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 10000, paddingBottom: 'env(safe-area-inset-bottom)' };
const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1, transition: 'all 0.3s ease' };
const labelStyle = { fontSize: '10px', fontWeight: '700' };

const slideContainerStyle = { 
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
  overflowY: 'auto', backgroundColor: 'var(--bg-color)', 
  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease', 
  willChange: 'transform, opacity', 
  WebkitOverflowScrolling: 'touch',
  transform: 'translateZ(0)', 
  WebkitBackfaceVisibility: 'hidden', 
  backfaceVisibility: 'hidden',
  overscrollBehaviorY: 'contain', 
  touchAction: 'pan-y'            
};