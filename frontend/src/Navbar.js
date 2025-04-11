// Navbar.js
import React from 'react';

export default function Navbar({
  landingCount,
  alienCount,
  onStart,
  onDelete,
  log,
  showLog,
  toggleLog,
}) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999, background: '#111', color: 'white', padding: '10px', width: '100%' }}>
      <button onClick={onStart}>🛸 צור נחיתה</button>
      <button onClick={onDelete}>🗑️ מחק נחיתה</button>
      <button onClick={toggleLog}>{showLog ? '🙈 הסתר לוג' : '📜 הצג לוג'}</button>
      <span style={{ marginLeft: 20 }}>נחיתות: {landingCount} | חייזרים: {alienCount}</span>
      {showLog && (
        <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto', background: '#222', padding: 10 }}>
          {log.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
        </div>
      )}
    </div>
  );
}