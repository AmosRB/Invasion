
import { useEffect } from 'react';
import axios from 'axios';

const API_BASE = "https://invasion-api.onrender.com";

export default function InvasionSync({ landings, aliens, setLandings, setAliens }) {
  // שליחה לשרת
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
              landingCode: l.landingCode || null
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
              alienCode: a.alienCode || null
            }
          }))
        ]
      };

      axios.post(`${API_BASE}/api/update-invasion`, geoJSON);
    }, 1000);

    return () => clearInterval(interval);
  }, [landings, aliens]);

  // קבלת נתונים מהשרת כולל alienCode ו-landingCode
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/invasion`);
        const features = res.data.features;

        const remoteLandings = features
          .filter(f => f.properties?.type === 'landing')
          .map(f => ({
            id: f.properties.id,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            name: f.properties.locationName || 'Unknown',
            landingCode: f.properties.landingCode || '?'
          }));

        const remoteAliens = features
          .filter(f => f.properties?.type === 'alien')
          .map(f => ({
            id: f.properties.id,
            route: [[f.geometry.coordinates[1], f.geometry.coordinates[0]]],
            positionIdx: 0,
            landingId: f.properties.landingId,
            alienCode: f.properties.alienCode || null
          }));

        setLandings(remoteLandings);
        setAliens(remoteAliens);
      } catch (err) {
        console.error("❌ Failed to load invasion data:", err.message);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [setLandings, setAliens]);

  return null;
}
