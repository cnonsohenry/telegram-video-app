# Project Brain & Architecture Rules

This file is automatically loaded by Antigravity on every conversation turn. It defines the definitive architecture, server roles, and decisions for the project.

---

## 1. Server & Environment Topology

### Workstation (Local PC)
- **Role**: Code editing, testing, git control only.
- **Rule**: **NEVER run persistent background services locally**. All daemons must run on the remote engines server.

### Engines Server: `ssh appuser@94.72.109.109`
- **Role**: All background Python automation daemons and scraping services.
- **Node.js**: Upgraded to **Node v24.11.1** located in `/home/appuser/.local/bin/node` with Chrome Headless Shell for HeyGen HyperFrames.
- **Active Systemd Services**:
  1. `telegram-forwarder.service` (Working directory: `/home/appuser/engines/channel_forwarder`)
  2. `fastapi-twitter.service` (Working directory: `/home/appuser/engines/twitter_engine`)

### Production Website & API: `ssh appuser@94.198.190.106`
- **Role**: Live public website, frontend, backend API database (`https://naijahomemade.com`).
- **Deployment Paths**:
  - Backend: `/home/appuser/apps/backend/` (managed by PM2 process `naijahomemade-api`).
  - Frontend: Always sync `frontend/dist/*` to **BOTH** `/home/appuser/apps/frontend/dist/` (used by Node.js SSR/meta handler) AND `/var/www/videos/` (Nginx `root` for `/assets/`).

---

## 2. Decommissioned & Obsolete Apps & IDs
- **`telegram-video-app`**: **DEPRECATED & DELETED**.
  - Migrated to `94.198.190.106`.
  - **Never reference or look for `/home/appuser/apps/telegram-video-app`**.
- **Separate Daemons**:
  - `creator-story-pipeline.service` and `afrobeat-telegram-listener.service` are **deprecated**. Everything runs uniformly inside `telegram-forwarder.service`.
- **Obsolete User ID `1881815190` & Disassociation of Channel ID from User ID**:
  - Telegram user ID `1881815190` is permanently obsolete and removed from all services, backend logic, and frontend components.
  - Channel IDs (e.g. `-1004344719694`, `-1003754790625`) are channels, not user IDs. The platform has completely moved away from using Telegram user IDs.
  - Telegram channel IDs belong strictly in `app_users.source_channel`.
  - Creators and users are identified across the platform by `app_users.id` and `app_users.username`.
  - `videos.uploader_id` maps directly to `app_users.id`.
  - Channel `-1004344719694` is renamed to `"Naija xxx"` (username `naijaxxx`, display name `"Naija xxx"`, user ID `458`) across Telegram, database, backend API, frontend admin upload, and forwarding tasks.

---

## 3. Unified Engine Architecture (`telegram-forwarder.service`)
All tasks inherit from `BaseTask` and run concurrently in the asyncio loop in `/home/appuser/engines/channel_forwarder/`:
- **`[PIPELINE]` Group**:
  - `CREATOR-24H-STORY-PIPELINE` (`CreatorStoryTask`):
    - **50% Daily Post Eligibility**: Only active creators meeting at least 50% of their daily posts (at least 3 of 5 posts in the rolling 24-hour window from `creator_daily_posts.json`) participate, ensuring adequate source clips exist for multi-scene highlights.
    - **Randomized 1 - 5 Daily Statuses**: Each eligible creator is assigned a randomized quota of 1 to 5 status stories every 24 hours, distributed naturally with dynamic cooldown spacing (`min_spacing_seconds = max(7200, int((86400 / daily_target) * 0.65))`).
    - **Purely Random Video Selection**: Source videos for stories are queried with `ORDER BY RANDOM()` without views/likes metric biases, source clips are randomly shuffled, and scenes are sliced with randomized offsets across the creator's catalog.
    - **Multi-Archetype Story Architecture (Human Social Mimicry)**:
      - Breaks away from rigid "always 3 slices + always music" formula into 4 probabilistically weighted archetypes:
        1. **`raw_single_clip` (~45%)**: Single continuous candid clip (9.0s–16.0s) with 100% natural creator audio (room ambience, whispering, laughter, speaking) and 1.0s audio fade-out. Sound title: `"Original Audio • {Creator Display Name}"`.
        2. **`music_single_clip` (~25%)**: Single continuous clip (10.0s–16.0s) muxed with authentic Afrobeat soundtrack (`"{Song Title} • {Artist}"`).
        3. **`same_video_jumpcuts` (~20%)**: 2 to 3 micro-cuts extracted from different timestamps within the *SAME video shoot*, ensuring 100% consistent outfit, lighting, and setting.
        4. **`catalog_montage` (~10%)**: Multi-video teaser across the creator's catalog.
      - **Resilient Audio Stream Probing (`ffprobe`)**: Automatically probes candidate videos for audio tracks; silent source videos smoothly fallback from `raw_single_clip` to `music_single_clip`.
      - **Dynamic Natural Story Durations**: Randomized durations between 9.0s and 16.0s per story instead of rigid static lengths.
      - **Ultra-Fast Native ffmpeg Concat (1.5s–3s)**: Video assembly uses native ffmpeg cropping, concatenation, and audio muxing with strict 1-second keyframe density (`-g 30 -keyint_min 30`), `-movflags +faststart`, CRF 23, and 2200k maxrate (~3MB per story). HyperFrames is retained as a fallback.
      - Picks authentic Afrobeat anthems dynamically from `story_pipeline/assets/sounds/afrobeat/catalog.json`.
      - Renders strictly sequentially (1 at a time) with a 15s cooldown.
  - `AFROBEAT-MUSIC-INGESTION` (`AfrobeatMusicTask`):
    - Monitors Telegram channel `-1003433903453` (*Afrobeat Library Source*) every 30s.
    - Ingests Audiomack links via native signed OAuth API + direct ffmpeg stream transcoding (immune to YouTube bot blocks and site changes).
    - Downloads YouTube/streaming links and forwarded MP3s via `yt-dlp` and Telethon.
    - Adds tracks to `catalog.json` and replies with confirmation receipts.
  - `CREATOR-FOLLOW-NETWORK` (`CreatorFollowTask`):
    - Evaluates managed creators every 30m (`delay_seconds = 1800`) to maintain organic social graphs.
    - Curates peer mutuals (70% category affinity + 30% platform popularity) with target limits per creator archetype:
      1. `networker` (~40%): Follows 35–50 peers, follows back 18%–28% of fans.
      2. `niche_specialist` (~40%): Follows 20–35 peers, follows back 10%–18% of fans.
      3. `selective_vip` (~20%): Follows 12–22 peers, follows back 4%–8% of fans.
    - Follow-backs of organic fans occur with natural human time delays (15m to 18h after the fan follows).
    - Backed by persistent state in `data/tracker_creator_follows.json` and endpoints `GET /api/creator/managed/candidates` and `POST /api/creator/managed/sync-follows`.
    - `FollowListModal.jsx` displays `"Follows you"` badges when a displayed user follows the logged-in viewer.
  - `CREATOR-HIGHLIGHT-PIPELINE` (`CreatorHighlightTask`):
    - Evaluates managed creators every 5m (`delay_seconds = 300`) with dynamic cooldowns (4h - 12h) to curate authentic Instagram-style profile highlights.
    - **Dynamic Scaling with Story Volume**: Highlight target counts dynamically calculate based on the creator's total story archive:
      - 1–3 stories: 1–2 highlights
      - 4–7 stories: 2–3 highlights
      - 8–11 stories: 3–4 highlights
      - 12+ stories: 4–5 highlights
    - **Highlight Capacity & Spawn Rules**: Maximum 6 stories per highlight to ensure clean, focused reels. When an incoming story arrives, the pipeline spawns a brand new highlight with an AI-generated title (via `highlight_ai.py`) if the creator has fewer highlights than their dynamic target, rather than overcrowding a single highlight.
    - **Backend Array Replacement**: `PATCH /api/creator/:username/highlights/:id` fully supports passing explicit `story_ids` arrays for re-ordering, slicing, and trimming without forced historical appending.

