import { Play, Flame, Grid3X3, User as UserIcon } from "lucide-react";

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
    posts: "POSTS",
    premium: "PREMIUM",
    liked: "LIKED"
  },

  // 🟢 6. Categories & Navigation Tabs
  categories: ["knacks", "hotties", "baddies", "trends"],
  tabs: [
    { icon: <Play size={22} />, label: "KNACKS" },
    { icon: <Grid3X3 size={22} />, label: "HOTTIES" },
    { icon: <UserIcon size={22} />, label: "BADDIES" },
    { icon: <Flame size={22} />, label: "TRENDS" }
  ],

  // 🟢 NEW: Paywall & Monetization Config
  supportTelegramLink: "https://t.me/NaijaHomemade",
  bankDetails: {
    bankName: "MoniePoint",
    accountNumber: "8138617303",
    accountName: "Okonkwo"
  },

  subscriptionPackages: [
    { id: '1_month', label: '1 Month', price: 15000, priceText: '₦15,000', priceUsd: 19, textUsd: '$19' },
    { id: '2_months', label: '2 Months', price: 25000, priceText: '₦25,000', priceUsd: 25, textUsd: '$25' },
    { id: '1_year', label: '1 Year', price: 125000, priceText: '₦125,000', priceUsd: 95, textUsd: '$95' }
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