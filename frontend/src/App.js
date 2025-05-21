import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './components/Home';
import BookingForm from './components/BookingFormLayout';
import PaymentPage from './components/PaymentPage';



export default function App() {
  return (
    <div style={{ padding: '2rem' }}>
      <nav>
        <Link to="/">Home</Link> | <Link to="/booking">Booking</Link>
      </nav>
      <hr />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/booking" element={<BookingForm />} />
<Route path="/payment" element={<PaymentPage />} />
      </Routes>
    </div>
  );
}
