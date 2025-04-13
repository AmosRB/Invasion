import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import polyline from 'polyline';
import L from 'leaflet';
import Navbar from './components/Navbar';

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

const getNearestTownName = async (lat, lng) => {
  try {
    const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    return res.data.address.town || res.data.address.city || res.data.address.village || "Unknown";
  } catch {
    return "Unknown";
  }
};

const getRoute = async (from, to) => {
  try {
    const res = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=polyline`
    );
    return polyline.decode(res.data.routes[0].geometry).map(coord => [coord[0], coord[1]]);
  } catch (err) {
    console.error("❌ Route fetch failed:", err.message);
    return [from];
  }
};

const ClickHandler = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
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

  // קבלת נתונים מהשרת כל שנייה
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/invasion`);
        const features = res.data.features;

        const newLandings = features.filter(f => f.properties?.type === 'landing');
        const newAliens = features.filter(f => f.properties?.type === 'alien');

        const remoteLandings = newLandings.map(l => ({
          id: l.properties.id,
          lat: l.geometry.coordinates[1],
          lng: l.geometry.coordinates[0],
          name: l.properties.locationName
        }));

        const remoteAliens = newAliens.map(a => ({
          id: a.properties.id,
          landingId: a.properties.landingId,
          route: [[a.geometry.coordinates[1], a.geometry.coordinates[0]]],
          positionIdx: 0
        }));

        // ✅ איחוד ללא דריסת הנחיתות שלך
        setLandings(prev => {
          const localIds = prev.map(l => l.id);
          const merged = [...prev];
          remoteLandings.forEach(l => {
            if (!localIds.includes(l.id)) merged.push(l);
          });
          return merged;
        });

        // ✅ אותו דבר לחייזרים
        setAliens(prev => {
          const localIds = prev.map(a => a.id);
          const merged = [...prev];
          remoteAliens.forEach(a => {
            if (!localIds.includes(a.id)) merged.push(a);
          });
          return merged;
        });
      } catch (err) {
        console.error("❌ Failed to fetch invasion data:", err.message);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleMapClick = async (latlng) => {
    if (!createMode) return;
    setCreateMode(false);
    setCursorStyle("default");

    const locationName = await getNearestTownName(latlng.lat, latlng.lng);
    const landingId = Date.now();

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

    setLandings(prev => [...prev, newLanding]);
    setAliens(prev => [...prev, ...newAliens]);

    const landingFeature = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [latlng.lng, latlng.lat]
      },
      properties: {
        id: landingId,
        type: "landing",
        locationName
      }
    };

    const alienFeatures = newAliens.map(a => ({
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
    }));

    const featureCollection = {
      type: "FeatureCollection",
      features: [landingFeature, ...alienFeatures]
    };

    try {
      await axios.post(`${API_BASE}/api/update-invasion`, featureCollection);
    } catch (err) {
      console.error("❌ Failed to send invasion update:", err.message);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setAliens(prevAliens =>
        prevAliens.map(alien => {
          const newIdx = alien.positionIdx + 1;
          if (newIdx >= alien.route.length) return alien;
          return { ...alien, positionIdx: newIdx };
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);
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

