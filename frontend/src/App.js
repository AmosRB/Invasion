import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import polyline from 'polyline';
import L from 'leaflet';
import Navbar from './components/Navbar';

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


const center = [31.5, 34.8];
const API_BASE = "https://invasion-api.onrender.com";

const alienIcon = (number) => L.divIcon({
  html: `<div style="font-size:20px; font-weight:bold;">👽 <span style="font-size:14px; color:black;">${number}</span></div>`,
  className: 'alien-icon',
  iconSize: [30, 30],
});

const landingIcon = (locationName) => L.divIcon({
  html: `<div style="display:flex; flex-direction:column; align-items:center;">
    <div style="font-size:24px;">🛸</div>
    <div style="background-color:black; color:white; padding:2px 6px; border-radius:4px; font-size:12px; margin-top:2px;">${locationName}</div>
  </div>`,
  className: 'landing-icon',
  iconSize: [100, 40],
});

const getRoute = async (from, to) => {
  try {
    const res = await axios.get(
      `${API_BASE}/api/route?fromLat=${from[0]}&fromLng=${from[1]}&toLat=${to[0]}&toLng=${to[1]}`
    );
    return polyline.decode(res.data.routes[0].geometry).map(([lat, lng]) => [lat, lng]);
  } catch (err) {
    console.error("❌ Route fetch failed:", err.message);
    return [from];
  }
};

const ClickHandler = ({ onClick }) => {
  useMapEvents({ click(e) { onClick(e.latlng); } });
  return null;
};

export default function App() {
  const [landings, setLandings] = useState([]);
  const [aliens, setAliens] = useState([]);
  const [createMode, setCreateMode] = useState(false);
  const [cursorStyle, setCursorStyle] = useState("default");

  const getNextAlienId = (existingAliens) => {
    const ids = existingAliens.map(a => a.id);
    return ids.length > 0 ? Math.max(...ids) + 1 : 1;
  };

  const handleMapClick = async (latlng) => {
    if (!createMode) return;
    setCreateMode(false);
    setCursorStyle("default");

    const landingId = Date.now();
    const locationName = await getNearestTownName(latlng.lat, latlng.lng);


    const newLanding = {
      id: landingId,
      lat: latlng.lat,
      lng: latlng.lng,
      name: locationName
    };

    const directions = [0, 45, 90, 135, 180, 225, 270, 315];
    const startId = getNextAlienId(aliens);
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
        landingId
      };
    });

    const newAliens = await Promise.all(alienPromises);

    setLandings(l => [...l, newLanding]);
    setAliens(a => [...a, ...newAliens]);
  };
  // חידוש מסלול לחייזרים כל שנייה
  useEffect(() => {
    const interval = setInterval(async () => {
      const updatedAliens = await Promise.all(
        aliens.map(async alien => {
          const newIdx = alien.positionIdx + 1;

          if (newIdx >= alien.route.length) {
            const from = alien.route[alien.route.length - 1];
            const angle = Math.random() * 360;
            const to = [
              from[0] + 0.05 * Math.cos(angle * Math.PI / 180),
              from[1] + 0.05 * Math.sin(angle * Math.PI / 180)
            ];
            const newRoute = await getRoute(from, to);
            return {
              ...alien,
              route: newRoute,
              positionIdx: 0
            };
          }

          return {
            ...alien,
            positionIdx: newIdx
          };
        })
      );
      setAliens(updatedAliens);
    }, 1000);

    return () => clearInterval(interval);
  }, [aliens]);

  // שליחה לשרת כל שנייה
  useEffect(() => {
    const interval = setInterval(() => {
      if (landings.length === 0 && aliens.length === 0) return;

      const geoJSON = {
        type: "FeatureCollection",
        features: [
          ...landings.map(l => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [l.lng, l.lat],
            },
            properties: {
              type: "landing",
              id: l.id,
              locationName: l.name,
            }
          })),
          ...aliens.map(a => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [
                a.route[a.positionIdx][1],
                a.route[a.positionIdx][0]
              ]
            },
            properties: {
              type: "alien",
              id: a.id,
              landingId: a.landingId,
              alienGlobalId: a.id
            }
          }))
        ]
      };

      axios.post(`${API_BASE}/api/update-invasion`, geoJSON);
    }, 1000);

    return () => clearInterval(interval);
  }, [landings, aliens]);

  return (
    <div style={{ cursor: cursorStyle }}>
      <Navbar onActivateCreate={() => {
        setCreateMode(true);
        setCursorStyle("crosshair");
      }} />
      <MapContainer center={center} zoom={10} style={{ height: 'calc(100vh - 50px)' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickHandler onClick={handleMapClick} />

        {landings.map((l) => (
          <Marker key={l.id} position={[l.lat, l.lng]} icon={landingIcon(l.name)} />
        ))}

        {aliens.map((a) => (
          <React.Fragment key={a.id}>
            <Polyline positions={a.route} color="purple" dashArray="3" />
            <Marker position={a.route[a.positionIdx]} icon={alienIcon(a.id)} />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
