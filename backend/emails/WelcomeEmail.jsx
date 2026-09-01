import React from 'react';
import { Html, Head, Body, Container, Text, Button, Preview, Section } from '@react-email/components';

export default function WelcomeEmail({ username = "Member" }) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to NaijaHomemade! 🎉</Preview>
      <Body style={{ backgroundColor: '#111111', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ margin: '0 auto', padding: '40px 20px', maxWidth: '600px' }}>
          <Text style={{ color: '#ffffff', fontSize: '24px', fontWeight: 'bold' }}>
            Welcome, {username}!
          </Text>
          
          <Text style={{ color: '#8e8e8e', fontSize: '16px', lineHeight: '24px' }}>
            Your account has been successfully created. You can now explore unlimited trending homemade videos, interact with the community, and save your favorites.
          </Text>
          
          <Section style={{ textAlign: 'center', marginTop: '30px', marginBottom: '30px' }}>
            <Button 
              href="https://videos.naijahomemade.com"
              style={{ backgroundColor: '#ff3b30', color: '#ffffff', padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', textDecoration: 'none' }}
            >
              Start Watching Now
            </Button>
          </Section>
          
          <Text style={{ color: '#555555', fontSize: '14px' }}>
            Cheers,<br />The NaijaHomemade Team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}