---

## 4. Cloudflare R2 Storage
- Cloudflare R2 downloads in `pipeline.py` use **native Python `boto3`** (`endpoint_url=https://38a837fbea8923df232800a696e9a247.r2.cloudflarestorage.com`, bucket: `videos-bucket`).
- Do not rely on external Node.js scripts for R2 downloads.

---

## 5. Creator Daily Posting Limits (Max 5 Posts/24h) & Managed Creator Long-Form Premium Policy
- **Posting Limit**: No creator (static or dynamic) is permitted to post more than **5 times daily** within any rolling 24-hour window.
- **Minimum Cooldown Spacing**: Consecutive posts by the same creator must be spaced by at least **4 hours** (`min_spacing_seconds = 14400`).
- **Persistence**: Daily post timestamps are tracked persistently across daemon restarts in `data/creator_daily_posts.json` via `core/daily_limiter.py`.
- **Enforcement Chokepoint**: `ApiForwarderTask.step()` evaluates `can_creator_post(creator_uname)` before downloading media or executing API requests.
- **Static Tasks**: Static upload tasks in `config/tasks_config.py` have intervals set to `17280` seconds (4.8 hours = 5 times in 24h) with staggered startup delays.
- **Managed Creator Long-Form Premium Policy (> 90 Seconds)**:
  - For managed creators (`app_users.is_managed = TRUE`), any posted video exceeding **90 seconds in duration (`duration > 90`)** automatically defaults to category `"premium"` (`is_premium = true`), overriding generic AI category classifications.
  - **Strict Demotion of Short Clips (<= 90 Seconds)**: Any video <= 90s posted for or by managed creators is strictly prohibited from being marked as `"premium"` / VIP. If `"premium"` was requested or returned, it is automatically demoted to a public category (`baddies`, `knacks`, `hotties`, `amateurs`, `college`).
  - **AI Category Classifier (`twitter_engine/api.py`)**: `premium` and `vip` are permanently removed from the allowable classification categories (`ALL_CATEGORIES_EXCEPT_TRENDS`). Premium status is strictly governed by physical duration (> 90s), never by caption NLP heuristics.
  - **Dynamic Forwarders Config**: All 104 dynamic forwarders in `dynamic_api_forwarders.json` and `creator_pipeline.py` default to category `"baddies"`. Only clips with probed duration > 90s elevate to `"premium"`.
  - Enforced across all ingestion vectors:
    1. Python Channel Forwarder (`engines/channel_forwarder/tasks/api_forwarder.py`): Probes duration with `ffprobe` / Telegram video metadata; videos > 90s route to `premium` with randomized VIP subscription pricing ($15 - $35); videos <= 90s are strictly routed to public categories.
    2. Admin Upload Endpoint (`/api/admin/upload-premium` in `backend/server.js`): Probes duration via `ffprobe` (and accounts for trimming); if creator is managed and duration > 90s, forces `safeCategory = "premium"`; if duration <= 90s, demotes requested `premium` to `baddies`.
    3. Creator Upload Endpoints (`/api/creator/upload` and `/api/creator/complete-upload` in `backend/creator.js`): Checks `is_managed` and probes/evaluates duration; enforces `isVip = true` for duration > 90s and `isVip = false` for duration <= 90s.
    4. Frontend Upload Modal (`CreatorUploadModal.jsx`): Inspects video metadata duration; automatically flips VIP toggle on and notifies managed creators with an informational toast.

---

## 6. Universal Task Daily Limits & Interval Enforcement
- **Persistent Engine Schedule Enforcement**: All periodic engine tasks inheriting from `BaseTask` (with `delay_seconds >= 600`) enforce strict 24-hour run caps and cooldown spacing via `core/daily_limiter.py` (`can_task_run` and `record_task_run`).
- **Persistence Across Reboots**: Task run timestamps are stored persistently in `data/task_daily_runs.json`. On daemon reboot or restart, tasks evaluate their remaining cooldown and sleep until their next slot opens rather than immediately firing.
- **`24-HOUR VIP GRID PREVIEW`**: Strictly capped at **1 run per 24 hours** (`delay_seconds = 86400`, min spacing 23 hours).
- **`12-HOUR CYCLICAL SCREENSHOTS LOOP`**: Strictly capped at **2 runs per 24 hours** (`delay_seconds = 43200`, min spacing 11.5 hours).
- **Restricted Channel Forwarding Resiliency**: Telegram channels with content restrictions (e.g. `-1002241571632`) that reject `forward_messages` are automatically handled with direct upload fallbacks or non-fatal logging, preventing cascading retry loops.

