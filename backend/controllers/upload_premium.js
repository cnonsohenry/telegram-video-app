import fs from "fs";
import * as tus from "tus-js-client";
import "dotenv/config";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN;

export function uploadDirectToStream(filePath, metadata = {}) {
  return new Promise((resolve, reject) => { // 🟢 Wrapped in Promise
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return reject(new Error(`File not found: ${filePath}`));
    }

    const file = fs.createReadStream(filePath);
    const size = fs.statSync(filePath).size;

    console.log(`🚀 Starting upload: ${metadata.caption || 'Premium Video'} (${(size / 1024 / 1024).toFixed(2)} MB)`);

    const upload = new tus.Upload(file, {
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream`,
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
      },
      chunkSize: 50 * 1024 * 1024, // Increased chunk size for speed
      metadata: {
        filename: metadata.caption || "premium_video.mp4",
        filetype: "video/mp4",
        ...metadata
      },
      uploadSize: size,
      onError: (error) => {
        console.error("❌ Upload failed:", error);
        reject(error); // 🔴 Reject the promise on error
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        // Only log every 10% to keep logs clean
        if (percentage % 10 === 0) console.log(`[UPLOAD] ${percentage}%`);
      },
      onSuccess: () => {
        // 🟢 Resolve the promise with the Video ID
        const videoId = upload.url.split('/').pop();
        console.log(`✅ Upload Complete! Video ID: ${videoId}`);
        resolve({ uid: videoId });
      },
    });

    upload.start();
  });
}