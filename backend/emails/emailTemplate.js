/* ============================================================================
   NaijaHomemade Master Email Template Builder
   Authentic, professional HTML email format with NO dark background,
   official app branding & logo, responsive typography, and compliance footer.
============================================================================ */

const BRAND_NAME_PREFIX = "Naija";
const BRAND_NAME_SUFFIX = "homemade";
const BRAND_COLOR = "#e11d48"; // Smooth rose-crimson from platform palette
const BRAND_LOGO_URL = "https://naijahomemade.com/logo-120.png";
const SITE_URL = "https://naijahomemade.com";
const SUPPORT_EMAIL = "support@naijahomemade.com";

/**
 * Universal wrapper for all NaijaHomemade HTML emails.
 * Uses clean, email-safe table layouts with transparent/white background.
 */
export function buildEmailHtml({
  title = "Notification from NaijaHomemade",
  previewText = "",
  recipientName = "",
  heading = "",
  contentHtml = "",
  code = null,
  codeSubtext = "This code will expire in 15 minutes. Do not share it with anyone.",
  ctaText = null,
  ctaUrl = null,
  footerReason = "You received this email because an action was requested for your account on NaijaHomemade."
}) {
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  ${previewText ? `<div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff; opacity: 0;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; -webkit-font-smoothing: antialiased; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #ffffff; width: 100%; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 24px 16px 40px 16px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; margin: 0 auto; text-align: left;">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="padding: 12px 0 24px 0; border-bottom: 1px solid #f0f0f2;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <a href="${SITE_URL}" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="${BRAND_LOGO_URL}" width="38" height="38" alt="NaijaHomemade" style="display: block; border-radius: 9px; border: 0; outline: none; width: 38px; height: 38px;" />
                    </a>
                  </td>
                  <td style="vertical-align: middle;">
                    <a href="${SITE_URL}" target="_blank" style="text-decoration: none; font-size: 21px; font-weight: 800; letter-spacing: -0.4px; color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ${BRAND_NAME_PREFIX}<span style="color: ${BRAND_COLOR};">${BRAND_NAME_SUFFIX}</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CONTENT -->
          <tr>
            <td style="padding: 32px 0 24px 0;">
              ${heading ? `<h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #09090b; letter-spacing: -0.3px; line-height: 1.3;">${heading}</h1>` : ""}
              ${recipientName ? `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #3f3f46;">Hi <strong>${recipientName}</strong>,</p>` : ""}
              
              <div style="font-size: 15px; line-height: 1.6; color: #3f3f46;">
                ${contentHtml}
              </div>

              <!-- VERIFICATION CODE BADGE (IF PROVIDED) -->
              ${code ? `
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 26px 0 22px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px 16px;">
                    <div style="font-size: 34px; font-weight: 800; letter-spacing: 9px; color: ${BRAND_COLOR}; font-family: 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace; line-height: 1; padding-left: 9px;">
                      ${code}
                    </div>
                    ${codeSubtext ? `<p style="margin: 10px 0 0 0; font-size: 12px; font-weight: 500; color: #64748b; line-height: 1.4;">${codeSubtext}</p>` : ""}
                  </td>
                </tr>
              </table>
              ` : ""}

              <!-- CTA BUTTON (IF PROVIDED) -->
              ${ctaText && ctaUrl ? `
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 24px 0;">
                <tr>
                  <td align="left">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; background-color: #09090b; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 13px 30px; border-radius: 9999px; letter-spacing: -0.2px; text-align: center;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ""}
            </td>
          </tr>

          <!-- PROFESSIONAL FOOTER -->
          <tr>
            <td style="padding: 24px 0 0 0; border-top: 1px solid #f0f0f2;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <!-- NAV LINKS ROW -->
                <tr>
                  <td style="padding-bottom: 14px;">
                    <a href="${SITE_URL}" style="color: #71717a; font-size: 12px; text-decoration: none; font-weight: 600; margin-right: 14px;">Home</a>
                    <span style="color: #d4d4d8; font-size: 12px; margin-right: 14px;">•</span>
                    <a href="${SITE_URL}/?tab=explore" style="color: #71717a; font-size: 12px; text-decoration: none; font-weight: 600; margin-right: 14px;">Explore</a>
                    <span style="color: #d4d4d8; font-size: 12px; margin-right: 14px;">•</span>
                    <a href="${SITE_URL}/?cat=premium" style="color: #71717a; font-size: 12px; text-decoration: none; font-weight: 600; margin-right: 14px;">VIP Club</a>
                    <span style="color: #d4d4d8; font-size: 12px; margin-right: 14px;">•</span>
                    <a href="${SITE_URL}/terms" style="color: #71717a; font-size: 12px; text-decoration: none; font-weight: 600; margin-right: 14px;">Terms</a>
                    <span style="color: #d4d4d8; font-size: 12px; margin-right: 14px;">•</span>
                    <a href="${SITE_URL}/privacy" style="color: #71717a; font-size: 12px; text-decoration: none; font-weight: 600;">Privacy</a>
                  </td>
                </tr>

                <!-- DISCLAIMER & COMPLIANCE -->
                <tr>
                  <td style="font-size: 12px; line-height: 1.5; color: #71717a; padding-bottom: 8px;">
                    ${footerReason}
                  </td>
                </tr>

                <tr>
                  <td style="font-size: 12px; line-height: 1.5; color: #a1a1aa; padding-bottom: 12px;">
                    Questions or need assistance? Reach our team anytime at <a href="mailto:${SUPPORT_EMAIL}" style="color: #71717a; text-decoration: underline;">${SUPPORT_EMAIL}</a>.
                  </td>
                </tr>

                <!-- COPYRIGHT -->
                <tr>
                  <td style="font-size: 11px; color: #a1a1aa; line-height: 1.4;">
                    © ${currentYear} NaijaHomemade. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates the 6-digit OTP verification email for email verification and KYC.
 */
export function buildVerificationOtpEmail({ recipientName = "Creator", code, expiresMinutes = 15 }) {
  return buildEmailHtml({
    title: `${code} is your NaijaHomemade verification code`,
    previewText: `${code} is your verification code. Valid for ${expiresMinutes} minutes.`,
    recipientName: recipientName,
    heading: "Verify Your Email Address",
    contentHtml: `<p style="margin: 0 0 16px 0;">Use the 6-digit verification code below to confirm your email address and unlock creator privileges, direct downloads, and community actions on NaijaHomemade:</p>`,
    code: code,
    codeSubtext: `This verification code is valid for ${expiresMinutes} minutes. If you did not request this, you can safely ignore this email.`,
    footerReason: "You received this email because an email verification request was submitted for your account on NaijaHomemade."
  });
}

/**
 * Generates the welcome email for new community members.
 */
export function buildWelcomeEmail({ username = "Member", exploreUrl = "https://naijahomemade.com" }) {
  return buildEmailHtml({
    title: "Welcome to NaijaHomemade! 🎉",
    previewText: `Welcome to NaijaHomemade, ${username}! Explore trending drops, follow creators, and save favorites.`,
    recipientName: username,
    heading: "Welcome to NaijaHomemade! 🚀",
    contentHtml: `
      <p style="margin: 0 0 16px 0;">Your account has been successfully created. You're now ready to experience the fastest-growing platform of authentic African creators and exclusive homemade content.</p>
      <p style="margin: 0 0 16px 0;">Here is what you can do right away:</p>
      <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #3f3f46; font-size: 15px; line-height: 1.6;">
        <li style="margin-bottom: 8px;"><strong>Explore Fresh Drops:</strong> Stream high-quality full length content updated daily.</li>
        <li style="margin-bottom: 8px;"><strong>Follow Top Creators:</strong> Keep up with your favorite models and community creators.</li>
        <li style="margin-bottom: 8px;"><strong>Unlock VIP Exclusives:</strong> Subscribe for VIP club content and direct creator perks.</li>
      </ul>
      <p style="margin: 0 0 8px 0;">Ready to dive in? Tap the button below to start watching:</p>
    `,
    ctaText: "Start Exploring Now",
    ctaUrl: exploreUrl,
    footerReason: "You received this email because you recently created an account on NaijaHomemade."
  });
}