---

## 7. Creator Story Authentication & Per-User View Highlights
- **Strict Authentication & Email Verification Requirement**: Only authenticated and email-verified users can view creator story posts.
  - Guests attempting to open stories receive a login prompt (`promptLogin("view story")`).
  - Authenticated but unverified users receive an email verification prompt (`promptEmailVerification({ reason: "story" })`).
  - Backend `GET /api/creator/:username/story` returns HTTP 401 if unauthenticated (`requires_auth: true`) and HTTP 403 if unverified (`requires_email_verification: true`).
  - Profile endpoint `GET /api/creator/:username` omits the playable `video_url` for unauthenticated or unverified requests.
- **Per-User Story View Tracking**:
  - Tracked in PostgreSQL table `creator_story_views (user_id, story_id, viewed_at)` and synchronized across components via global `storyViewed` events and optimistic local storage caching.
  - Story views recorded via `POST /api/creator/:username/story/view`.
- **Dynamic Avatar Highlight Rings**:
  - **Unviewed Active Story**: Colorful gradient ring (`linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)`).
  - **Viewed Active Story**: Highlight ring dynamically turns **gray** (`rgba(255, 255, 255, 0.35)`) exclusively for the specific logged-in user who watched it.
  - **Per-User Isolation**: Other users and unauthenticated visitors retain the vibrant colorful gradient until they watch the story themselves.

---

## 8. Multi-Story Sequential Player Architecture
- **Dual-Player Ping-Pong Architecture (0ms Latency Transitions)**:
  - Eliminates DOM remounting by maintaining two permanent `<video>` elements (`videoRef0` and `videoRef1`) in the modal.
  - While active slot plays (`opacity: 1`, `zIndex: 2`), standby slot pre-buffers upcoming story in the hardware decoder (`opacity: 0`, `zIndex: 1`).
  - Swiping or tapping toggles active slots and calls `.play()` instantly with zero black frames, zero audio pops, and zero re-buffering lag.
  - The newly standby slot immediately pre-loads the next-next upcoming story in the background.
- **Concurrent 24h Multi-Story Support**:
  - Creators can have multiple active status stories simultaneously (1 to 5 stories generated over a 24-hour window).
  - Previous stories are not prematurely archived on incoming uploads (`UPDATE creator_stories SET is_active = FALSE WHERE expires_at <= NOW()`), allowing full 24h life per story.
- **Segmented Progress UI & Player Controls**:
  - Instagram / WhatsApp style multi-segmented progress bar at top of modal reflecting the total number of active stories for the creator.
  - Completed stories show 100% filled white bar; current story dynamically fills; upcoming stories remain empty.
  - Interactive: Tapping/clicking any bar segment jumps directly to that specific story.
- **Navigation & Gestures**:
  - **Debounced Tap Zones**: Left 35% navigates to previous story (or restarts current if > 2s played); Right 65% advances to next story (or closes modal if on the last story). Debounced by 300ms to eliminate mobile double-tap closures.
  - **Dual Chevrons**: Floating desktop chevrons and in-frame subtle chevrons provide clear visual targets on both desktop and touch screens.
  - **Hold to Pause**: Long pressing (> 200ms) pauses video playback and displays a pause indicator; releasing resumes playback.
  - **Desktop Controls**: Chevrons and keyboard shortcuts (`ArrowLeft`, `ArrowRight`, `Space`, `Escape`).
  - **Auto-Advance**: Video `onEnded` event automatically advances to `currentIndex + 1`.
- **Header & Layout**:
  - Song title and artist are placed directly beneath the creator's display name with music note icon and sequence indicator (`• X/Y`), replacing the previous generic "Status Story" tag.
  - Clean full-bleed video with the "status reel" tag removed from the bottom right corner.
- **Smart Resume**:
  - When opening a creator's stories, the player automatically resumes from the **first unviewed story** in the sequence rather than restarting from the beginning.
- **Avatar Ring Completion**:
  - A creator's avatar highlight ring turns gray for a user **only after ALL active stories in their 24h sequence have been viewed**. If any new or unviewed story remains, the colorful gradient persists.

---

## 9. Cohesive Elevated Dark Gray UI for Prompts & Comment Sheet
- **Palette & Borderless Presentation**:
  - All bottom sheets, action prompts, and modals (`CommentSectionModal`, `PostOptionsModal`, `LoginPromptModal`, `ReportModal`, `FullscreenPlayer` action sheet, and `SettingsView` sheets) use an elevated dark graphite gray (`#18181b`) background.
  - Harsh outline borders (`#2f3336`) are removed (`border: "none"`), relying on soft top shadows (`boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.85)"`) and subtle separators (`rgba(255, 255, 255, 0.08)`).
  - Secondary buttons, inputs, textareas, and pills use matched surface gray (`#27272a`).
- **Comment Footer Layout & Interactions**:
  - Below comment text: Dedicated flex row with **Date** and **Reply** at the extreme left, and **Like** (Heart icon + count) at the extreme right.
  - **Reply Action**: Pre-fills `@username ` into the comment composer input and automatically focuses the input field.
  - **Comment Likes**: Authenticated users can toggle comment likes via `POST /api/comments/:comment_id/like`. Unauthenticated visitors receive a login prompt (`promptLogin("like")`). Tracked in PostgreSQL table `comment_likes (user_id, comment_id)`.

---

## 10. TikTok-Style Stacked Comment Replies & Search Phrase Banner
- **Stacked Replies Hierarchy**:
  - Comments support a hierarchical parent-child structure via `comments.parent_id` (foreign key referencing parent comment).
  - Top-level comments sort chronologically descending (newest first); nested replies under each parent sort chronologically ascending (oldest first).
- **Reply Hide & Expand Feature**:
  - Nested replies are collapsed/hidden by default to maintain a clean reading experience.
  - An indicator row with an authentic TikTok horizontal line branch displays: `—— View X replies ∨`.
  - Tapping expands the replies with an indented guide line (`paddingLeft: "14px"`, `borderLeft: "1.5px solid rgba(255, 255, 255, 0.08)"`) and 28px avatars.
  - Both top and bottom toggles allow collapsing the thread: `—— Hide replies ∧`.
