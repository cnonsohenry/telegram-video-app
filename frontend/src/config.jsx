import { Play, Flame, Grid3X3, User as UserIcon, Sparkles } from "lucide-react";

export const APP_CONFIG = {
  // 🟢 1. Core API & Ads
  apiUrl: import.meta.env.VITE_API_URL || "https://videos.naijahomemade.com",
  exoClickZoneId: import.meta.env.VITE_EXOCLICK_ZONE_ID || "5882826", // <-- This missing comma caused the crash!

  pythonEngineUrl: import.meta.env.VITE_PYTHON_ENGINE_URL || "https://engine.naijahomemade.com",

  // 🟢 2. App Branding
  appNamePrefix: "Naija",
  appNameSuffix: "homemade", 
  
  // 🟢 3. Search & UI Text
  searchPlaceholder: "Search shots...",
  defaultCaption: "View trending shot...",
  defaultUploader: "Member",
  searchKeywords: ["Knacks", "Trending", "Lagos Baddies", "Exclusive"],

  // 🟢 4. Profile Page Branding
  profileBioTitle: "Official Preview Channel",
  profileBioSubtitle: "Catch my latest shots here before they hit Premium 💎",
  profileSubscribeText: "SUBSCRIBE PREMIUM",
  profileVipText: "VIP MEMBER",
  
  // 🟢 5. Profile Grid Tabs
  profileTabs: {
    posts: "PREVIEWS",
    premium: "PREMIUM VIDEOS",
    liked: "LIKED"
  },

  // 🟢 6. Categories & Navigation Tabs
  categories: ["knacks", "hotties", "baddies", "trends", "premium"],
  tabs: [
    { icon: <Play size={22} />, label: "KNACKS" },
    { icon: <Grid3X3 size={22} />, label: "HOTTIES" },
    { icon: <UserIcon size={22} />, label: "BADDIES" },
    { icon: <Flame size={22} />, label: "TRENDS" },
    { icon: <Sparkles size={22} />, label: "VIP" }
  ],

  // 🟢 NEW: Paywall & Monetization Config
  ads: {
    smartlinkUrl: "https://www.effectivegatecpm.com/wmmi5uv2w5?key=23fa23a9f5a389595c81f702d570419b",
    vastTag: "https://s.magsrv.com/v1/vast.php?idzone=5880122",
    adFrequency: 6, // Smartlink triggers on every 6th free video
    vastFrequency: 3, // VAST pre-roll triggers every 3rd free video
    vastSkipSeconds: 5, // Skip ad countdown duration
    minMinutesBetweenAds: 6, // Minimum 6 minutes cooldown between any full-page ads/smartlinks
    initialFreeVideos: 2, // First 2 videos are 100% ad-free
    exoClickPopZoneId: "5883574"
  },
  supportTelegramLink: "",
  bankDetails: {
    bankName: "",
    accountNumber: "",
    accountName: ""
  },

  subscriptionPackages: [
    { id: '1_month', label: '1 Month', price: 19, priceText: '$19', priceUsd: 19, textUsd: '$19' },
    { id: '2_months', label: '2 Months', price: 25, priceText: '$25', priceUsd: 25, textUsd: '$25' },
    { id: '1_year', label: '1 Year', price: 95, priceText: '$95', priceUsd: 95, textUsd: '$95' },
    { id: 'life_time', label: 'LifeTime', price: 250, priceText: '$250', priceUsd: 250, textUsd: '$250' }
  ],

  // 🟢 NEW: Crypto Payment Options (Controls the buttons on the paywall)
  cryptoOptions: [
    { id: 'usdttrc20', label: 'USDT (TRC-20)', bg: '#26A17B', text: '#fff', span: 1 },
    { id: 'usdtbsc', label: 'USDT (BSC)', bg: '#26A17B', text: '#fff', span: 1 },
    { id: 'btc', label: 'Bitcoin (BTC)', bg: '#F7931A', text: '#fff', span: 1 },
    { id: 'eth', label: 'Ethereum (ETH)', bg: '#627EEA', text: '#fff', span: 1 },
    { id: 'ltc', label: 'Litecoin (LTC)', bg: '#345D9D', text: '#fff', span: 1 },
    { id: 'bnbbsc', label: 'BNB (BSC)', bg: '#F3BA2F', text: '#000', span: 1 },
    { id: 'ton', label: 'Toncoin (TON)', bg: '#0098EA', text: '#fff', span: 2 } // spans 2 columns at the bottom
  ],

  // 🟢 NEW: Admin Upload Destinations & IDs
  adminUsers: [
    { id: "1881815190", label: "Main Admin" },
    { id: "5441995861", label: "Secondary Admin" }
  ],
  telegramDestinations: [
    { id: "@mini_video_app_bot", label: "🤖 Main Bot" },
    { id: "-1001844042622", label: "NaijaBaddies TV" },
    { id: "-1001539197699", label: "Main Channel" },
    { id: "-1003952752560", label: "Link Channel" },
    { id: "-1003701122531", label: "X Channel" },
    { id: "-1002190329728", label: "Full HD Membership" },
    { id: "-1003768125972", label: "VIP April 06" }
  ],

  // 🟢 NEW: Marketing Pitch Slides
  pitchSlides: [
    { title: "CATCH THE SHOTS", description: "Sneak peeks of your favorite creators before the main drop.", image: "/assets/slide4.jpg" },
    { title: "PREMIUM ACCESS", description: "Unlock exclusive full-length videos and 4K content.", image: "/assets/slide2.jpg" },
    { title: "JOIN THE HUB", description: "Connect with the biggest hub for homegrown talent.", image: "/assets/slide3.jpg" }
  ],

  // 🟢 NEW: Legal & Corporate Details
  companyName: "Naija Homemade LLC",
  supportEmail: "support@naijahomemade.com",
  legalAddress: [
    "123 Legal Avenue",
    "Port Harcourt, Rivers State, Nigeria"
  ]
};