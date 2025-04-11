import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, GeoJSON } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';

const API_BASE = "https://invasion-api.onrender.com";

const landingIcon = L.divIcon({
  html: '<div style="font-size:28px;">🛸</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

const alienIcon = (number) => L.divIcon({
  html: `<div style="font-size:24px;">👽<span style="color:black; font-weight:bold;">${number}</span></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

export default function Viewer() {
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await axios.get(`${API_BASE}/api/invasion`);
      setFeatures(res.data.features || []);
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  const center = [31.5, 34.8];

  return (
    <MapContainer center={center} zoom={10} style={{ height: '100vh' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {features.map((f, idx) => {
        const [lng, lat] = f.geometry.coordinates;
        const icon = f.properties.type === "landing"
          ? landingIcon
          : alienIcon(f.properties.id || idx + 1);
        return <Marker key={idx} position={[lat, lng]} icon={icon} />;
      })}
    </MapContainer>
  );
}
