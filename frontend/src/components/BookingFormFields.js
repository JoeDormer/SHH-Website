// src/components/BookingFormFields.js
import React from 'react';
import styles from '../css/BookingFormFields.module.css';

function formatLabel(key) {
  const withSpaces = key.replace(/([A-Z])/g, ' $1');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

export default function BookingFormFields({
  form,
  onChange,
  errors = {},
  dates = [],            // ← default empty array
  times = [],            // ← default empty array
  selectedDate = '',     // ← default empty string
  selectedTime = '',     // ← default empty string
  onDateChange = () => {},   // ← no-op
  onTimeChange = () => {}    // ← no-op
}) {
  return (
    <div>
      {['firstName','surname','phone','email','address','postcode'].map(name => (
        <div key={name} className={styles.fieldGroup}>
          <label htmlFor={name} className={styles.label}>
            {formatLabel(name)}
          </label>
          <input
            id={name}
            className={`${styles.input} ${errors[name] ? styles.inputError : ''}`}
            type={name === 'email' ? 'email' : 'text'}
            name={name}
            value={form[name]}
            onChange={onChange}
          />
          {errors[name] && (
            <span className={styles.errorMessage}>
              {errors[name]}
            </span>
          )}
        </div>
      ))}

      {dates.length > 0 && (
        <div className={styles.fieldGroup}>
          <label htmlFor="date" className={styles.label}>Date:</label>
          <select
            id="date"
            className={styles.input}
            value={selectedDate}
            onChange={onDateChange}
          >
            <option value="">--Select Date--</option>
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {times.length > 0 && (
        <div className={styles.fieldGroup}>
          <label htmlFor="time" className={styles.label}>Time:</label>
          <select
            id="time"
            className={styles.input}
            value={selectedTime}
            onChange={onTimeChange}
          >
            <option value="">--Select Time--</option>
            {times.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
