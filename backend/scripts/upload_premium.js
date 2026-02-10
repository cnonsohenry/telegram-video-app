import fs from "fs";
import * as tus from "tus-js-client";
import "dotenv/config";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN;

/**
 * Uploads a local file directly to Cloudflare Stream
 * @param {string} filePath - Path to the video on your disk
 * @param {object} metadata - e.g., { caption: "Luxury Knacks", category: "premium" }
 */
export async function uploadDirectToStream(filePath, metadata = {}) {
  const file = fs.createReadStream(filePath);
  const size = fs.statSync(filePath).size;

  console.log(`🚀 Starting upload: ${metadata.caption || 'Premium Video'} (${(size / 1024 / 1024).toFixed(2)} MB)`);

  const upload = new tus.Upload(file, {
    endpoint: `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream`,
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
    },
    chunkSize: 5 * 1024 * 1024, // 5MB chunks
    metadata: {
      filename: metadata.caption || "premium_video.mp4",
      filetype: "video/mp4",
      ...metadata
    },
    uploadSize: size,
    onError: (error) => {
      console.error("❌ Upload failed:", error);
    },
    onProgress: (bytesUploaded, bytesTotal) => {
      const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
      console.log(`[UPLOAD] ${percentage}%`);
    },
    onSuccess: () => {
      // 🟢 This URL contains the Video UID at the end
      const videoId = upload.url.split('/').pop();
      console.log(`✅ Upload Complete! Video ID: ${videoId}`);
      console.log(`🔗 Preview: customer-29lm4bwfne12bg0v.cloudflarestream.com/${videoId}/watch`);
    },
  });

  upload.start();
}

// Example usage:
// uploadDirectToStream("./my_video.mp4", { caption: "Premium Content #1" });