- **Display Name Rendering**:
  - Comment and reply headers render bold white display names (`p.display_name || p.username`) rather than `@username`.
  - Replying banner shows `Replying to {displayName} ✕`, and composer input automatically prefixes `@username ` for notification accuracy.
- **Top Search Phrase Generation & Placement**:
  - Dynamically extracts a concise 2–4 word TikTok-style topical query for each video using `generateSearchPhrase(video)` (derives from hashtags, caption NLP filtering, SEO descriptions, and category taxonomy).
  - Displayed prominently in a rounded pill directly beneath the drag handle and above the comment count header: `🔍 Search • [search phrase] >`.
  - Tapping closes the comment sheet and dispatches `openSearchModal` with the query pre-filled and search results immediately loaded.
---

## 11. Calm Black Canvas Theme & 3-Tier Visual Hierarchy
- **Base Canvas (`#09090b` / Zinc 950)**:
  - The website background color is configured as a calm black (`#09090b` / Zinc 950), offering a soothing, deep black appearance rather than harsh pitch black (`#000000`).
  - Applied globally via `:root` CSS variables (`--bg-color: #09090b`), `index.html` theme-color and background, bottom navigation, headers, modal containers, and profile views.
- **3-Tier Elevation Hierarchy**:
  1. **Base Layer Canvas**: `#09090b` (Calm Black / Zinc 950) for pages, feeds, grids, and primary window frames.
  2. **Elevated Modals & Sheets**: `#18181b` (Graphite Gray / Zinc 900) for `CommentSectionModal`, action prompts, and floating sheets.
  3. **Interactive Surfaces & Cards**: `#27272a` (Surface Gray / Zinc 800) for inputs, comment composer, buttons, and pills with hairline borders (`rgba(255, 255, 255, 0.08)`).
---

## 12. Smooth Tone Palette for Buttons & Accents (Anti-Glare & Blended Elements)
- **Follow & Light Action Buttons**:
  - Replaced glaring stark white (`#ffffff` with `#000000` text) with smooth Zinc 200 (`#e4e4e7` with `#09090b` text), eliminating high-contrast glare against the calm black canvas.
  - Unfollow / Following state uses subtle translucent surfaces (`rgba(255, 255, 255, 0.08)` with `#a1a1aa` and hairline `rgba(255, 255, 255, 0.12)` border).
  - Search subtabs and filter pills use smooth translucent zinc layers (`rgba(255, 255, 255, 0.14)` active, `rgba(255, 255, 255, 0.04)` inactive).
- **Subscribe & Brand Accents**:
  - Replaced hyper-saturated neon red (`#fe2c55` and `#ff3b30`) with a refined, smooth rose-crimson (`#e11d48` / `#f43f5e`).
  - Saturated glowing drop shadows reduced from `rgba(..., 0.4)` to subtle ambient shadows (`0 2px 12px rgba(225, 29, 72, 0.22-0.25)`).
  - Subscribed state uses soft rose tinted pill (`rgba(225, 29, 72, 0.14)` with `#f43f5e`).
  - Global `--primary-color` is `#e11d48` with glow `rgba(225, 29, 72, 0.25)`.
- **Bottom Navigation**:
  - Active bottom navigation tabs render in soft native Zinc white (`#f4f4f5`) with inactive tabs in muted `#71717a`, removing the jarring permanent red glow from the bottom of the screen.
- **Global Typography**:
  - Standard body text softened from stark `#ffffff` to smooth Zinc 100 (`#f4f4f5`), reducing eye fatigue.
---

## 13. Nested Overlay Navigation Stack & History Isolation
- **Hierarchical Stack Model**:
  - `Feed / Explore` -> `Search Modal` (`searchOpen: true`) -> `Creator Profile` (`creatorProfile: username`) -> `Story Player` (`storyPlayer: true`).
  - Closing any overlay pops directly to its immediate caller (Story closes -> returns to Creator Profile; Creator Profile closes -> returns to Search Modal with scroll position and search query preserved; Search Modal closes -> returns to Feed).
- **Overlay Flag Stripping**:
  - Pushing higher-level states (`handleOpenCreator`, `handleOpenDiscoverCreators`, `activeVideo`) explicitly strips child overlay flags (`searchOpen`, `storyPlayer`, `commentModal`) from `nextState`.
- **Defensive Popstate Guards**:
  - `AppHeader.jsx`'s `handleSearchPopState` and initializer guard against re-opening search when higher-level overlays are active (`if (state.searchOpen && !state.creatorProfile && !state.videoPlayer && !state.storyPlayer)`).
  - `Home.jsx` and `Explore.jsx` ignore category/query resets during popstate transitions when `state.creatorProfile || state.storyPlayer || state.videoPlayer || state.commentModal` are set.
---

## 14. Root-Level Portal & Modal Stacking Context Hierarchy
- **Stacking Context Isolation**:
  - `#root` is configured with `position: fixed` in `index.css`. Any overlay rendered inside `#root` is bounded by `#root`'s local stacking context.
  - Sibling overlays portaled directly to `document.body` (such as the Search modal at `zIndex: 1000100`) render on top of all elements inside `#root`.
- **Top-Tier Portal Hierarchy on `document.body`**:
  - `Search Modal` (`AppHeader.jsx`): Portaled to `document.body`, `zIndex: 1000100`.
  - `StoryPlayerModal` (`StoryPlayerModal.jsx`): Portaled to `document.body`, `zIndex: 1000200` (renders in front of Search modal when tapped from search results).
  - `LoginPromptModal` (`LoginPromptModal.jsx`): Portaled to `document.body`, `zIndex: 1000300`.
  - `AuthForm Modal` (`App.jsx`): Portaled to `document.body`, `zIndex: 1000350`.
- **Search Result Story Playback**:
  - When tapping a creator's `StoryAvatar` in the Search modal, the story plays directly in front of the Search modal.
  - On dismissal (swiping, tapping close, or completion), `StoryPlayerModal` unmounts and cleanly restores the user to the intact Search modal.

---

## 15. Universal Social Profiles, Followers/Following Lists & Email + Identity KYC Monetization Gate
- **Universal Instagram-Style Social Profiles**:
  - Both regular users and creators have full social profiles displaying `posts · followers · following · likes` stats, profile photo/banner uploads to Cloudflare R2 (`POST /api/creator/upload-image`), bio, website/location links, Story Highlights, and public video uploads (`POSTS` tab on `Profile.jsx` and `CreatorProfileModal.jsx`).
  - Regular users uploading public videos (`isVip = false`) publish to the community feed without automatically flipping `is_creator = TRUE`.
