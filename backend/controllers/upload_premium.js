import fs from "fs";
import * as tus from "tus-js-client";
import "dotenv/config";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN;

export function uploadDirectToStream(filePath, metadata = {}) {
  return new Promise((resolve, reject) => { 
    
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
      chunkSize: 50 * 1024 * 1024, 
      metadata: {
        filename: metadata.caption || "premium_video.mp4",
        filetype: "video/mp4",
        // 🟢 NEW: Allow passing a media_group_id to link videos together
        media_group_id: metadata.media_group_id || "none",
        ...metadata
      },
      uploadSize: size,
      onError: (error) => {
        console.error("❌ Upload failed:", error);
        reject(error); 
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        if (percentage % 10 === 0) console.log(`[UPLOAD] ${percentage}%`);
      },
      onSuccess: () => {
        const videoId = upload.url.split('/').pop();
        console.log(`✅ Upload Complete! Video ID: ${videoId}`);
        // 🟢 Pass the media_group_id back out so the database can save it
        resolve({ 
          uid: videoId, 
          media_group_id: metadata.media_group_id || null 
        });
      },
    });

    upload.start();
  });
}