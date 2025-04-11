import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import polyline from 'polyline';
import L from 'leaflet';


const center = [31.5, 34.8];
const API_BASE = "https://invasion-api.onrender.com";



const ClickHandler = ({ setLanding }) => {
  useMapEvents({
    click(e) {
      setLanding(e.latlng);
    },
  });
  return null;
};

const alienIcon = (number) => L.divIcon({
  html: `<div style="font-size:24px;">👽<span style="color:black; font-weight:bold; font-size:14px;">${number}</span></div>`,
  className: 'alien-icon',
  iconSize: [30, 30],
});

const landingIcon = L.divIcon({
  html: '<div style="font-size:28px;">🛸</div>',
  className: 'landing-icon',
  iconSize: [30, 30],
});

export default function App() {
  const [loadingAliens, setLoadingAliens] = useState(false);
  const [landing, setLanding] = useState(null);
  const [aliens, setAliens] = useState([]);

  const getRoute = async (from, to) => {
    const res = await axios.get(
      `${API_BASE}/api/route?fromLat=${from[0]}&fromLng=${from[1]}&toLat=${to[0]}&toLng=${to[1]}`
    );
    return polyline
      .decode(res.data.routes[0].geometry)
      .map(coord => [coord[0], coord[1]]);
  };

  useEffect(() => {
    if (!landing) return;
  
    const createAliens = async () => {
      setLoadingAliens(true); // ⏳ התחלה
      const directions = [0, 45, 90, 135, 180, 225, 270, 315];
      const alienPromises = directions.map(async (angle) => {
        const rad = angle * (Math.PI / 180);
        const target = [
          landing.lat + 0.05 * Math.cos(rad),
          landing.lng + 0.05 * Math.sin(rad),
        ];
        const route = await getRoute([landing.lat, landing.lng], target);
        return {
          route,
          positionIdx: 0,
        };
      });
  
      const aliensCreated = await Promise.all(alienPromises);
      setAliens(aliensCreated);
      setLoadingAliens(false); // ✅ סיום
    };
  
    createAliens();
  }, [landing]);
  

  useEffect(() => {
    const interval = setInterval(() => {
      const updateAliens = async () => {
        const updated = await Promise.all(
          aliens.map(async (alien, idx) => {
            let newIdx = alien.positionIdx + 1;
  
            if (newIdx >= alien.route.length) {
              const currentPos = alien.route[alien.route.length - 1];
              let newRoute = await getRoute(currentPos, [
                currentPos[0] + (Math.random() - 0.5) / 10,
                currentPos[1] + (Math.random() - 0.5) / 10,
              ]);
  
              if (!newRoute || newRoute.length < 2) {
                newRoute = alien.route.slice().reverse();
              }
  
              return { route: newRoute, positionIdx: 0 };
            }
  
            return { ...alien, positionIdx: newIdx };
          })
        );
  
        setAliens(updated);
      };
  
      updateAliens();
    }, 1000);
  
    return () => clearInterval(interval);
  }, [aliens]);
  

  useEffect(() => {
    const interval = setInterval(() => {
      if (!landing || aliens.length === 0) return;

      const geoJSON = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [landing.lng, landing.lat],
            },
            properties: { type: "landing" },
          },
          ...aliens.map((alien, idx) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [
                alien.route[alien.positionIdx][1],
                alien.route[alien.positionIdx][0],
              ],
            },
            properties: { type: "alien", id: idx + 1 },
          })),
        ],
      };

      axios.post(`${API_BASE}/api/update-invasion`, geoJSON);
    }, 1000);

    return () => clearInterval(interval);
  }, [landing, aliens]);

  return (
    <MapContainer center={center} zoom={10} style={{ height: '100vh' }}>
      {loadingAliens && (
  <div style={{
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'white',
    padding: '10px 20px',
    borderRadius: '10px',
    boxShadow: '0 0 10px rgba(0,0,0,0.2)',
    zIndex: 1000,
    fontWeight: 'bold',
    fontSize: '1.2rem'
  }}>
    🛸 החללית נחתה והחייזרים פורקים ממנה...
  </div>
)}

      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickHandler setLanding={setLanding} />
      {landing && <Marker position={landing} icon={landingIcon} />}
      {aliens.map((alien, idx) => (
        <React.Fragment key={idx}>
          <Polyline positions={alien.route} color="purple" dashArray="3" />
          <Marker
            position={alien.route[alien.positionIdx]}
            icon={alienIcon(idx + 1)}
          />
        </React.Fragment>
      ))}
    </MapContainer>
  );
}