- **Interactive Followers & Following Full-Page Screen + Privacy Controls**:
  - Tapping `followers` or `following` on `Profile.jsx` or `CreatorProfileModal.jsx` opens `FollowListModal.jsx` as a full-page view (portaled to `document.body`, `zIndex: 1000250`) with an `ArrowLeft` top navigation bar, matching `CreatorProfileModal.jsx` and `SettingsView.jsx`.
  - Profile headers display a clean `followers · following · likes` stat line (redundant `posts` counter removed for reduced clutter).
  - Backed by `GET /api/creator/:username/followers`, `GET /api/creator/:username/following`, and `DELETE /api/creator/followers/:followerId` (for owners removing a follower).
  - `FollowListModal.jsx` layout:
    - Two-tier layout: Top row houses the display name/handle and right-aligned follow button; creator's bio flows freely across the full width directly beneath the button, clamped to max 2 lines with `-webkit-line-clamp: 2`.
    - Clutter-free: Generic "Creator" red badge removed.
    - Generous Twitter/X-style 36px pill buttons (`borderRadius: 9999px`):
      1. **"Follow back"** (`#f4f4f5` white matching the display name with `#09090b` text) if the account follows the viewer but the viewer is not following them.
      2. **"Follow"** (`#f4f4f5` white matching the display name with `#09090b` text) if neither follows the other.
      3. **"Following"** (translucent `#ffffff0f` with subtle border) if the viewer is following them.
    - Subtle `"Follows you"` tag displays next to the `@username` handle.
    - **Desktop 3-Pane Modular Sidebar Layout (`window.innerWidth > 1024`)**:
      - Left Pane: `DesktopLeftSidebar` navigation rail (`activeNav={isOwner ? "profile" : "creators"}`).
      - Middle Pane: Centered 680px list rail with sticky header (circular Back button + Display name and `@username` handle), sticky Followers/Following tabs pinned at `top: 53px`, search box, and full-length follow list.
      - Right Pane: `DesktopRightSidebar` (Highlights, Trends & Featured Creators) with creator click-through navigation.
      - Full keyboard accessibility: Pressing `Escape` closes the modal.
  - Users can toggle `private_profile` or `hide_follow_list` in `SettingsView.jsx` or `EditProfileModal.jsx` (persisted via `PATCH /api/auth/settings`). When enabled, visitors see a private lock state while the account owner retains full access to their own lists.
- **Sleek Instagram Story Player Enhancements**:
  - Tiny, sleek segmented progress bar (`height: 2px`, `gap: 3.5px`, `borderRadius: 2px`).
  - Transparent top-right Close (`✕`) button and transparent Volume/Mute button positioned in the lower-left corner with drop shadow.
  - Relative timestamp display (e.g., `• 2h ago` / `• Just now`) right after the track details, replacing the sequence index counter.
- **Email + Identity KYC Gate for Creator Monetization**:
  - Upgrading to Creator (`POST /api/creator/upgrade`), setting `subscription_price > 0`, or publishing `VIP Exclusive` (`premium`) videos requires completing a 3-step verification flow in `CreatorSetupModal.jsx`:
    1. **Email Verification**: 6-digit OTP code sent via Resend (`POST /api/auth/send-email-verification` & `POST /api/auth/verify-email-code`, stored in `email_verification_codes`) or Google OAuth verified email (`app_users.email_verified = TRUE`).
    2. **Identity KYC Verification (18+)**: Full legal name, 18+ date of birth, country, government ID type/number, ID front/back photos, and live selfie uploaded to Cloudflare R2 (`POST /api/creator/kyc/submit`, stored in `creator_kyc_requests` with `app_users.kyc_status = 'verified'`).
    3. **Creator Monetization Setup**: Stage name, category, bio, and monthly VIP subscription pricing.

---

## 16. Anti-Back-Button Hijacking & Non-Stacking Navigation Architecture
- **Defensive Ad Redirect Interceptor**:
  - Embedded in `index.html`: A global `window.open` shield catches attempts by ad syndication networks (`pemsrv`, `magsrv`, `adsco.re`, `effectivegatecpm`) targeting `_self` or `_top` and forces them into new background tabs (`_blank`).
  - `popMagic` in `index.html` is strictly configured with `"new_tab": true` and `"only_inline": true`. Its methods (`default` and `chromeTab`) never modify `top.document.location` or open `_self`, completely eliminating the 3-hop redirect chains that previously trapped users.
- **Smart Root Tab & Non-Stacking Category Navigation**:
  - Category switching on `Home.jsx` uses `window.history.replaceState` instead of `pushState`, updating the active category and URL without accumulating dummy back-button steps.
  - Bottom navigation tab switching (`handleTabSwitch` in `App.jsx`) treats `Home` as the root anchor:
    - Navigating from `Home` to secondary tabs (`Explore`, `Profile`, `Admin`) performs a `pushState` with `{ fromHome: true }`, ensuring that pressing the hardware/browser Back button returns cleanly to Home instead of exiting the site.
    - Returning to `Home` via bottom navigation pops the history stack back to the original Home root if `fromHome: true`, preventing duplicate Home entries.
    - Switching between secondary tabs (`Explore` <-> `Profile`) uses `replaceState` so secondary views do not build an endless history loop.
    - Pressing Back while on `Home` cleanly exits the web application as expected.
- **Single-Entry Fullscreen Player Navigation**:
  - The Fullscreen Player pushes a new history entry upon first opening from the feed, but uses `replaceState` when advancing to subsequent videos (swiping or clicking related clips), ensuring a single back tap cleanly closes the player and returns to the feed.

---

## 17. Dynamic Creator Personas & Bio-Driven Voice Synthesis
- **Structured Persona Schema**:
  - Each dynamic creator has a unique AI persona comprising:
    1. **Archetype**: Specific title/aesthetic (e.g. *Sensual Ghanaian Spa Queen*, *Petite Bratty Princess*, *Otaku E-Girl Baddie*, *Ghanaian Lingerie Enchantress*, *420 Gaming Glam Queen*, *Nairobi Moonlit Mysterious Muse*).
    2. **Voice & Tone**: Detailed description of how the creator talks, their pacing, intimacy, and attitude.
    3. **Emoji Palette**: A curated aesthetic set of 4–6 signature emojis fitting their specific vibe.
    4. **Personality & Style Rules**: Concrete instructions on sentence rhythm, quirks, boundaries, and themes.
    5. **Sample Hooks**: Authentic first-person teaser lines and hook templates.
