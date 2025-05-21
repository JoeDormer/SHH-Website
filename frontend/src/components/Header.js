// src/components/Header.js
import React from 'react';

export default function Header({ title }) {
  return (
    <header style={{ padding: '1rem', background: '#eee' }}>
      <h1>{title}</h1>
    </header>
  );
}