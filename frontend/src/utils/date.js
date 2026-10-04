/**
 * Formats a date string or timestamp in authentic Twitter/X style:
 * - < 1 min: 'now'
 * - < 1 hour: '15m'
 * - < 24 hours: '4h'
 * - < 7 days: '3d'
 * - Same year: 'Oct 2'
 * - Different year: 'Oct 2, 2024'
 */
export function formatTwitterDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "now";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();

  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}

/**
 * Resolves the primary Display Name for a post/video uploader (not username).
 * Always returns a clean display name without any leading '@'.
 */
export function getPostDisplayName(video) {
  if (!video) return "Member";
  const name = 
    video.display_name || 
    video.uploader_name || 
    video.creator_display_name || 
    video.creator?.display_name || 
    video.creator?.full_name || 
    video.uploader_handle || 
    video.creator_username || 
    video.creator?.username || 
    "Member";
  const cleaned = String(name).replace(/^@/, "").trim();
  return cleaned || "Member";
}