- **Synthesis & Storage**:
  - Managed by `channel_forwarder/core/personas.py`.
  - Synthesized via Groq (`qwen/qwen3.8-27b`) or OpenRouter (`openai/gpt-4o-mini`) based on the creator's display name, handle, raw bio, and enhanced bio, with rich heuristic keyword-based fallbacks.
  - Stored persistently in `data/x_creator_profiles.json` under `entry["persona"]` and mirrored in `data/dynamic_api_forwarders.json`.
- **Dynamic Forwarder Transmission**:
  - `ApiForwarderTask` loads or dynamically resolves `creator_persona` and transmits both `creator_persona` and `creator_bio` to `https://engine.naijahomemade.com/api/creator-caption`.
- **Bio-Driven Ghostwriter Generation**:
  - `/api/creator-caption` in `twitter_engine/api.py` parses `creator_persona` and tailors the LLM system prompt specifically to the creator's defined archetype, personality rules, voice, and allowed emoji palette, ensuring post captions never sound generic or copycat across the platform.

---

## 18. In-Tab Google OAuth Redirect & 100% Ad Monetization Protection
- **No Popup Window Closure (`ux_mode: "redirect"`)**:
  - Google Identity Services is configured with `ux_mode: "redirect"` and `login_uri: "https://naijahomemade.com/api/auth/google/callback"`, complemented by in-page Google One Tap (FedCM) via `google.accounts.id.prompt()`.
  - The login flow executes within the exact same browser tab and returns via backend route `POST /api/auth/google/callback`, issuing a JWT session redirecting to `/?auth_token=...`.
  - Because no popup window is ever created or closed, Chrome's window manager never triggers a tab-switching fallback to adjacent background tabs.
- **Zero Programmatic Ad Closing (Monetization Integrity)**:
  - Background ad windows (ExoClick popunders and Smartlinks) are **never programmatically closed** by the application scripts.
  - Allowing ad tabs to remain open naturally guarantees 100% impression dwell time, full tracking pixel delivery, CPA/CPI conversion opportunities, and protects advertiser quality scores and network eCPMs against artificial bounce penalties.

---

## 19. Multi-Platform Creator Harvester & Telegram Ingestion (`-1004384000976`)
- **Universal Target Extraction**:
  - `extract_creator_targets_from_text` extracts targets across Telegram, X, Instagram, and TikTok.
  - Supports Telegram channel IDs (`-100\d{9,13}` or prefixed positive), invite links (`https://t.me/+...`, `https://t.me/joinchat/...`), private post links (`https://t.me/c/<cid>/...`), and public channels (`https://t.me/<username>`).
- **Combined Social + Telegram Channel Binding**:
  - Messages containing both a social media link/handle and a Telegram channel ID/link automatically bind the specified Telegram channel to that creator, bypassing new channel creation and directly linking the channel to the creator's API forwarder and scraper.
- **Standalone Telegram Channel Automation**:
  - Standalone Telegram channel IDs or invite links are resolved via `resolve_telegram_channel_entity`.
  - Automatically fetches title, bio/about, and avatar photo, derives a clean handle, generates an authentic AI creator persona, promotes bot admin, and dynamically activates `ApiForwarderTask` (`enable_twitter_scraper = False`).
- **Oldest-First Chronological Harvesting**:
  - `XProfileHarvesterTask` scans from the oldest post forward (`min_id=last_id, limit=None, reverse=True`).
  - Pre-fetches existing bot replies via `replied_to_ids` to suppress duplicate `ℹ️ Creator Already Active!` replies during historical scans, while guaranteeing all unhandled messages receive processing and receipts.
  - Replies in Telegram prominently display both the Telegram Channel ID (`channel_id`) and private invite link (`invite_link`).

---

## 20. Universal AI Refusal Detection & Multi-Pipeline Output Sanitization (Bios, Personas, Highlight Titles & Captions)
- **Zero AI Refusal Leakage Guarantee**:
  - LLMs (OpenAI, Groq, OpenRouter, Qwen, Gemini, Llama) occasionally refuse or inject safety disclaimers when generating adult-oriented content (e.g., *"I cannot fulfill this request...", "As an AI language model...", "I cannot assist with sexually explicit requests..."*).
  - All text generation pipelines across the entire ecosystem enforce strict refusal detection (`is_ai_refusal` / `isAiRefusal`) and specialized sanitizers (`sanitize_ai_caption`, `sanitize_ai_bio`, `clean_title_str`, `clean_json_response`).
- **Creator Bio & Telegram Channel Description Pipeline**:
  - `enhance_bio_with_ai` in `engines/channel_forwarder/tasks/creator_pipeline.py`:
    - Evaluates Groq and OpenRouter raw outputs with `sanitize_ai_bio()`.
    - Strips conversational preambles (*"Here is a catchy Telegram bio: ..."*), options (*"Option 1:"*), trailing notes, disclaimers, character count annotations, quotes, and hashtags.
    - If rejected by `is_ai_refusal()`, discards the output and triggers `get_clean_bio_fallback()` to supply a safe, seductive, authentic creator bio.
  - Web Backend (`video-app/backend/`):
    - `sanitizer.js` exports uniform `isAiRefusal`, `sanitizeAiBio`, and `getCleanBioFallback`.
    - Profile update (`PATCH /api/creator/profile`) and Creator upgrade (`POST /api/creator/upgrade`) in `creator.js` reject or replace AI refusal bios with clean fallbacks.
    - Telegram creator channel synchronization (`telegramCreatorSync.js` and `server.js`) verifies `!isAiRefusal(rawBio)` before saving Telegram chat descriptions into `app_users.creator_bio`.
- **Creator Persona Synthesis Pipeline**:
  - `clean_json_response` and `generate_creator_persona_async` in `engines/channel_forwarder/core/personas.py`:
    - Evaluates raw LLM response and parsed JSON fields (`archetype`, `voice_and_tone`, `style_rules`, `sample_hooks`).
    - If `archetype` or `voice_and_tone` contains an AI refusal, the entire response is discarded and safely falls back to `get_fallback_persona()`.
    - Filters individual `sample_hooks` to guarantee no refusal text leaks into ghostwritten creator post captions.
