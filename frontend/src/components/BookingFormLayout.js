// src/components/BookingFormLayout.js
import React, { Suspense, lazy, useState, useEffect } from 'react';
import Header from './Header';
import Footer from './Footer';
import styles from '../css/BookingFormLayout.module.css';

const BookingFormFields = lazy(() => import('./BookingFormFields'));

export default function BookingFormLayout() {
  const params = new URLSearchParams(window.location.search);
  const today = new Date();
  const sevenDays = new Date(today);
  sevenDays.setDate(today.getDate() + 7);

  // On mount: remove UTM query parameters from the URL
  useEffect(() => {
    if (window.location.search) {
      const cleanPath = window.location.pathname;
      window.history.replaceState({}, '', cleanPath);
    }
  }, []);

  // form values seeded from UTM params
  const [form, setForm] = useState({
    firstName: params.get('utm_firstName') || '',
    surname:   params.get('utm_surname')   || '',
    phone:     params.get('utm_phone')     || '',
    email:     params.get('utm_email')     || '',
    address:   params.get('utm_address')   || '',
    postcode:  params.get('utm_postcode')  || ''
  });

  // slot-fetching state
  const [slots, setSlots]                 = useState([]);
  const [dates, setDates]                 = useState([]);
  const [times, setTimes]                 = useState([]);
  const [selectedDate, setSelectedDate]   = useState('');
  const [selectedTime, setSelectedTime]   = useState('');

  // UI state
  const [loading, setLoading]             = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError]                 = useState(null);
  const [bookingError, setBookingError]   = useState(null);
  const [errors, setErrors]               = useState({});
  const [showSlots, setShowSlots]         = useState(false);
  const [noSlots, setNoSlots]             = useState(false);

  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const { firstName, surname, phone, email, address, postcode } = form;
    const newErrors = {};
    if (!firstName.trim()) newErrors.firstName = 'First Name is required';
    if (!surname.trim())   newErrors.surname   = 'Surname is required';
    if (!address.trim())   newErrors.address   = 'Address is required';

    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(email))
      newErrors.email = 'Enter a valid email address';

    const digits = phone.replace(/\D/g, '');
    if (!digits) newErrors.phone = 'Phone is required';
    else if (digits.length < 7)
      newErrors.phone = 'Phone must be at least 7 digits';

    if (!postcode.trim()) newErrors.postcode = 'Postcode is required';
    else if (postcode.trim().length < 6)
      newErrors.postcode = 'Postcode must be at least 6 characters';

    return newErrors;
  };

  const fetchSlots = async () => {
    setLoading(true);
    setError(null);
    setNoSlots(false);

    const clientId  = process.env.REACT_APP_CLIENT_ID;
    const clientRef = `MHS-${Date.now()}`;
    if (!clientId) {
      setError('Error: REACT_APP_CLIENT_ID not set.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/available-slots`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            clientId,
            clientRef,
            visitType:    'Service',
            postcode:     form.postcode,
            earliestDate: formatDate(today),
            latestDate:   formatDate(sevenDays)
          })
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { slots: fetched = [] } = await res.json();

      setSlots(fetched);
      const uniqDates = Array.from(new Set(fetched.map(s => s.visitDate)));
      setDates(uniqDates);
      setSelectedDate('');
      setTimes([]);
      setSelectedTime('');
      if (uniqDates.length === 0) setNoSlots(true);
      setShowSlots(true);
    } catch (e) {
      setError(e.message);
      setShowSlots(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedDate) return;
    const available = slots
      .filter(s => s.visitDate === selectedDate)
      .map(s => `${s.windowStart}–${s.windowEnd}`);
    setTimes(available);
    setSelectedTime('');
  }, [selectedDate, slots]);

  const handleGetDates = () => {
    const errs = validateForm();
    if (Object.keys(errs).length) {
      setErrors(errs);
    } else {
      setErrors({});
      fetchSlots();
    }
  };

  const handleBook = async () => {
    setBookingLoading(true);
    setBookingError(null);

    const clientId  = process.env.REACT_APP_CLIENT_ID;
    const clientRef = `MHS-${Date.now()}`;
    const [windowStart, windowEnd] = selectedTime.split('–');

    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/book-slot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            clientReference: clientRef,
            visitType: 'Service',
            postcode: form.postcode,
            visitDate: selectedDate,
            visitWindowStart: windowStart,
            visitWindowEnd: windowEnd,
            bookingTimeoutPeriod: 500
          })
        }
      );

      // parse JSON even on error
      const payload = await res.json();
      if (!res.ok) {
        console.error('Booking error payload:', payload);
        throw new Error(payload.message || payload.error || JSON.stringify(payload));
      }

      // success: stash booking in sessionStorage
      const bookingData = {
        reference:       payload.reference,
        ...form,
        visitDate:       selectedDate,
        visitWindow:     selectedTime
      };
      sessionStorage.setItem('booking', JSON.stringify(bookingData));

      // redirect to payment page
      window.location.href = `/payment?reference=${payload.reference}`;
    } catch (e) {
      setBookingError(e.message);
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <>
      <Header title="SHH Booking" />

      {loading && (
        <div className={styles.loadingOverlay}>n          <div className={styles.loadingPopup}>
            Loading available dates…
          </div>
        </div>
      )}

      {/* Input form */}
      {!showSlots && (
        <div className={styles.formCard}>
          <Suspense fallback={<p>Loading form…</p>}>
            <BookingFormFields
              form={form}
              onChange={handleChange}
              errors={errors}
            />
          </Suspense>
          {error && <p className={styles.errorText}>{error}</p>}
          <button
            className={styles.submitButton}
            onClick={handleGetDates}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Get Available Dates'}
          </button>
        </div>
      )}

      {/* Results / slot selection */}
      {showSlots && (
        <div className={styles.resultsCard}>
          {noSlots ? (
            <p className={styles.noSlotsText}>
              No available slots found. Please check your postcode and try again, or contact us on XXXXXXXXX.
            </p>
          ) : (
            <>n              <h2>Select Date &amp; Time</h2>
              <div className={styles.fieldGroup}>
                <label htmlFor="date" className={styles.label}>Date:</label>
                <select
                  id="date"
                  className={styles.input}
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                >
                  <option value="">--Select Date--</option>
                  {dates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {times.length > 0 && (
                <div className={styles.fieldGroup}>
                  <label htmlFor="time" className={styles.label}>Time:</label>
                  <select
                    id="time"
                    className={styles.input}
                    value={selectedTime}
                    onChange={e => setSelectedTime(e.target.value)}
                  >
                    <option value="">--Select Time--</option>
                    {times.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}


              {selectedDate && selectedTime && (
                <p className={styles.confirmText}>
                  You selected: {selectedDate}, {selectedTime}
                </p>
              )}
            </>
          )}

          {bookingError && (
            <p className={styles.errorText}>{bookingError}</p>
          )}
          <div className={styles.actionsRow}>
            <button
              className={styles.backButton}
              onClick={() => setShowSlots(false)}
            >
              Back
            </button>
            {!noSlots && selectedDate && selectedTime && (
              <button
                className={styles.bookButton}
                onClick={handleBook}
                disabled={bookingLoading}
              >
                {bookingLoading ? 'Booking…' : 'Book & Pay'}
              </button>
            )}
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
