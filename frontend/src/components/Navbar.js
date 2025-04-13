
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = "https://invasion-api.onrender.com";

export default function Navbar({ onActivateCreate }) {
  const [landingCount, setLandingCount] = useState(0);
  const [alienCount, setAlienCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/invasion`);
        const features = res.data.features;
        const landings = features.filter(f => f.properties?.type === "landing");
        const aliens = features.filter(f => f.properties?.type === "alien");
        setLandingCount(landings.length);
        setAlienCount(aliens.length);
      } catch (err) {
        console.error("❌ Failed to fetch invasion stats:", err.message);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      height: "50px",
      backgroundColor: "black",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      fontFamily: "sans-serif"
    }}>
      <div style={{ fontWeight: "bold", fontSize: "18px" }}>
        Invasion Monitor
      </div>
      <div>
        🛸 {landingCount} | 👽 {alienCount}
      </div>
      <button
        onClick={onActivateCreate}
        style={{
          background: "white",
          color: "black",
          border: "none",
          padding: "8px 12px",
          borderRadius: "5px",
          cursor: "pointer"
        }}
      >
        Create Landing ⚡
      </button>
    </div>
  );
}