- **Story Highlight Titles Pipeline**:
  - `clean_title_str` and `generate_highlight_title_async` in `engines/channel_forwarder/core/highlight_ai.py`:
    - Validates candidate highlight titles against `is_ai_refusal()`. If a candidate title is a refusal or policy rejection, it is rejected and safely falls back to `get_fallback_highlight_title()`.
- **Content Category Classification**:
  - `classify_content_category` in `engines/twitter_engine/api.py`:
    - Checks `is_ai_refusal(raw_result)` to ensure refusal messages are not misinterpreted or accidentally routed to an invalid category.

---

## 21. Master Email Template Architecture & Authentic Platform Branding
- **No Background Color Canvas**:
  - Eliminates harsh dark blocks in email inboxes; bodies render natively on clean transparent/white canvas (`background-color: #ffffff`) avoiding dark-mode inversion bugs across Gmail, Apple Mail, Outlook, and Yahoo.
- **Authentic Brand Header**:
  - Features the official app icon (`https://naijahomemade.com/logo-120.png`, 38x38px, 9px rounded corners) alongside the wordmark: bold black `Naija` (`#09090b`) + signature rose-crimson `homemade` (`#e11d48`), linked directly to `https://naijahomemade.com`.
  - Separated from the body by a subtle hairline divider (`border-bottom: 1px solid #f0f0f2`).
- **High-Aesthetic Verification OTP Code & Action Badges**:
  - 6-digit OTP verification codes render in an elevated light slate box (`#f8fafc`, `border: 1px solid #e2e8f0`, `border-radius: 12px`, padding 22px) with spaced monospace crimson digits (`font-size: 34px`, `font-weight: 800`, `letter-spacing: 9px`, `#e11d48`).
  - Action buttons render in premium solid black pill shape (`#09090b`, `border-radius: 9999px`, padding 13px 30px, white bold text).
- **Comprehensive Professional Footer**:
  - Includes quick navigation links: `Home` • `Explore` • `VIP Club` • `Terms` • `Privacy`.
  - Explicit compliance and audit disclaimer indicating why the email was sent, along with support contact (`support@naijahomemade.com`) and copyright line (`© {Year} NaijaHomemade. All rights reserved.`).
- **Unified Implementation**:
  - `video-app/backend/emails/emailTemplate.js`: Master HTML email builder (`buildEmailHtml`, `buildVerificationOtpEmail`, `buildWelcomeEmail`).
  - `video-app/backend/emails/WelcomeEmail.jsx`: Matched React Email component using `@react-email/components`.
  - `video-app/backend/auth.js`: Powers `/send-email-verification` and `/register` flows.

---

## 22. Universal Email Verification Security Gate Architecture
- **Strict Verification Enforcement (`requireEmailVerified`)**:
  - Unverified accounts cannot perform core interactive or high-value actions on the platform.
  - Protected Actions & Endpoints:
    1. **Watch Creator Stories**: `GET /api/creator/:username/story` and profile active story streams (`GET /api/creator/:username`). Gated in `StoryContext.jsx` and `StoryPlayerModal.jsx`.
    2. **Post Comments & Nested Replies**: `POST /api/comments`. Gated in `CommentSectionModal.jsx`.
    3. **Like Videos & Like Comments**: `POST /api/interactions/like` and `POST /api/comments/:comment_id/like`. Gated in `FullscreenPlayer.jsx` and `CommentSectionModal.jsx`.
    4. **Bookmark / Save Videos**: `POST /api/interactions/save`. Gated in `FullscreenPlayer.jsx`.
    5. **Follow Creators**: `POST /api/creator/:username/follow`. Gated in `FullscreenPlayer.jsx`, `CreatorProfileModal.jsx`, and `FollowListModal.jsx`.
    6. **VIP Subscriptions, Creator Tips & Payments**: `POST /api/creator/:username/subscribe`, `POST /api/crypto/create`, and `POST /api/verify-payment`. Gated in `CreatorProfileModal.jsx`, `CreatorSubscribeModal.jsx`, `CreatorTipModal.jsx`, and `PaywallModal.jsx`.
    7. **Video Downloads & Moderation Reports**: `GET /api/videos/:id/download` and `POST /api/reports`. Gated in `PostOptionsModal.jsx` and `ReportModal.jsx`.
- **Seamless Contextual OTP Modal Prompts**:
  - Unverified users attempting any of the above actions receive a tailored `EmailVerificationModal` prompt with custom icons, headers, and descriptions (e.g. *"Verify to Watch Stories"*, *"Verify to Comment"*, *"Verify to Like"*, *"Verify for VIP & Payments"*, *"Verify to Follow"*).
  - Verifying the 6-digit OTP code immediately synchronizes global user state via `refreshUser` and grants full access without requiring page reloads.
- **Admin & Managed Account Exemption**:
  - Admins (`role === 'admin'`), verified creators (`is_verified = true`), and managed creators (`is_managed = true`) automatically bypass verification checks.

---

## 23. Deterministic Dynamic Initial Gradient Avatars (Telegram & TikTok Model)
- **Elimination of Static Fallbacks**:
  - Replaced the harsh red "NA" graphic with organic, deterministic vector SVG initial avatars modeled after Telegram and TikTok.
- **Deterministic Color Hashing & Gradients**:
  - Maps any user identifier (display name, username, or ID) through a stable polynomial hash into 10 balanced gradient pairs:
    1. Sunset Coral (`#FF5E62` → `#FF9966`)
    2. Neon Violet (`#8A2387` → `#E94057`)
    3. Electric Blue (`#2563EB` → `#60A5FA`)
    4. Emerald Mint (`#059669` → `#34D399`)
    5. Vibrant Amber (`#D97706` → `#FBBF24`)
    6. Royal Violet (`#7C3AED` → `#A78BFA`)
    7. Aqua Cyan (`#0891B2` → `#22D3EE`)
    8. Rose Crimson (`#E11D48` → `#FB7185`)
    9. Indigo Dusk (`#4F46E5` → `#818CF8`)
    10. Warm Tangerine (`#EA580C` → `#FB923C`)
