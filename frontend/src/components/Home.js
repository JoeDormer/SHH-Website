// src/components/Home.js
import React from 'react';
import Header from './Header';
import Footer from './Footer';

export default function Home() {
  return (
    <>
      {/* Your site‐wide header */}
      <Header title="SHH Booking" />

      {/* Page‐specific content */}
      <main style={{ padding: '2rem' }}>
        <h1>Welcome to SHH Booking!</h1>
        <p>Click “Book now” in the menu to make an appointment.</p>
      </main>

      {/* Your site‐wide footer */}
      <Footer />
    </>
  );
}
