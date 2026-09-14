import React, { useEffect } from 'react';
import { forceLogout, UI_FORBIDDEN_MESSAGE } from '../services/accessControl';

const LOGOUT_DELAY_MS = 2500;

const ForbiddenResourceScreen: React.FC<{ message?: string }> = ({ message }) => {
  const text = message || UI_FORBIDDEN_MESSAGE;

  useEffect(() => {
    const timer = window.setTimeout(() => forceLogout(text), LOGOUT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F7F9FB' }}>
      <div className="w-full max-w-lg bg-white border-2 p-8 text-center" style={{ borderColor: '#E74C3C' }}>
        <p className="text-lg font-bold" style={{ color: '#E74C3C', fontFamily: "'Montserrat', sans-serif" }}>
          {text}
        </p>
        <p className="mt-3 text-sm" style={{ color: '#555555', fontFamily: "'Montserrat', sans-serif" }}>
          You are being signed out. Login again with an account that has access to this system.
        </p>
      </div>
    </div>
  );
};

export default ForbiddenResourceScreen;
