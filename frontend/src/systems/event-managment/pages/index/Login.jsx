import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* 10s total cycle — visible only in the first half, hidden the second half */
const slideUp = keyframes`
  0%   { transform: translateY(60px);  opacity: 0; }
  8%   { transform: translateY(0);     opacity: 1; }
  42%  { transform: translateY(0);     opacity: 1; }
  50%  { transform: translateY(-60px); opacity: 0; }
  100% { transform: translateY(-60px); opacity: 0; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ── Page shell ─────────────────────────────────────────── */
const PageWrapper = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
`;

/* ── Full-screen background photo ───────────────────────── */
const BgPhoto = styled.div`
  position: fixed;
  inset: 0;
  background: url("/cok_hall.jpg") center center / cover no-repeat;
  z-index: 0;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 10, 30, 0.58);
  z-index: 1;
`;

/* ── Main content centred over image ─────────────────────── */
const Main = styled.div`
  flex: 1;
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px 24px;
  gap: 28px;
`;

/* ── Header: logo + animated title ──────────────────────── */
const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  animation: ${fadeIn} 0.8s ease forwards;
`;

const CokLogo = styled.img`
  width: 100px;
  height: auto;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.5));
`;

const MarqueeBox = styled.div`
  position: relative;
  height: 48px;
  overflow: hidden;
  width: 420px;
  text-align: center;

  @media (max-width: 480px) {
    width: 280px;
  }
`;

const MarqueeText = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  font-size: 1.65rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.7);
  animation: ${slideUp} 10s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay}s;
  transform: translateY(60px);
  opacity: 0;
`;

/* ── Login card ─────────────────────────────────────────── */
const Card = styled.div`
  width: 100%;
  max-width: 500px;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 16px;
  padding: 56px 40px 52px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
  animation: ${fadeIn} 0.9s ease 0.15s forwards;
  opacity: 0;

  @media (max-width: 480px) {
    padding: 32px 24px 28px;
  }
`;

const CardTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a2b4a;
  margin: 0 0 4px;
`;

const CardSubtitle = styled.p`
  font-size: 0.85rem;
  color: #6b7a90;
  margin: 0 0 28px;
`;

const Label = styled.label`
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const Input = styled.input`
  width: 100%;
  padding: 11px 14px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #1a2b4a;
  background: #f9fafb;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  box-sizing: border-box;

  &:focus {
    border-color: #0055a5;
    background: #fff;
  }
`;

const FieldGroup = styled.div`
  margin-bottom: 18px;
`;

const LoginButton = styled.button`
  width: 100%;
  padding: 12px;
  background: #0055a5;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 6px;
  transition: background 0.2s, transform 0.1s;
  letter-spacing: 0.02em;

  &:hover { background: #003f80; }
  &:active { transform: scale(0.98); }
`;

/* ── Footer ─────────────────────────────────────────────── */
const Footer = styled.footer`
  position: relative;
  z-index: 2;
  background: rgba(0, 10, 30, 0.75);
  backdrop-filter: blur(6px);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.78rem;
  padding: 14px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 14px 24px;
  }
`;

const FooterLeft = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FooterLogo = styled.img`
  width: 24px;
  height: auto;
  opacity: 0.8;
`;

const FooterLinks = styled.div`
  display: flex;
  gap: 18px;

  a {
    color: rgba(255, 255, 255, 0.5);
    text-decoration: none;
    transition: color 0.15s;
    &:hover { color: #fff; }
  }
`;

/* delay = index × half-cycle (5s) so each phrase occupies its own 5s slot */
const phrases = ["City of Kigali", "Meetings and Events Management"];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    navigate("/dashboard");
  }

  return (
    <PageWrapper>
      <BgPhoto />
      <Overlay />

      <Main>
        <Header>
          <CokLogo src="/LOGO_COK.png" alt="City of Kigali" />
          <MarqueeBox>
            {phrases.map((phrase, i) => (
              <MarqueeText key={phrase} $delay={i * 5}>
                {phrase}
              </MarqueeText>
            ))}
          </MarqueeBox>
        </Header>

        <Card>
          <CardTitle>Welcome back</CardTitle>
          <CardSubtitle>Sign in to your account to continue</CardSubtitle>

          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@kigalicity.gov.rw"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </FieldGroup>

            <LoginButton type="submit">Sign In</LoginButton>
          </form>
        </Card>
      </Main>

      <Footer>
        <FooterLeft>
          <FooterLogo src="/LOGO_COK.png" alt="CoK" />
          © {new Date().getFullYear()} City of Kigali. All rights reserved.
        </FooterLeft>
        <FooterLinks>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Use</a>
          <a href="#">Support</a>
        </FooterLinks>
        <span>Kigali City Events &amp; Management System</span>
      </Footer>
    </PageWrapper>
  );
}
