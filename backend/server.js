import express from "express";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

const videosFile = path.join(process.cwd(), "saved_videos.json");

// Load saved videos from file into memory
let videos = {};
if (fs.existsSync(videosFile)) {
  try {
    const data = fs.readFileSync(videosFile, "utf8");
    videos = JSON.parse(data);
  } catch (e) {
    console.error("Failed to load saved videos:", e);
  }
}

// Helper to save videos to file
function saveVideosToFile() {
  fs.writeFileSync(videosFile, JSON.stringify(videos, null, 2));
}

// 1️⃣ Webhook route: receives messages from Telegram
app.post("/webhook", (req, res) => {
  const update = req.body;

  // Support message, channel_post, or edited_message
  const message = update.message || update.channel_post || update.edited_message;

  if (message && message.video) {
    const key = `${message.chat.id}_${message.message_id}`;
    videos[key] = message.video.file_id;
    console.log("Saved video:", key, message.video.file_id);
  }

  // Handle forwarded videos from channels
  if (message && message.forward_from_chat && message.forward_from_message_id && message.video) {
    const key = `${message.forward_from_chat.id}_${message.forward_from_message_id}`;
    videos[key] = message.video.file_id;
    console.log("Saved forwarded video:", key, message.video.file_id);
  }

  // Persist all videos
  saveVideosToFile();

  res.sendStatus(200);
});

// 2️⃣ Endpoint to fetch a single video URL
app.get("/video", async (req, res) => {
  try {
    const { message_id, chat_id } = req.query;
    if (!message_id || !chat_id) {
      return res.status(400).json({ error: "message_id and chat_id are required" });
    }

    const key = `${chat_id}_${message_id}`;
    const fileId = videos[key];

    if (!fileId) {
      return res.status(404).json({ error: "Video not found. Make sure the bot received this message." });
    }

    const fileRes = await axios.get(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const filePath = fileRes.data.result.file_path;
    const playableUrl = `${TELEGRAM_FILE_API}/${filePath}`;

    return res.json({ url: playableUrl });
  } catch (err) {
    console.error(err?.response?.data || err);
    return res.status(500).json({ error: "Unable to get video" });
  }
});

// 3️⃣ Endpoint to list all saved videos with pagination/search
app.get("/videos", (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const allVideos = Object.entries(videos).map(([key, file_id]) => {
      const [chat_id, message_id] = key.split("_");
      return { chat_id, message_id, file_id };
    });

    // Optional search filter
    const filtered = search
      ? allVideos.filter(v => v.chat_id.includes(search) || v.message_id.includes(search))
      : allVideos;

    // Pagination
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + Number(limit));

    res.json({
      page: Number(page),
      limit: Number(limit),
      total: filtered.length,
      videos: paginated,
    });
  } catch (error) {
    console.error("Error fetching /videos:", error);
    res.status(500).json({ error: "Failed to load videos" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
