// utils/rewardedAd.js
// Re-exports from centralized adManager for full backward compatibility
export { 
  openSmartlink as openRewardedAd, 
  openSmartlink, 
  triggerSmartlinkIfEligible 
} from "./adManager";
