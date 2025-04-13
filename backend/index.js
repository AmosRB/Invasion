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

app.get('/api/invasion', (req, res) => {
  res.json({
    type: "FeatureCollection",
    features: [
      ...landings.map(landing => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [landing.lng, landing.lat] },
        properties: {
          id: landing.id,
          createdAt: landing.createdAt,
          type: "landing",
          locationName: landing.locationName
        }
      })),
      ...aliens.map(alien => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: alien.position },
        properties: {
          id: alien.id,
          landingId: alien.landingId,
          type: "alien",
          alienGlobalId: alien.alienGlobalId
        }
      }))
    ]
  });
});

// ✅ הוספת / עדכון נתונים ממכשיר
app.post('/api/update-invasion', (req, res) => {
  const { features } = req.body;
  const newLandings = features.filter(f => f.properties?.type === 'landing');
  const newAliens = features.filter(f => f.properties?.type === 'alien');

  newLandings.forEach(l => {
    const exists = landings.find(existing => existing.id === l.properties.id);
    if (!exists) {
      const newId = l.properties.id || nextLandingId++;
      landings.push({
        id: newId,
        lat: l.geometry.coordinates[1],
        lng: l.geometry.coordinates[0],
        locationName: l.properties.locationName || "Unknown",
        createdAt: new Date().toISOString()
      });
      if (newId >= nextLandingId) nextLandingId = newId + 1;
    }
  });

  newAliens.forEach(a => {
    const exists = aliens.find(existing => existing.id === a.properties.id);
    if (!exists) {
      const newId = a.properties.id || nextAlienId++;
      aliens.push({
        id: newId,
        landingId: a.properties.landingId || 0,
        alienGlobalId: a.properties.alienGlobalId || newId,
        position: [a.geometry.coordinates[0], a.geometry.coordinates[1]],
        positionIdx: 0
      });
      if (newId >= nextAlienId) nextAlienId = newId + 1;
    }
  });

  res.json({ message: "✅ Invasion data merged successfully" });
});

// ✅ מחיקת נחיתה וכל החייזרים המשויכים
app.delete('/api/landing/:id', (req, res) => {
  const id = parseInt(req.params.id);
  landings = landings.filter(l => l.id !== id);
  aliens = aliens.filter(a => a.landingId !== id);
  res.json({ message: `❌ Landing ${id} and its aliens removed.` });
});

// ✅ מחיקת חייזר בודד
app.delete('/api/alien/:id', (req, res) => {
  const id = parseInt(req.params.id);
  aliens = aliens.filter(a => a.id !== id);
  res.json({ message: `❌ Alien ${id} removed.` });
});

// יצירת נחיתה רגילה
app.post('/api/landing', (req, res) => {
  const { lat, lng, locationName } = req.body;
  const newLanding = {
    id: nextLandingId++,
    lat,
    lng,
    locationName,
    createdAt: new Date().toISOString()
  };
  landings.push(newLanding);
  res.status(201).json(newLanding);
});

// יצירת חייזרים סביב נקודה
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
        positionIdx: 0
      };
    }));
    aliens.push(...newAliens);
    res.status(201).json(newAliens);
  } catch (err) {
    console.error("🚨 Error creating aliens:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// API לנתיב (OSRM)
app.get('/api/route', async (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  try {
    const routeRes = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`
    );
    res.json(routeRes.data);
  } catch (err) {
    console.error("🚨 Error fetching route:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// פונקציית פיענוח נתיבים מ־polyline
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
