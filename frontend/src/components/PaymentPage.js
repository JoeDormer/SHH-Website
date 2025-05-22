// src/components/PaymentPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import Header from './Header';
import Footer from './Footer';
import styles from '../css/PaymentPage.module.css';

const API = process.env.REACT_APP_API_BASE_URL;

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm({ clientSecret, unitAmount, currency, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState('');
  const [processing, setProcessing]     = useState(false);

  const handleChange = e => setErrorMessage(e.error?.message || '');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setErrorMessage('');

    const card = elements.getElement(CardNumberElement);
    const { error, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      { payment_method: { card } }
    );

    if (error) {
      setErrorMessage(error.message);
      setProcessing(false);
    } else if (paymentIntent.status === 'succeeded') {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Card Number</label>
        <div className={styles.cardInput}>
          <CardNumberElement onChange={handleChange}/>
        </div>
      </div>

      <div className={styles.fieldGroupRow}>
        <div className={styles.fieldGroupSmall}>
          <label className={styles.label}>Expiry</label>
          <div className={styles.cardInput}>
            <CardExpiryElement onChange={handleChange}/>
          </div>
        </div>
        <div className={styles.fieldGroupSmall}>
          <label className={styles.label}>CVC</label>
          <div className={styles.cardInput}>
            <CardCvcElement onChange={handleChange}/>
          </div>
        </div>
      </div>

      {errorMessage && <p className={styles.cardError}>{errorMessage}</p>}

      <button
        type="submit"
        disabled={!stripe || processing}
        className={styles.payButton}
      >
        {processing
          ? 'Processing…'
          : `Pay £${(unitAmount/100).toFixed(2)} ${currency.toUpperCase()}`}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const reference      = searchParams.get('reference');

  // get booking and form data from sessionStorage
  const booking = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('booking'));
    } catch {
      return null;
    }
  }, []);

  const [clientSecret, setClientSecret] = useState('');
  const [productName, setProductName]   = useState('');
  const [unitAmount, setUnitAmount]     = useState(0);
  const [currency, setCurrency]         = useState('');
  const [paid, setPaid]                 = useState(false);

  useEffect(() => {
    if (!reference || !booking) return;

    // send booking & form data to backend so metadata is correct
    fetch(`${API}/api/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference,
        form: {
          firstName: booking.firstName,
          surname:   booking.surname,
          phone:     booking.phone,
          email:     booking.email,
          address:   booking.address,
          postcode:  booking.postcode
        },
        selectedDate: booking.visitDate,
        selectedTime: booking.visitWindow
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setClientSecret(data.clientSecret);
        setProductName(data.productName);
        setUnitAmount(data.unitAmount);
        setCurrency(data.currency);
      })
      .catch(err => console.error(err));
  }, [reference, booking]);

  // called when PaymentIntent succeeds
  const handleSuccess = () => setPaid(true);

  return (
    <>
      <Header title="Complete Your Payment" />

      <main className={styles.wrapper}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          ← Back to Booking
        </button>

        {!booking && (
          <p className={styles.errorText}>
            Missing booking data. Please start again.
          </p>
        )}

        {/* Booking summary */}
        {booking && (
          <div className={styles.summary}>
            <h3>Booking Summary</h3>
            <p><strong>Reference:</strong> {booking.reference}</p>
            <p><strong>Name:</strong> {booking.firstName} {booking.surname}</p>
            <p><strong>Email:</strong> {booking.email}</p>
            <p><strong>Phone:</strong> {booking.phone}</p>
            <p>
              <strong>Address:</strong> {booking.address}, {booking.postcode}
            </p>
            <p>
              <strong>Date &amp; Time:</strong> {booking.visitDate},{' '}
              {booking.visitWindow}
            </p>
            <hr />
          </div>
        )}

        {/* After payment */}
        {paid && booking && (
          <div className={styles.thankYou}>
            <h2>Thank you!</h2>
            <p>
              A confirmation is being sent to <strong>{booking.email}</strong>.
            </p>
            <p>
              Your reference is <strong>{booking.reference}</strong>.
            </p>
          </div>
        )}

        {/* Payment form */}
        {!paid && clientSecret && (
          <>
            <h2 className={styles.productTitle}>{productName}</h2>
            <p className={styles.productPrice}>
              £{(unitAmount/100).toFixed(2)} {currency.toUpperCase()}
            </p>
            <Elements stripe={stripePromise}>
              <CheckoutForm
                clientSecret={clientSecret}
                unitAmount={unitAmount}
                currency={currency}
                onSuccess={handleSuccess}
              />
            </Elements>
          </>
        )}

        {!paid && !clientSecret && (
          <p>Loading payment details…</p>
        )}
      </main>

      <Footer />
    </>
  );
}
