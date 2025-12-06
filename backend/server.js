import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";

const app = express();
app.use(cors());

// Create uploads folder if not exists
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer (stores uploaded files in /uploads/)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Upload endpoint
app.post("/upload", upload.single("video"), (req, res) => {
  const fileUrl = `https://telegram-video-backend.onrender.com/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// Serve uploaded video files
app.use("/uploads", express.static(uploadDir));

const PORT = 5000;
app.listen(PORT, () => console.log("Backend running on port " + PORT));
