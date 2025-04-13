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

// 🧼 ניקוי כל 5 שניות: מוחק נחיתות ישנות + החייזרים שלהן
setInterval(() => {
  const cutoff = Date.now() - 10000;
  const activeLandingIds = [];

  // שמור את כל הנחיתות הפעילות
  landings = landings.filter(l => {
    const isActive = l.lastUpdated && l.lastUpdated > cutoff;
    if (isActive) activeLandingIds.push(l.id);
    return isActive;
  });

  // שמור רק חייזרים ששייכים לנחיתות פעילות
  aliens = aliens.filter(a => activeLandingIds.includes(a.landingId));
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

  // עדכון נחיתות
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

  // עדכון חייזרים
  newAliens.forEach(a => {
    const existing = aliens.find(existing => existing.id === a.properties.id);
    if (existing) {
      existing.position = [a.geometry.coordinates[0], a.geometry.coordinates[1]];
      existing.lastUpdated = now;
    } else {
      aliens.push({
        id: a.properties.id,
        landingId: a.properties.landingId,
        alienGlobalId: a.properties.alienGlobalId || a.properties.id,
        position: [a.geometry.coordinates[0], a.geometry.coordinates[1]],
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
      const routeRes = await axios.get(
        `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${to[1]},${to[0]}?overview=full&geometries=polyline`
      );
      const points = decodePolyline(routeRes.data.routes[0].geometry);
      return {
        alienGlobalId: nextAlienId,
        id: nextAlienId++,
        landingId,
        route: points,
        position: points[0],
        positionIdx: 0,
        lastUpdated: Date.now()
      };
    }));
    aliens.push(...newAliens);
    res.status(201).json(newAliens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
