import axios from "axios";
import { pool } from "./db.js";
import { r2, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from "./r2.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

/**
 * Normalizes a channel identifier into a valid Telegram chat identifier
 * Supports:
 * - @channelname
 * - channelname -> @channelname
 * - https://t.me/channelname -> @channelname
 * - https://t.me/+inviteHash -> invite hash
 * - numeric chat/channel ID (-100..., 188...)
 */
export function normalizeTelegramChatId(input) {
  if (!input) return null;
  let str = String(input).trim();
  if (!str) return null;

  // Numeric ID
  if (/^-?\d+$/.test(str)) {
    return str;
  }

  // URL extraction
  if (str.includes("t.me/")) {
    const match = str.match(/t\.me\/(?:\+)?([a-zA-Z0-9_]+)/);
    if (match && match[1]) {
      return str.includes("/+") ? `+${match[1]}` : `@${match[1]}`;
    }
  }

  // Strip leading @ if present
  if (str.startsWith("@")) {
    str = str.slice(1).trim();
  }

  // Check if valid Telegram username (letters, numbers, underscores)
  if (/^[a-zA-Z0-9_]{3,32}$/.test(str)) {
    return `@${str}`;
  }

  return null;
}

/**
 * Fetches Telegram chat info (title, description/bio, photo) using Telegram Bot API
 * @param {string|number} identifier - Chat ID, @username, or link
 * @returns {Promise<{ ok: boolean, data?: object, error?: string }>}
 */
export async function fetchTelegramChat(identifier) {
  if (!BOT_TOKEN) return { ok: false, error: "Bot token not configured" };
  const target = normalizeTelegramChatId(identifier);
  if (!target) return { ok: false, error: `Invalid Telegram handle format "${identifier}". Handles must contain only letters, numbers, and underscores (e.g. @channel_name).` };

  try {
    const res = await axios.get(`${TELEGRAM_API}/getChat`, {
      params: { chat_id: target },
      timeout: 4000
    });

    if (res.data?.ok && res.data.result) {
      return { ok: true, data: res.data.result };
    }
    return { ok: false, error: "Empty result from Telegram" };
  } catch (err) {
    const msg = err.response?.data?.description || err.message;
    return { ok: false, error: msg };
  }
}

/**
 * Downloads a photo file from Telegram and uploads it to Cloudflare R2
 * Returns the public URL or relative API avatar path
 */
export async function downloadAndUploadTelegramPhoto(fileId, targetKey) {
  if (!BOT_TOKEN || !fileId) return null;
  try {
    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, {
      params: { file_id: fileId },
      timeout: 8000
    });

    const filePath = fileRes.data?.result?.file_path;
    if (!filePath) return null;

    const imgRes = await axios.get(`${TELEGRAM_FILE_API}/${filePath}`, {
      responseType: "arraybuffer",
      timeout: 10000
    });

    const buffer = Buffer.from(imgRes.data);
    const safeKey = String(targetKey).replace(/[^a-zA-Z0-9_-]/g, "_");
    const r2Key = `avatars/creator_${safeKey}.jpg`;

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: buffer,
      ContentType: "image/jpeg"
    }));

    return `/api/avatar?user_id=${encodeURIComponent(targetKey)}&v=${Date.now()}`;
  } catch (err) {
    console.warn(`[TELEGRAM SYNC] Photo download/upload warning for ${targetKey}:`, err.message);
    return null;
  }
}

/**
 * Syncs an individual Telegram creator's profile pic and bio from Telegram.
 * Updates app_users in PostgreSQL.
 * @param {object} creator - app_users creator row or object
 * @param {object} [poolInstance] - PostgreSQL pool instance
 * @param {object} [options] - Options like { throwOnError: boolean }
 * @returns {Promise<object>} updated creator object
 */
