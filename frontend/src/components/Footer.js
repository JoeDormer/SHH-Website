// src/components/Footer.js
import React from 'react';

export default function Footer() {
  return (
    <footer style={{ padding: '1rem', background: '#eee' }}>
      © {new Date().getFullYear()}
    </footer>
  );
}