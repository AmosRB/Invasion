
import React, { useState } from 'react';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import AlienManager from './components/AlienManager';
import InvasionSync from './components/InvasionSync';
import getRoute from './utils/getRoute';
import axios from 'axios';

const center = [31.5, 34.8];

const getNearestTownName = async (lat, lng) => {
  try {
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    return res.data.address.town || res.data.address.city || res.data.address.village || "Unknown";
  } catch {
    return "Unknown";
  }
};

export default function App() {
  const [landings, setLandings] = useState([]);
  const [aliens, setAliens] = useState([]);
  const [createMode, setCreateMode] = useState(false);
  const [cursorStyle, setCursorStyle] = useState("default");

  const getNextAlienId = () => {
    const ids = aliens.map(a => a.id);
    return ids.length > 0 ? Math.max(...ids) + 1 : 1;
  };

  const handleMapClick = async (latlng) => {
    if (!createMode) return;
    setCreateMode(false);
    setCursorStyle("default");

    const locationName = await getNearestTownName(latlng.lat, latlng.lng);
    const landingId = Date.now();
    const landingCode = String.fromCharCode(65 + (landings.length % 26)); // A–Z

    const newLanding = {
      id: landingId,
      lat: latlng.lat,
      lng: latlng.lng,
      name: locationName,
      landingCode
    };

    const directions = [0, 45, 90, 135, 180, 225, 270, 315];
    const startId = getNextAlienId();
    const alienPromises = directions.map(async (angle, index) => {
      const rad = angle * Math.PI / 180;
      const target = [
        latlng.lat + 0.05 * Math.cos(rad),
        latlng.lng + 0.05 * Math.sin(rad)
      ];
      const route = await getRoute([latlng.lat, latlng.lng], target);
      return {
        id: startId + index,
        route,
        positionIdx: 0,
        landingId,
        alienCode: `${landingCode}${startId + index}`
      };
    });

    const newAliens = await Promise.all(alienPromises);
    setLandings(prev => [...prev, newLanding]);
    setAliens(prev => [...prev, ...newAliens]);
  };

  return (
    <div style={{ cursor: cursorStyle }}>
      <Navbar onActivateCreate={() => {
        setCreateMode(true);
        setCursorStyle("crosshair");
      }} />
      <AlienManager aliens={aliens} setAliens={setAliens} />
      <InvasionSync landings={landings} aliens={aliens} />
      <MapView
        center={center}
        landings={landings}
        aliens={aliens}
        onMapClick={handleMapClick}
      />
    </div>
  );
}
