const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let landings = [];
let aliens = [];
let nextLandingCode = 0; // A=0, B=1, ...
const alienCounters = {}; // landingId -> alien number index

function getNextLandingCode() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const first = Math.floor(nextLandingCode / 26);
  const second = nextLandingCode % 26;
  nextLandingCode += 1;
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
  alienCounters[landingId] = 1;

  const directions = [0, 45, 90, 135, 180, 225, 270, 315];
  const newAliens = await Promise.all(directions.map(async (angle, i) => {
    const rad = angle * Math.PI / 180;
    const to = [
      lat + 0.05 * Math.cos(rad),
      lng + 0.05 * Math.sin(rad)
    ];
    try {
      const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${to[1]},${to[0]}?overview=full&geometries=geojson`);
      const coords = response.data?.routes?.[0]?.geometry?.coordinates || [];
      if (coords.length === 0) return null;

      const route = coords.map(([lng, lat]) => [lat, lng]);

      const id = aliens.length > 0 ? Math.max(...aliens.map(a => a.id)) + 1 : 1;
      const alienCode = `${landingCode}${id}`;

      const alien = {
        id,
        landingId,
        alienCode,
        position: route[0],
        route,
        positionIdx: 0,
        lastUpdated: now
      };
      aliens.push(alien);
      return alien;
    } catch (err) {
      console.error('Failed to fetch route:', err.message);
      return null;
    }
  }));

  res.json({
    landing: newLanding,
    aliens: newAliens.filter(Boolean)
  });
});

setInterval(() => {
  const cutoff = Date.now() - 10000;
  const activeLandingIds = [];

  landings = landings.filter(l => {
    const active = l.lastUpdated && l.lastUpdated > cutoff;
    if (active) activeLandingIds.push(l.id);
    return active;
  });

  aliens = aliens.filter(a => activeLandingIds.includes(a.landingId) && a.lastUpdated > cutoff);
}, 5000);

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
    } else {
      const landingCode = getNextLandingCode();
      landings.push({
        id,
        lat: l.geometry.coordinates[1],
        lng: l.geometry.coordinates[0],
        locationName: l.properties.locationName || "Unknown",
        createdAt: new Date().toISOString(),
        landingCode,
        lastUpdated: now
      });
      alienCounters[id] = 1;
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
    } else {
      const landing = landings.find(l => l.id === landingId);
      const code = landing?.landingCode || "?";
      const index = alienCounters[landingId] || 1;
      const alienCode = `${code}${index}`;
      alienCounters[landingId] = index + 1;

      aliens.push({
        id,
        landingId,
        alienCode,
        position: pos,
        positionIdx: 0,
        lastUpdated: now
      });
    }
  });

  res.json({ message: "✅ invasion data updated with codes" });
});

app.get('/api/route', async (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  try {
    const routeRes = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`
    );
    res.json(routeRes.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🛰️ Server running on port ${PORT}`);
});
