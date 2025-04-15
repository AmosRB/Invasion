const express = require('express');
const cors = require('cors');
const axios = require('axios');
const polyline = require('polyline');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let landings = [];
let aliens = [];
let nextLandingCodeIndex = 0;

function getNextLandingCode() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const first = Math.floor(nextLandingCodeIndex / 26);
  const second = nextLandingCodeIndex % 26;
  nextLandingCodeIndex += 1;
  return (first > 0 ? alphabet[first - 1] : '') + alphabet[second];
}

app.post('/api/create-landing', async (req, res) => {
  const { lat, lng, locationName } = req.body;
  const now = Date.now();
  const landingId = now;
  const landingCode = getNextLandingCode();

  const newLanding = {
    id: landingId,
    lat,
    lng,
    locationName: locationName || "Unknown",
    createdAt: new Date().toISOString(),
    landingCode,
    lastUpdated: now
  };
  landings.push(newLanding);

  const directions = [0, 45, 90, 135, 180, 225, 270, 315];
  const startId = aliens.length > 0 ? Math.max(...aliens.map(a => a.id)) + 1 : 1;

  const newAliens = await Promise.all(directions.map(async (angle, index) => {
    const rad = angle * Math.PI / 180;
    const target = [
      lat + 0.05 * Math.cos(rad),
      lng + 0.05 * Math.sin(rad)
    ];
    const route = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${target[1]},${target[0]}?overview=full&geometries=polyline`
    ).then(r => polyline.decode(r.data.routes[0].geometry).map(([lat, lng]) => [lat, lng]))
      .catch(() => [[lat, lng]]);

    const alienId = startId + index;
    const alienCode = `${landingCode}${alienId}`;

    const alien = {
      id: alienId,
      landingId,
      alienCode,
      position: route[0],
      positionIdx: 0,
      lastUpdated: now
    };
    aliens.push(alien);
    return { ...alien, route };
  }));

  res.json({ landing: newLanding, aliens: newAliens });
});

app.get('/api/invasion', (req, res) => {
  const landingFeatures = landings.map(landing => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [landing.lng, landing.lat]
    },
    properties: {
      id: landing.id,
      createdAt: landing.createdAt,
      type: "landing",
      locationName: landing.locationName,
      landingCode: landing.landingCode
    }
  }));

  const alienFeatures = aliens.map(alien => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: alien.position,
    },
    properties: {
      id: alien.id,
      landingId: alien.landingId,
      type: "alien",
      alienCode: alien.alienCode
    }
  }));

  res.json({
    type: "FeatureCollection",
    features: [...landingFeatures, ...alienFeatures]
  });
});

app.post('/api/update-invasion', (req, res) => {
  const { features } = req.body;
  const now = Date.now();

  const newLandings = features.filter(f => f.properties?.type === 'landing');
  const newAliens = features.filter(f => f.properties?.type === 'alien');

  newLandings.forEach(l => {
    const id = l.properties.id;
    const existing = landings.find(existing => existing.id === id);
    if (existing) {
      existing.lat = l.geometry.coordinates[1];
      existing.lng = l.geometry.coordinates[0];
      existing.locationName = l.properties.locationName || "Unknown";
      existing.lastUpdated = now;
    }
  });

  newAliens.forEach(a => {
    const pos = [a.geometry.coordinates[0], a.geometry.coordinates[1]];
    const id = a.properties.id;
    const landingId = a.properties.landingId ?? 0;
    const existing = aliens.find(existing => existing.id === id);
    if (existing) {
      existing.position = pos;
      existing.lastUpdated = now;
    }
  });

  res.json({ message: "✅ invasion data updated with codes" });
});

app.listen(PORT, () => {
  console.log(`🛰️ Server running on port ${PORT}`);
});
