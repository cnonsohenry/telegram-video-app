import React from 'react';
import { 
  Html, 
  Head, 
  Body, 
  Container, 
  Text, 
  Button, 
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

export default function WelcomeEmail({ username = "Member" }) {
  const currentYear = new Date().getFullYear();

  return (
    <Html>
      <Head />
      <Preview>Welcome to NaijaHomemade, {username}! Explore trending drops and creators.</Preview>
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
              Welcome to NaijaHomemade! 🚀
            </Text>

            <Text style={bodyText}>
              Hi <strong>{username}</strong>,
            </Text>

            <Text style={bodyText}>
              Your account has been successfully created. You're now ready to experience the fastest-growing platform of authentic African creators and exclusive homemade content.
            </Text>

            <Text style={{ ...bodyText, marginBottom: '8px' }}>
              Here is what you can do right away:
            </Text>

            <table role="presentation" border="0" cellPadding="0" cellSpacing="0" style={{ width: '100%', marginBottom: '20px' }}>
              <tr>
                <td style={{ padding: '4px 0', verticalAlign: 'top', color: '#3f3f46', fontSize: '15px', lineHeight: '24px' }}>
                  • <strong>Explore Fresh Drops:</strong> Stream high-quality full length content updated daily.
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', verticalAlign: 'top', color: '#3f3f46', fontSize: '15px', lineHeight: '24px' }}>
                  • <strong>Follow Top Creators:</strong> Keep up with your favorite models and community creators.
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', verticalAlign: 'top', color: '#3f3f46', fontSize: '15px', lineHeight: '24px' }}>
                  • <strong>Unlock VIP Exclusives:</strong> Subscribe for VIP club content and direct creator perks.
                </td>
              </tr>
            </table>

            <Text style={{ ...bodyText, marginBottom: '24px' }}>
              Ready to dive in? Tap below to start exploring:
            </Text>

            {/* CTA BUTTON */}
            <Section style={{ textAlign: 'left', marginBottom: '28px' }}>
              <Button 
                href={SITE_URL}
                style={ctaButton}
              >
                Start Exploring Now
              </Button>
            </Section>
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
              You received this email because you recently created an account on NaijaHomemade.
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

// 🖌 STYLES (Clean aesthetic, no background color wrapper)
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

const ctaButton = {
  backgroundColor: '#09090b',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '700',
  textDecoration: 'none',
  padding: '13px 30px',
  borderRadius: '9999px',
  letterSpacing: '-0.2px',
  display: 'inline-block'
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
