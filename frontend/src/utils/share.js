// src/utils/share.js
export const shareVideo = async (video) => {
  const shareData = {
    title: video.caption || "Check out this shot!",
    text: `Watch @${video.uploader_name || 'Member'} on Naija Homemade`,
    url: `https://videos.naijahomemade.com/v/${video.message_id}`,
  };

  try {
    // 🟢 Use native mobile share if available
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      // 🟢 Fallback: Copy to clipboard
      await navigator.clipboard.writeText(shareData.url);
      alert("Link copied to clipboard!");
    }
  } catch (err) {
    console.error("Share failed", err);
  }
};