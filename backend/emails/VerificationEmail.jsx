import React from 'react';
import { 
  Html, 
  Head, 
  Body, 
  Container, 
  Text, 
  Preview, 
  Section, 
  Img, 
  Link, 
  Hr 
} from '@react-email/components';

const BRAND_NAME_PREFIX = "Naija";
const BRAND_NAME_SUFFIX = "homemade";
const BRAND_COLOR = "#e11d48";
const BRAND_LOGO_URL = "https://naijahomemade.com/logo-120.png";
const SITE_URL = "https://naijahomemade.com";
const SUPPORT_EMAIL = "support@naijahomemade.com";

export default function VerificationEmail({ 
  recipientName = "Creator", 
  code = "000000", 
  expiresMinutes = 15 
}) {
  const currentYear = new Date().getFullYear();

  return (
    <Html>
      <Head />
      <Preview>Your NaijaHomemade verification code is {code}</Preview>
      <Body style={mainBody}>
        <Container style={container}>
          
          {/* BRAND HEADER */}
          <Section style={headerSection}>
            <table role="presentation" border="0" cellPadding="0" cellSpacing="0">
              <tr>
                <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                  <Link href={SITE_URL}>
                    <Img 
                      src={BRAND_LOGO_URL} 
                      width="38" 
                      height="38" 
                      alt="NaijaHomemade" 
                      style={logoImg} 
                    />
                  </Link>
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <Link href={SITE_URL} style={brandText}>
                    {BRAND_NAME_PREFIX}<span style={{ color: BRAND_COLOR }}>{BRAND_NAME_SUFFIX}</span>
                  </Link>
                </td>
              </tr>
            </table>
          </Section>

          <Hr style={divider} />

          {/* MAIN CONTENT */}
          <Section style={contentSection}>
            <Text style={headingText}>
              Verify Your Email Address
            </Text>

            <Text style={bodyText}>
              Hi <strong>{recipientName}</strong>,
            </Text>

            <Text style={bodyText}>
              Use the 6-digit verification code below to confirm your email address and unlock your creator privileges, status stories, and downloads on NaijaHomemade:
            </Text>

            {/* OTP CODE BADGE */}
            <Section style={codeBoxSection}>
              <div style={codeBox}>
                <Text style={codeText}>
                  {code}
                </Text>
                <Text style={codeSubtext}>
                  This code expires in {expiresMinutes} minutes. Do not share it with anyone.
                </Text>
              </div>
            </Section>

            <Text style={{ ...bodyText, fontSize: '13.5px', color: '#71717a', marginTop: '16px' }}>
              If you did not request this verification code, please ignore this email or reach out to our team if you have questions.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* PROFESSIONAL FOOTER */}
          <Section style={footerSection}>
            <table role="presentation" border="0" cellPadding="0" cellSpacing="0" style={{ marginBottom: '14px' }}>
              <tr>
                <td>
                  <Link href={SITE_URL} style={footerLink}>Home</Link>
                  <span style={bulletSeparator}>•</span>
                  <Link href={`${SITE_URL}/?tab=explore`} style={footerLink}>Explore</Link>
                  <span style={bulletSeparator}>•</span>
                  <Link href={`${SITE_URL}/?cat=premium`} style={footerLink}>VIP Club</Link>
                  <span style={bulletSeparator}>•</span>
                  <Link href={`${SITE_URL}/terms`} style={footerLink}>Terms</Link>
                  <span style={bulletSeparator}>•</span>
                  <Link href={`${SITE_URL}/privacy`} style={footerLink}>Privacy</Link>
                </td>
              </tr>
            </table>

            <Text style={footerDisclaimer}>
              You received this email because an email verification request was submitted for your account on NaijaHomemade.
            </Text>

            <Text style={footerDisclaimer}>
              Questions or need assistance? Reach our team anytime at{' '}
              <Link href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#71717a', textDecoration: 'underline' }}>
                {SUPPORT_EMAIL}
              </Link>.
            </Text>

            <Text style={footerCopyright}>
              © {currentYear} NaijaHomemade. All rights reserved.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// 🖌 STYLES
const mainBody = {
  backgroundColor: '#ffffff',
  margin: '0',
  padding: '0',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: '#18181b'
};

const container = {
  margin: '0 auto',
  padding: '24px 16px 40px 16px',
  maxWidth: '560px'
};

const headerSection = {
  padding: '12px 0 16px 0'
};

const logoImg = {
  borderRadius: '9px',
  display: 'block',
  width: '38px',
  height: '38px'
};

const brandText = {
  fontSize: '21px',
  fontWeight: '800',
  letterSpacing: '-0.4px',
  color: '#09090b',
  textDecoration: 'none'
};

const divider = {
  borderColor: '#f0f0f2',
  margin: '0'
};

const contentSection = {
  padding: '28px 0 20px 0'
};

const headingText = {
  fontSize: '22px',
  fontWeight: '700',
  color: '#09090b',
  letterSpacing: '-0.3px',
  margin: '0 0 16px 0',
  lineHeight: '1.3'
};

const bodyText = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#3f3f46',
  margin: '0 0 16px 0'
};

const codeBoxSection = {
  margin: '24px 0 16px 0',
  textAlign: 'center'
};

const codeBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '24px 16px',
  textAlign: 'center'
};

const codeText = {
  fontSize: '36px',
  fontWeight: '800',
  letterSpacing: '8px',
  color: '#e11d48',
  fontFamily: "'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  margin: '0',
  lineHeight: '1',
  paddingLeft: '8px'
};

const codeSubtext = {
  fontSize: '12px',
  fontWeight: '500',
  color: '#64748b',
  margin: '12px 0 0 0',
  lineHeight: '1.4'
};

const footerSection = {
  padding: '24px 0 0 0'
};

const footerLink = {
  color: '#71717a',
  fontSize: '12px',
  textDecoration: 'none',
  fontWeight: '600'
};

const bulletSeparator = {
  color: '#d4d4d8',
  fontSize: '12px',
  margin: '0 10px'
};

const footerDisclaimer = {
  fontSize: '12px',
  lineHeight: '18px',
  color: '#71717a',
  margin: '0 0 8px 0'
};

const footerCopyright = {
  fontSize: '11px',
  color: '#a1a1aa',
  margin: '8px 0 0 0'
};
