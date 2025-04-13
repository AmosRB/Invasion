// src/components/Navbar.js
import React from 'react';

export default function Navbar({ onActivateCreate }) {
  return (
    <nav style={{
      backgroundColor: 'black',
      color: 'white',
      padding: '10px 20px',
      fontSize: '18px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ fontWeight: 'bold' }}>🛸 Alien Invasion</div>
      <button
        onClick={onActivateCreate}
        style={{
          backgroundColor: '#444',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        ⚡ Create Landing
      </button>
    </nav>
  );
}

