import { useState } from 'react';
import { FiX, FiDownload, FiFileText, FiEye, FiPaperclip } from 'react-icons/fi';
import { PRIMARY } from './TaskDesignTokens';

export default function TaskFileViewer({ doc, onClose }) {
  if (!doc) return null;
  const mime = doc.mimetype || '';
  const url = doc.url;
  const name = doc.originalName || doc.filename || 'Document';
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%', maxWidth: '900px', maxHeight: '92vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: `1px solid #E0E0E0`, flexShrink: 0 }}>
          <FiPaperclip style={{ width: '16px', height: '16px', color: PRIMARY, flexShrink: 0 }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#333333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
          <a href={url} download={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 500, color: '#555555', border: `1px solid #E0E0E0`, borderRadius: 0, textDecoration: 'none', transition: 'background-color 0.2s' }}>
            <FiDownload style={{ width: '14px', height: '14px' }} /> Download
          </a>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9E9E9E', transition: 'background-color 0.2s' }}>
            <FiX style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#F7F9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          {isImage ? (
            <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : isPdf ? (
            <iframe src={url} title={name} style={{ width: '100%', height: '100%', border: 'none', minHeight: '70vh' }} />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ width: '64px', height: '64px', backgroundColor: '#E6F4F9', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FiFileText style={{ width: '32px', height: '32px', color: PRIMARY }} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#555555', marginBottom: '8px' }}>{name}</p>
              <p style={{ fontSize: '12px', color: '#9E9E9E', marginBottom: '20px' }}>This file type cannot be previewed in the browser.</p>
              <a href={url} download={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: PRIMARY, color: '#FFFFFF', fontSize: '14px', fontWeight: 600, borderRadius: 0, textDecoration: 'none', transition: 'background-color 0.2s' }}>
                <FiDownload style={{ width: '16px', height: '16px' }} /> Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