export async function syncTelegramCreatorProfile(creator, poolInstance, options = {}) {
  const db = poolInstance || pool;
  if (!creator) return creator;

  const creatorId = creator.id;
  const username = creator.username;
  const tgUserId = creator.telegram_user_id;
  const sourceChannel = creator.source_channel;

  // Build candidate list of Telegram chat identifiers
  const candidates = [];
  if (sourceChannel) {
    const norm = normalizeTelegramChatId(sourceChannel);
    if (!norm) {
      if (options.throwOnError) {
        throw new Error(`Invalid Telegram handle format "${sourceChannel}". Channel handles cannot contain spaces or emojis. Please use a valid public handle (e.g. @channel_name or https://t.me/channel_name).`);
      }
    } else {
      candidates.push(norm);
    }
  }

  if (tgUserId) {
    const normTg = normalizeTelegramChatId(tgUserId);
    if (normTg && !candidates.includes(normTg)) candidates.push(normTg);
  }

  if (username && !username.startsWith("tg_")) {
    const normUname = normalizeTelegramChatId(username);
    if (normUname && !candidates.includes(normUname)) candidates.push(normUname);
  }

  // Also check if any videos have a t.me link for this creator
  try {
    const linkRes = await db.query(
      `SELECT caption FROM videos 
       WHERE (uploader_id = $1 OR ($2::BIGINT IS NOT NULL AND uploader_id = $2::BIGINT)) 
         AND caption ILIKE '%t.me/%' 
       ORDER BY id DESC LIMIT 5`,
      [creatorId, tgUserId || null]
    );
    for (const row of linkRes.rows) {
      const match = row.caption.match(/https:\/\/t\.me\/([a-zA-Z0-9_]+)/);
      if (match && match[1] && !match[1].startsWith("+")) {
        const foundHandle = `@${match[1]}`;
        if (!candidates.includes(foundHandle)) {
          candidates.push(foundHandle);
        }
      }
    }
  } catch (e) {}

  if (candidates.length === 0) {
    if (options.throwOnError) {
      throw new Error("No valid Telegram channel handle found. Please enter the channel username (e.g. @channel_name or https://t.me/channel_name) in the field above.");
    }
    return creator;
  }

  let chatData = null;
  let successfulTarget = null;
  let lastError = null;

  for (const candidate of candidates) {
    const result = await fetchTelegramChat(candidate);
    if (result.ok && result.data) {
      chatData = result.data;
      successfulTarget = candidate;
      break;
    } else if (result.error) {
      lastError = result.error;
    }
  }

  // If no candidate succeeded, and tgUserId is a positive user ID, try getUserProfilePhotos
  let photoFileId = chatData?.photo?.big_file_id || chatData?.photo?.small_file_id;
  if (!photoFileId && tgUserId && Number(tgUserId) > 0) {
    try {
      const photosRes = await axios.get(`${TELEGRAM_API}/getUserProfilePhotos`, {
        params: { user_id: tgUserId, limit: 1 },
        timeout: 5000
      });
      const photos = photosRes.data?.result?.photos;
      if (photos && photos.length > 0) {
        photoFileId = photos[0][photos[0].length - 1]?.file_id || photos[0][0]?.file_id;
      }
    } catch (e) {}
  }

  if (!chatData && !photoFileId) {
    if (options.throwOnError) {
      const attempted = candidates.join(", ");
      let hint = `Telegram could not find channel (${attempted}): ${lastError || "chat not found"}.`;
      hint += ` Please verify the channel is public (e.g. @channel_name). If it is a private channel, make sure @Mini_video_app_bot is added as an administrator.`;
      throw new Error(hint);
    }
    return creator;
  }

  const updates = [];
  const values = [];
  let paramIdx = 1;

  // 1. Bio / Description
  const rawBio = chatData?.description || chatData?.bio;
  if (rawBio && rawBio.trim()) {
    const cleanBio = rawBio.trim().slice(0, 500);
    updates.push(`creator_bio = $${paramIdx++}`);
    values.push(cleanBio);
    creator.creator_bio = cleanBio;
  } else if (!creator.creator_bio || creator.creator_bio.startsWith("Official creator channel") || creator.creator_bio.startsWith("Official Telegram channel")) {
    const channelName = chatData?.title || chatData?.first_name || creator.display_name || creator.username;
    const fallbackBio = `Official channel of ${channelName}. Catch all exclusive drops and daily previews here.`;
    updates.push(`creator_bio = $${paramIdx++}`);
    values.push(fallbackBio);
    creator.creator_bio = fallbackBio;
  }

  // 2. Profile Picture
  const avatarKey = tgUserId ? String(tgUserId) : (username || String(creatorId));
  if (photoFileId) {
    // Download and upload to R2
    await downloadAndUploadTelegramPhoto(photoFileId, avatarKey);
    const newAvatarUrl = `/api/avatar?user_id=${encodeURIComponent(avatarKey)}&v=${Date.now()}`;
    updates.push(`avatar_url = $${paramIdx++}`);
    values.push(newAvatarUrl);
    creator.avatar_url = newAvatarUrl;
  } else if (!creator.avatar_url || creator.avatar_url.includes("default-avatar")) {
    const avatarUrl = `/api/avatar?user_id=${encodeURIComponent(avatarKey)}`;
    updates.push(`avatar_url = $${paramIdx++}`);
    values.push(avatarUrl);
    creator.avatar_url = avatarUrl;
  }

  // 3. Display Name
  const rawTitle = chatData?.title || [chatData?.first_name, chatData?.last_name].filter(Boolean).join(" ");
  if (rawTitle && rawTitle.trim() && (!creator.display_name || creator.display_name.startsWith("Creator ") || creator.display_name.startsWith("Channel ") || creator.display_name === creator.username)) {
    const cleanTitle = rawTitle.trim().slice(0, 100);
    updates.push(`display_name = $${paramIdx++}`);
    values.push(cleanTitle);
    creator.display_name = cleanTitle;
  }

  // 4. Source Channel
  if (successfulTarget && (!creator.source_channel || creator.source_channel !== successfulTarget)) {
    updates.push(`source_channel = $${paramIdx++}`);
    values.push(successfulTarget);
    creator.source_channel = successfulTarget;
  }

  if (!photoFileId && !rawBio && chatData?.title) {
    creator.notice = `Found channel "${chatData.title}", but it does not have a profile picture or bio set on Telegram.`;
  }

  if (updates.length > 0 && creatorId) {
    try {
      values.push(creatorId);
      await db.query(
        `UPDATE app_users 
         SET ${updates.join(", ")} 
         WHERE id = $${paramIdx}`,
        values
      );
      console.log(`✅ [TELEGRAM SYNC] Successfully updated profile pic & bio for @${username} (${successfulTarget || tgUserId})`);
    } catch (dbErr) {
      console.warn(`[TELEGRAM SYNC] DB update warning for ${creatorId}:`, dbErr.message);
    }
  }

  return creator;
}