- **Unicode Grapheme & Initial Extraction**:
  - Extracts the first alphanumeric letter/digit or Unicode emoji across international scripts, rendering a bold, centered letterform or neutral silhouette fallback.
- **Dual-Tier Generation & Streaming**:
  - **Frontend Client Generator (`frontend/src/utils/avatar.js`)**: Generates zero-latency vector SVGs encoded as Data URIs (`data:image/svg+xml;charset=utf-8,...`).
  - **Backend Fallback Endpoint (`/avatar.jpg` and `/api/avatar`)**: Streams high-performance vector SVGs with `Content-Type: image/svg+xml; charset=utf-8` and 24-hour Edge caching for accounts without custom photos.
- **Smart Custom Avatar Resolution**:
  - `isCustomAvatar` identifies real uploaded photos, R2 URLs, Telegram channel proxy URLs, and Google photos, while filtering out default placeholders and SVG data URIs.
  - Multi-identifier resolution in `server.js` verifies `id`, `telegram_user_id`, `source_channel`, and `username` (stripping leading `@`), ensuring channel-backed creators and web users resolve accurately.

---

## 24. Profile Photo Auto-Persistence & Google OAuth Overwrite Protection
- **Immediate Upload Persistence (`POST /api/creator/upload-image`)**:
  - When a user uploads a new avatar via `/api/creator/upload-image`, the backend immediately persists the R2 URL to `app_users.avatar_url` in the database and returns the updated user record.
  - `EditProfileModal.jsx` immediately synchronizes global user state (`onUpdateSuccess(updatedUser, false)`) and displays a success toast (`"Profile photo updated!"`). The user is not required to manually scroll down and submit the entire profile form to retain their photo.
- **Google OAuth Conflict Guard (`backend/auth.js`)**:
  - In `processGoogleIdToken`, the PostgreSQL upsert (`ON CONFLICT (email) DO UPDATE`) strictly preserves the user's custom photo using a conditional `CASE` expression:
    ```sql
    SET avatar_url = CASE 
          WHEN app_users.avatar_url IS NOT NULL 
           AND app_users.avatar_url != '' 
           AND app_users.avatar_url NOT LIKE '%default-avatar%'
          THEN app_users.avatar_url
          ELSE COALESCE(EXCLUDED.avatar_url, app_users.avatar_url)
        END
    ```
  - Prevents subsequent Google OAuth sign-ins from wiping out custom user photos with the account's Google profile picture.
- **Parallel Bio Avatar Pre-Loading**:
  - In `CreatorProfileModal.jsx` and `Profile.jsx`, bio avatars construct candidate endpoints (`/avatar.jpg?username=...` or `/avatar.jpg?user_id=...`) while data fetches are in flight, loading the user's photo in parallel with zero initial SVG placeholder flicker.

---

## 25. Same-Origin Avatar Delivery, Direct R2 Streaming & Edge Cache Elimination
- **Same-Origin Delivery Architecture (`GET /avatars/:filename`)**:
  - Avatars uploaded to Cloudflare R2 are served directly from the same-origin domain `https://naijahomemade.com/avatars/*` via Node.js instead of cross-origin subdomains (`bucket.naijahomemade.com`).
  - Completely eliminates Cloudflare WAF Hotlink Protection 403 blocks (`"Sorry, you have been blocked"`) triggered by browsers with stripped or absent `Referer` headers (such as iOS Safari Private Browsing, Chrome Incognito, PWAs, and mobile webviews).
  - Node.js fetches the avatar directly from R2 using `@aws-sdk/client-s3` (`GetObjectCommand`), caches the buffer in memory, and returns the raw image with `Content-Type: image/jpeg` and `Cache-Control: public, max-age=604800, s-maxage=2592000, immutable`.
- **Direct R2 Buffer Streaming in `/avatar.jpg` & `/api/avatar`**:
  - When a user has a custom uploaded avatar in `app_users.avatar_url`, `/avatar.jpg` and `/api/avatar` directly stream the image buffer with 200 OK instead of issuing a 302 redirect.
  - Eliminates stale Cloudflare Edge redirect caching where old 302 redirects to Google OAuth avatars (`lh3.googleusercontent.com`) persisted for 7 days (`s-maxage=604800`).
  - For external avatars (e.g. Google OAuth), redirect caching is capped at a conservative 5 minutes (`s-maxage=300`) unless explicitly versioned (`?v=`).
- **Centralized Avatar Invalidation Layer (`backend/avatarCache.js`)**:
  - `avatarUrlCache` and `avatarBufferCache` are maintained in a dedicated module (`backend/avatarCache.js`) to avoid circular imports.
  - On avatar upload (`POST /api/creator/upload-image`) and profile update (`PATCH /api/creator/profile`), `purgeAvatarCache([userId, username, sourceChannel, telegramUserId])` immediately evicts in-memory buffer and URL cache entries across all aliases.
- **Universal `avatar_url` Selection Across All Feed & Video Queries**:
  - All video catalog endpoints in `backend/server.js` (`GET /api/videos` for algorithm/random, trends, category, and suggestions, `/api/group`, `/api/search`, liked videos, and saved videos) explicitly select `COALESCE(au.avatar_url, '') as avatar_url`.
  - In `backend/creator.js`, creator profile endpoints (`GET /api/creator/:username` and `GET /api/creator/:username/videos`) explicitly include `avatar_url` in `mappedVideos`.
  - `mapVideoToResponse` passes `avatar_url: cleanAvatarUrl` directly to the client. Components (`FeedPost.jsx`, `VideoCard.jsx`, `FullscreenPlayer.jsx`) receive the exact photo URL directly in the payload, eliminating fallback roundtrips to `/avatar.jpg?user_id=...`.
- **Frontend Normalization & Cross-Origin Security**:
  - `normalizeAvatarUrl` in `frontend/src/utils/avatar.js` automatically maps any legacy `bucket.naijahomemade.com/avatars/` URLs to `https://naijahomemade.com/avatars/`.
  - `StoryAvatar.jsx`, `EditProfileModal.jsx`, `VideoCard.jsx`, `AppHeader.jsx`, `DesktopLeftSidebar.jsx`, `FollowListModal.jsx`, and `CommentSectionModal.jsx` declare `crossOrigin="anonymous"` and `referrerPolicy="no-referrer-when-downgrade"` on avatar images.






