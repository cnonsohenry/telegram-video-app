import "dotenv/config";
import pkg from "pg";
import axios from "axios";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000";
const BATCH_SIZE = 10;
const DELAY_MS = 1000; // 1 second between batches to avoid overwhelming OpenRouter

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function expandCaption(caption, category) {
  try {
    const res = await axios.post(
      `${PYTHON_SERVICE_URL}/api/expand-caption`,
      { caption: caption || "", category: category || "hotties" },
      { timeout: 10000 }
    );
    if (res.data.status === "success") return res.data.description;
    return null;
  } catch (e) {
    return null;
  }
}

async function runBatch() {
  console.log("🚀 Starting SEO description batch job...");

  // Count how many need processing
  const countRes = await pool.query(`
    SELECT COUNT(*) FROM videos 
    WHERE seo_description IS NULL
  `);
  const total = Number(countRes.rows[0].count);
  console.log(`📊 Found ${total} videos without SEO descriptions.`);

  if (total === 0) {
    console.log("✅ All videos already have SEO descriptions. Nothing to do.");
    await pool.end();
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let offset = 0;

  while (true) {
    // Fetch next batch
    const batchRes = await pool.query(`
      SELECT message_id, caption, category 
      FROM videos 
      WHERE seo_description IS NULL
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [BATCH_SIZE, offset]);

    if (batchRes.rows.length === 0) break;

    console.log(`\n⚙️  Processing batch of ${batchRes.rows.length} videos...`);

    // Process each video in the batch concurrently
    await Promise.all(batchRes.rows.map(async (video) => {
      const description = await expandCaption(video.caption, video.category);

      if (description) {
        await pool.query(
          `UPDATE videos SET seo_description = $1 WHERE message_id = $2`,
          [description, video.message_id]
        );
        succeeded++;
        console.log(`✅ [${succeeded}/${total}] ${video.message_id} — ${description.substring(0, 60)}...`);
      } else {
        failed++;
        console.log(`⚠️  [${failed} failed] Skipped ${video.message_id} — API returned nothing.`);
      }

      processed++;
    }));

    offset += BATCH_SIZE;

    // Progress report
    const percent = Math.round((processed / total) * 100);
    console.log(`\n📈 Progress: ${processed}/${total} (${percent}%) — ✅ ${succeeded} done, ⚠️ ${failed} failed`);

    // Pause between batches
    if (batchRes.rows.length === BATCH_SIZE) {
      console.log(`💤 Pausing ${DELAY_MS}ms before next batch...`);
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n🏁 Batch job complete.`);
  console.log(`✅ Successfully generated: ${succeeded}`);
  console.log(`⚠️  Failed/skipped: ${failed}`);
  console.log(`📊 Total processed: ${processed}`);

  await pool.end();
}

runBatch().catch(async (err) => {
  console.error("❌ Fatal batch error:", err.message);
  await pool.end();
  process.exit(1);
});