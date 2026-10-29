/**
 * AI refusal detection and sanitization utilities for captions, bios, and creator metadata.
 */

export const REFUSAL_PHRASES = [
  "cannot fulfill this request",
  "can't fulfill this request",
  "unable to fulfill this request",
  "unable to fulfill your request",
  "cannot fulfill your request",
  "can't fulfill your request",
  "cannot generate content",
  "can't generate content",
  "unable to generate content",
  "cannot assist with this request",
  "can't assist with this request",
  "unable to assist with this request",
  "cannot create content that",
  "can't create content that",
  "unable to create content that",
  "cannot write content that",
  "can't write content that",
  "i must decline this request",
  "i must decline",
  "i have to decline",
  "safety guidelines",
  "safety policy",
  "safety policies",
  "content policy",
  "content policies",
  "content guidelines",
  "usage policy",
  "usage guidelines",
  "community guidelines",
  "community standards",
  "ethical guidelines",
  "terms of service",
  "sexually explicit",
  "adult content",
  "nsfw content",
  "as an ai",
  "as a language model",
  "as an artificial intelligence",
  "i am an ai",
  "i'm an ai",
  "my programming",
  "violates my policy",
  "violates our policy",
  "violates the policy",
  "against my policy",
  "against our policy",
  "against the policy",
  "against my guidelines",
  "against our guidelines",
  "against the guidelines",
  "i am programmed to follow",
  "i'm programmed to follow",
  "i am not permitted to",
  "i'm not permitted to",
  "i am not allowed to",
  "i'm not allowed to",
  "cannot comply with",
  "can't comply with",
  "cannot help with that",
  "can't help with that",
  "unable to assist with that",
  "cannot fulfill requests",
  "can't fulfill requests",
  "unable to fulfill requests",
  "cannot write captions for adult",
  "cannot generate captions for adult",
  "cannot write a bio",
  "can't write a bio",
  "cannot generate a bio",
  "can't generate a bio",
  "cannot create a bio",
  "can't create a bio",
  "cannot write bios",
  "cannot generate bios",
  "cannot provide a bio",
  "cannot write a description",
  "can't write a description",
  "cannot generate titles",
  "cannot write titles",
  "cannot create personas",
  "cannot generate personas",
  "cannot assist with sexually explicit",
  "cannot generate sexually explicit",
  "cannot assist with explicit",
  "cannot generate explicit",
  "cannot promote or describe",
  "non-consensual sexual material",
  "unauthorized leaks",
  "sextapes, or unauthorized",
  "not appropriate for me to generate",
  "not comfortable generating",
  "i cannot assist",
  "i can't assist",
  "i am unable to assist",
  "i'm unable to assist",
  "i cannot generate",
  "i can't generate",
  "i am unable to generate",
  "i'm unable to generate",
  "i cannot create",
  "i can't create",
  "i am unable to create",
  "i'm unable to create",
  "responsible ai",
  "openai's content policy",
  "anthropic's acceptable use",
  "ai safety guidelines"
];

export const CLEAN_BIO_FALLBACKS = [
  "Official private VIP channel for {name}. Daily exclusive drops & raw unfiltered previews 🤍",
  "Welcome to the official private space of {name}. Intimate moments & daily exclusive updates ✨",
  "Official private channel for {name}. Exclusive content, bedroom drops & VIP vibes 🔥",
  "Unfiltered heat & exclusive drops straight from {name}. Tap in for daily updates 💎",
  "Official VIP hub for {name}. Exclusive videos, behind-the-scenes & daily homemade heat 👀"
];

/**
 * Detects whether text is an AI model refusal, safety policy rejection, or conversational filler.
 * @param {string} text
 * @returns {boolean}
 */
