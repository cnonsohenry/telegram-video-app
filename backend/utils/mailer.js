import { Resend } from "resend";
import { render } from "@react-email/render";
import "dotenv/config";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendReactEmail = async (to, subject, ReactComponent) => {
  try {
    // Convert the React component to an HTML string
    const htmlContent = await render(ReactComponent);

    const { data, error } = await resend.emails.send({
      from: "NaijaHomemade <noreply@notify.naijahomemade.com>",
      to: [to],
      subject: subject,
      html: htmlContent,
    });

    if (error) throw new Error(error.message);
    
    console.log(`✉️ React Email sent to ${to} [ID: ${data.id}]`);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error(`❌ Email Failed:`, err.message);
    return { success: false, error: err.message };
  }
};