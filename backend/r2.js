import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import "dotenv/config";

const execPromise = promisify(exec);

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "videos-bucket";
export const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "https://bucket.naijahomemade.com";
export const R2_ENDPOINT = process.env.R2_ENDPOINT;

export const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const getMimeType = (extension) => {
  const ext = extension.toLowerCase().replace(".", "");
  const mimeMap = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    m4v: "video/x-m4v",
    mkv: "video/x-matroska",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  };
  return mimeMap[ext] || "video/mp4";
};

/**
 * Uploads a video file and generates its thumbnail, storing both in Cloudflare R2.
 * @param {string} filePath - Local path to the uploaded video file
 * @param {string} category - Category (e.g. 'premium', 'hotties', 'amateur', etc.)
 * @param {string} internalId - Unique message ID for the video
 * @param {string} originalName - Original filename to preserve extension
 * @returns {Promise<{ r2Key: string, cloudflareId: string, thumbKey: string, staticUrl: string }>}
 */
export async function uploadVideoToR2(filePath, category, internalId, originalName = "video.mp4") {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Upload file not found: ${filePath}`);
  }

  const safeCategory = (category || "hotties").toLowerCase().trim();
  const extension = path.extname(originalName).replace(".", "") || "mp4";
  const r2Key = `${safeCategory}/${internalId}.${extension}`;
  const mimeType = getMimeType(extension);

  console.log(`🚀 [R2 UPLOAD] Uploading video to R2: ${r2Key} (${(fs.statSync(filePath).size / (1024 * 1024)).toFixed(2)} MB)`);

  // 1. Stream video file to Cloudflare R2
  const fileStream = fs.createReadStream(filePath);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    Body: fileStream,
    ContentType: mimeType,
  }));

  console.log(`✅ [R2 UPLOAD] Video uploaded successfully: ${r2Key}`);

  // 2. Generate and upload thumbnail to R2
  const thumbKey = `thumbs/internal_${internalId}.jpg`;
  const tempThumbPath = `${filePath}_thumb.jpg`;

  try {
    // Extract crisp 640px wide thumbnail at 1s timestamp
    await execPromise(`ffmpeg -i "${filePath}" -ss 00:00:01.000 -vframes 1 -vf scale=640:-1 -q:v 4 "${tempThumbPath}" -y`);
    
    if (fs.existsSync(tempThumbPath)) {
      const thumbBuffer = fs.readFileSync(tempThumbPath);
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: thumbKey,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
      }));
      fs.unlinkSync(tempThumbPath);
      console.log(`🖼️ [R2 UPLOAD] Thumbnail saved to R2: ${thumbKey}`);
    }
  } catch (ffmpegErr) {
    console.warn(`⚠️ [R2 UPLOAD] FFmpeg thumbnail generation warning:`, ffmpegErr.message);
    if (fs.existsSync(tempThumbPath)) {
      try { fs.unlinkSync(tempThumbPath); } catch (e) {}
    }
  }

  return {
    r2Key,
    cloudflareId: `r2:${r2Key}`,
    thumbKey,
    staticUrl: `${R2_PUBLIC_DOMAIN}/${r2Key}`
  };
}

/**
 * Deletes a video file and its associated thumbnail from Cloudflare R2.
 * @param {string} cloudflareId - e.g. 'r2:premium/internal_123.mp4'
 * @param {string} messageId - e.g. 'premium_123'
 */
export async function deleteMediaFromR2(cloudflareId, messageId) {
  if (!cloudflareId || !cloudflareId.startsWith("r2:")) return;

  const r2Key = cloudflareId.replace("r2:", "");
  try {
    await r2.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
    }));
    console.log(`🗑️ [R2 DELETE] Video deleted from R2: ${r2Key}`);
  } catch (err) {
    console.warn(`⚠️ [R2 DELETE] Could not delete video ${r2Key}:`, err.message);
  }

  // Also delete thumbnail
  if (messageId) {
    const thumbKey = `thumbs/internal_${messageId}.jpg`;
    try {
      await r2.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: thumbKey,
      }));
      console.log(`🗑️ [R2 DELETE] Thumbnail deleted from R2: ${thumbKey}`);
    } catch (err) {
      console.warn(`⚠️ [R2 DELETE] Could not delete thumbnail ${thumbKey}:`, err.message);
    }
  }
}