export function isAiRefusal(text) {
  if (!text || typeof text !== "string") return false;
  const lower = text.trim().toLowerCase();
  if (!lower) return false;

  // 1. Exact phrase substring checks
  for (const phrase of REFUSAL_PHRASES) {
    if (lower.includes(phrase)) return true;
  }

  // 2. Inability to generate / assist / write / fulfill / craft / enhance
  const refusalActionRegex = /(?:i\s+(?:can(?:not|'t)|am\s+unable\s+to|must\s+decline)|unable\s+to)\s+(?:fulfill|generate|create|write|assist|provide|comply|produce|process|help\s+with|craft|draft|enhance|describe|promote)/i;
  if (refusalActionRegex.test(lower)) return true;

  // 3. Apology + inability
  const apologyRefusalRegex = /(?:sorr(?:y|ies)|apolog(?:y|ize|ies))\b.*?\b(?:can(?:not|'t)|unable\s+to|not\s+allowed|not\s+permitted|cannot\s+assist)/i;
  if (apologyRefusalRegex.test(lower)) return true;

  // 4. Policy / guidelines preventing action
  const policyRegex = /(?:polic(?:y|ies)|guidelines?)\s+(?:prevents?|prohibits?|restricts?|forbids?|does\s+not\s+allow)/i;
  if (policyRegex.test(lower)) return true;

  // 5. Policy violation phrases
  const violationRegex = /(?:violate|against)\s+(?:our|my|the)?\s*(?:safety|content|usage|community)?\s*(?:policies|policy|guidelines|standards|terms)/i;
  if (violationRegex.test(lower)) return true;

  // 6. AI self-identification in refusal context
  const aiSelfRegex = /\b(?:as\s+an\s+ai|as\s+a\s+language\s+model|as\s+an\s+artificial\s+intelligence|as\s+an\s+assistant)\b/i;
  if (aiSelfRegex.test(lower)) return true;

  // 7. Content classification in refusal context
  const adultRefusalRegex = /\b(?:cannot|unable\s+to|won't)\b.*?\b(?:adult|nsfw|sexually\s+explicit|pornograph(?:y|ic)|erotic|leaks?|sextapes?)\b/i;
  if (adultRefusalRegex.test(lower)) return true;

  if (/\b(?:sexually\s+explicit|pornograph(?:y|ic)|not\s+safe\s+for\s+work)\b/i.test(lower)) return true;

  return false;
}

/**
 * Returns a clean, attractive channel bio fallback when AI fails or refuses.
 * @param {string} creatorName
 * @param {string} [rawBio]
 * @returns {string}
 */
export function getCleanBioFallback(creatorName, rawBio = "") {
  const cleanName = (creatorName || "Creator").trim();
  if (rawBio && typeof rawBio === "string") {
    const trimmed = rawBio.trim();
    if (!isAiRefusal(trimmed)) {
      const cleanRaw = trimmed.replace(/^[#\-*•\s]+/, "").replace(/[ \t]+/g, " ");
      if (cleanRaw.length >= 10) {
        const candidate = `Official private channel for ${cleanName}. ${cleanRaw}`;
        return candidate.length <= 245 ? candidate : candidate.slice(0, 240).trim() + "...";
      }
    }
  }
  const template = CLEAN_BIO_FALLBACKS[Math.floor(Math.random() * CLEAN_BIO_FALLBACKS.length)];
  return template.replace("{name}", cleanName).slice(0, 245);
}

/**
 * Sanitizes an AI-generated bio or channel description.
 * Strips preambles, options, markdown, notes, and verifies zero AI refusals.
 * @param {string} text
 * @param {string} [creatorName]
 * @returns {string}
 */
export function sanitizeAiBio(text, creatorName = "") {
  if (!text || typeof text !== "string") return "";
  let cleaned = text.trim();

  if (isAiRefusal(cleaned)) return "";

  // 1. Remove markdown code blocks
  cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();

  // 2. Remove conversational intro preambles
  cleaned = cleaned.replace(
    /^(?:here['’]?s an? (?:catchy|revised|suggested|new|clean|short|alluring)?\s*(?:telegram\s*)?(?:channel\s*)?(?:bio|description)[^\n]*:\s*|here (?:is|are)[^\n]*:\s*|sure[!,.]?\s*(?:here['’]?s[^\n]*:\s*)?|(?:bio|channel\s*description|description|suggested\s*bio|telegram\s*bio)\s*:\s*)/i,
    ""
  ).trim();

  // 3. Truncate multiple options
  const optionSplit = cleaned.split(/\n+\s*(?:option\s*[2-9b-z]|2\.|b\.|alternative\s*\d*|\(choose\s+option|choose\s+option|\bor\b\s*\n+["“'])/i);
  if (optionSplit && optionSplit.length > 1) {
    cleaned = optionSplit[0].trim();
  }

  // 4. Strip Option 1 prefix
  cleaned = cleaned.replace(/^(?:option\s*[1a][:.\-]?|1\.|a\.)\s*/i, "").trim();

  // 5. Remove trailing notes, disclaimer, character count commentary
  cleaned = cleaned.replace(/\n+\s*(?:\*+\s*)?(?:creator\s+note|note|nb|ps|p\.s\.|tips?|explanation|disclaimer|character\s*count|chars?)\s*:[\s\S]*$/i, "").trim();
  cleaned = cleaned.replace(/\n+\s*[\(\[]?\s*(?:under\s*\d+|\d+)\s*(?:chars?|characters?)[^\)\n\]]*[\)\]]?\s*$/i, "").trim();

  // 6. Remove parenthetical notes and character counts
  cleaned = cleaned.replace(/[\(\[]\s*(?:(?:under\s*\d+|\d+)\s*(?:chars?|characters?)|note|assuming|choose|tip|explanation|rationale)[\s\S]*?[\)\]]/gi, "").trim();

  // 7. Strip wrapping quotation marks and backticks
  cleaned = cleaned.replace(/^["'“”‘`]+/, "").replace(/["'“”’`]+$/, "").trim();

  // 8. Strip hashtags
  cleaned = cleaned.replace(/#\w+/g, "").trim();

  // 9. Normalize spaces and linebreaks
  cleaned = cleaned.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

  // 10. Secondary refusal check
  if (isAiRefusal(cleaned)) return "";

  // 11. Length limit (255 max for Telegram channel about)
  if (cleaned.length > 255) {
    let truncated = cleaned.slice(0, 248);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 180) {
      truncated = truncated.slice(0, lastSpace);
    }
    cleaned = truncated.trim() + "...";
  }

  return cleaned;
}
