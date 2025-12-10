import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

// Store messages in memory (simple for testing)
const videos = {}; // { "<chat_id>_<message_id>": file_id }

// 1️⃣ Webhook route: receives messages from Telegram
app.post("/webhook", (req, res) => {
  const update = req.body;

  // Check if message has a video
  const message = update.message || update.channel_post || update.edited_message;
  if (message && message.video) {
    const key = `${message.chat.id}_${message.message_id}`;
    videos[key] = message.video.file_id;
    console.log("Saved video:", key, message.video.file_id);
  }

  // Check forwarded messages from channel
  if (message && message.forward_from_chat && message.forward_from_message_id && message.video) {
    const key = `${message.forward_from_chat.id}_${message.forward_from_message_id}`;
    videos[key] = message.video.file_id;
    console.log("Saved forwarded video:", key, message.video.file_id);
  }

  res.sendStatus(200);
});

// 2️⃣ Endpoint to fetch video URL
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

    // Get file path
    const fileRes = await axios.get(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const filePath = fileRes.data.result.file_path;

    // Return playable URL
    const playableUrl = `${TELEGRAM_FILE_API}/${filePath}`;
    return res.json({ url: playableUrl });

  } catch (err) {
    console.error(err?.response?.data || err);
    return res.status(500).json({ error: "Unable to get video" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
