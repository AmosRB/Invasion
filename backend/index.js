
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

// Clean inactive data
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
      landings.push({
        id: l.properties.id,
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
      aliens.push({
        id: a.properties.id,
        landingId: a.properties.landingId || 0,
        alienGlobalId: a.properties.alienGlobalId || a.properties.id,
        position: pos,
        positionIdx: 0,
        lastUpdated: now
      });
    }
  });

  res.json({ message: "✅ invasion data merged and synced" });
});

app.post('/api/landing', (req, res) => {
  const { lat, lng, locationName } = req.body;
  const newLanding = {
    id: nextLandingId++,
    lat,
    lng,
    locationName,
    createdAt: new Date().toISOString(),
    lastUpdated: Date.now()
  };
  landings.push(newLanding);
  res.status(201).json(newLanding);
});

app.post('/api/aliens', async (req, res) => {
  const { landingId, lat, lng } = req.body;
  const directions = [0, 45, 90, 135, 180, 225, 270, 315];
  try {
    const newAliens = await Promise.all(directions.map(async angle => {
      const rad = angle * Math.PI / 180;
      const to = [
        lat + 0.05 * Math.cos(rad),
        lng + 0.05 * Math.sin(rad)
      ];
      try {
        const routeRes = await axios.get(
          `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${to[1]},${to[0]}?overview=full&geometries=polyline`
        );
        const geometry = routeRes?.data?.routes?.[0]?.geometry;
        const points = geometry ? decodePolyline(geometry) : [[lng, lat]];
        return {
          alienGlobalId: nextAlienId,
          id: nextAlienId++,
          landingId,
          route: points,
          position: points[0],
          positionIdx: 0,
          lastUpdated: Date.now()
        };
      } catch (err) {
        console.warn("OSRM fallback used:", err.message);
        return {
          alienGlobalId: nextAlienId,
          id: nextAlienId++,
          landingId,
          route: [[lng, lat]],
          position: [lng, lat],
          positionIdx: 0,
          lastUpdated: Date.now()
        };
      }
    }));
    aliens.push(...newAliens);
    res.status(201).json(newAliens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function decodePolyline(encoded) {
  let points = [], index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

app.listen(PORT, () => {
  console.log(`🛰️ Server running on port ${PORT}`);
});
