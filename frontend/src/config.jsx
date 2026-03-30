import { Play, Flame, Grid3X3, User as UserIcon } from "lucide-react";

// 🟢 This file acts as the single brain for your app's branding.
// When you build a sister app, you ONLY change the values in this file and your .env!

export const APP_CONFIG = {
  // Pulling URLs and Ad IDs from your .env file
  apiUrl: import.meta.env.VITE_API_URL || "https://videos.naijahomemade.com",
  exoClickZoneId: import.meta.env.VITE_EXOCLICK_ZONE_ID || "5882826",

  // Your App's specific categories
  categories: ["knacks", "hotties", "baddies", "trends"],
  
  // Your App's specific tabs (mapped directly to the categories above)
  tabs: [
    { icon: <Play size={22} />, label: "KNACKS" },
    { icon: <Grid3X3 size={22} />, label: "HOTTIES" },
    { icon: <UserIcon size={22} />, label: "BADDIES" },
    { icon: <Flame size={22} />, label: "TRENDS" }
  ]
};