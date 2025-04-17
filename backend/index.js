
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

let nextLandingCode = 0;

// 🆕 פונקציה ליצירת קוד נחיתה ייחודי (A, B, ..., Z, AA, AB, ...)
function generateLandingCode(index) {
  let code = '';
  while (index >= 0) {
    code = String.fromCharCode(65 + (index % 26)) + code;
    index = Math.floor(index / 26) - 1;
  }
  return code;
}

app.use(cors());
app.use(express.json());

let landings = [];
let aliens = [];
let nextLandingCode = 0;
const alienCounters = {}; // landingId -> index

setInterval(() => {
  const cutoff = Date.now() - 10000;
  const activeLandingIds = [];

  landings = landings.filter(l => {
    const active = l.lastUpdated && l.lastUpdated > cutoff;
    if (active) activeLandingIds.push(l.id);
    return active;
  });

  aliens = aliens.filter(a =>
    (activeLandingIds.includes(a.landingId) && a.lastUpdated > cutoff)
    || !a.alienCode // ✅ preserve aliens from old versions
  );
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
      const landingCode = generateLandingCode(nextLandingCode);
      nextLandingCode += 1;
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

  res.json({ message: "✅ invasion data updated (with old version support)" });
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
