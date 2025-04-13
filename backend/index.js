
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let landings = [];
let aliens = [];
let nextLandingId = 1000;
let nextAlienId = 1;

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
      locationName: landing.locationName
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
      alienGlobalId: alien.alienGlobalId
    }
  }));

  res.json({
    type: "FeatureCollection",
    features: [...landingFeatures, ...alienFeatures]
  });
});

app.post('/api/update-invasion', (req, res) => {
  const { features } = req.body;
  const newLandings = features.filter(f => f.properties?.type === 'landing');
  const newAliens = features.filter(f => f.properties?.type === 'alien');

  const now = Date.now();

  newLandings.forEach(l => {
    const existing = landings.find(existing => existing.id === l.properties.id);
    if (existing) {
      existing.lat = l.geometry.coordinates[1];
      existing.lng = l.geometry.coordinates[0];
      existing.locationName = l.properties.locationName || "Unknown";
      existing.lastUpdated = now;
    } else {
      const id = Math.max(nextLandingId++, ...landings.map(l => l.id)) + 1;
      nextLandingId = id + 1;
      landings.push({
        id,
        lat: l.geometry.coordinates[1],
        lng: l.geometry.coordinates[0],
        locationName: l.properties.locationName || "Unknown",
        createdAt: new Date().toISOString(),
        lastUpdated: now
      });
    }
  });

  newAliens.forEach(a => {
    const pos = [a.geometry.coordinates[0], a.geometry.coordinates[1]];
    const existing = aliens.find(existing => existing.id === a.properties.id);
    if (existing) {
      existing.position = pos;
      existing.lastUpdated = now;
    } else {
      const globalId = Math.max(nextAlienId++, ...aliens.map(a => a.alienGlobalId)) + 1;
      nextAlienId = globalId + 1;
      aliens.push({
        id: a.properties.id,
        landingId: a.properties.landingId || 0,
        alienGlobalId: globalId,
        position: pos,
        positionIdx: 0,
        lastUpdated: now
      });
    }
  });

  res.json({ message: "✅ invasion data updated and kept alive" });
});

app.listen(PORT, () => {
  console.log(`🛰️ Server running on port ${PORT}`);
});
