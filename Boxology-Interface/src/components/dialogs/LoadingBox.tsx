import React from 'react';

export default function LoadingBox({ message }: { message?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, minWidth: 260, maxWidth: 400
    }}>
      <div style={{
        width: 32, height: 32, border: '4px solid #E8F9FF', borderTop: '4px solid #632187ff',
        borderRadius: '50%', animation: 'spin 1s linear infinite'
      }} />
      <span style={{ marginTop: 12, color: '#372187ff', fontWeight: 600, textAlign: 'center', whiteSpace: 'pre-line' }}>
        {message || 'Loading...'}
      </span>
      <style>
        {`@keyframes spin { 100% { transform: rotate(360deg); } }`}
      </style>
    </div>
  );
}