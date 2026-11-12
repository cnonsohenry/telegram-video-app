import { Resend } from "resend";
import { render } from "@react-email/render";
import "dotenv/config";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = "NaijaHomemade <noreply@notify.naijahomemade.com>";
const REPLY_TO_ADDRESS = "NaijaHomemade Support <support@naijahomemade.com>";

export const sendReactEmail = async (to, subject, ReactComponent, options = {}) => {
  try {
    // Generate both HTML and Plain Text multipart/alternative representations
    const htmlContent = await render(ReactComponent);
    const textContent = await render(ReactComponent, { plainText: true });

    const payload = {
      from: FROM_ADDRESS,
      to: [to],
      reply_to: REPLY_TO_ADDRESS,
      subject: subject,
      html: htmlContent,
      text: textContent,
      headers: {
        "X-Entity-Ref-ID": `nh-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        "X-Auto-Response-Suppress": "OOF, AutoReply"
      },
      ...options
    };

    const { data, error } = await resend.emails.send(payload);

    if (error) throw new Error(error.message);
    
    console.log(`✉️ React Email sent to ${to} [ID: ${data.id}]`);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error(`❌ Email Failed:`, err.message);
    return { success: false, error: err.message };
  }
};

export const sendHtmlEmail = async (to, subject, htmlContent, plainTextContent = "") => {
  try {
    // Generate clean text fallback if not provided to satisfy Yahoo Mail & Gmail spam filters
    const textFallback = plainTextContent || htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const payload = {
      from: FROM_ADDRESS,
      to: [to],
      reply_to: REPLY_TO_ADDRESS,
      subject: subject,
      html: htmlContent,
      text: textFallback,
      headers: {
        "X-Entity-Ref-ID": `nh-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        "X-Auto-Response-Suppress": "OOF, AutoReply"
      }
    };

    const { data, error } = await resend.emails.send(payload);

    if (error) throw new Error(error.message);

    console.log(`✉️ HTML Email sent to ${to} [ID: ${data.id}]`);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error(`❌ HTML Email Failed:`, err.message);
    return { success: false, error: err.message };
  }
};
