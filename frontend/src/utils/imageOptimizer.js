/**
 * Transforms a thumbnail request to use the Cloudflare Worker for WebP delivery.
 * Uses Cloudflare Image Resizing via the Worker to serve optimized formats.
 * * @param {string|number} chatId - Telegram chat ID
 * @param {string|number} messageId - Telegram message ID
 * @param {number} width - Target width for resizing (default 400)
 * @returns {string} Optimized URL
 */
export const getOptimizedThumbnail = (chatId, messageId, width = 400) => {
  // 🟢 Fallback: Return a dark placeholder if IDs are missing to prevent broken UI
  if (!chatId || !messageId) {
    return `https://via.placeholder.com/${width}x${Math.round(width * 1.5)}/1a1a1a/1a1a1a`;
  }

  // 🟢 Pointing to your Worker domain
  const workerDomain = "https://media.naijahomemade.com"; 

  /**
   * We pass the 'w' (width) parameter to the worker.
   * The worker uses this in the 'cf: { image: { ... } }' block 
   * to handle the heavy lifting of resizing and WebP conversion.
   */
  return `${workerDomain}/api/thumbnail?chat_id=${chatId}&message_id=${messageId}&format=webp&w=${width}`;
};