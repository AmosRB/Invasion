const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let invasionData = {
  type: "FeatureCollection",
  features: []
};

let aliens = [];
let nextLandingId = 1000;
let nextAlienId = 1;

// ✅ שליפת GeoJSON מלא כולל חייזרים
app.get('/api/invasion', (req, res) => {
  const allFeatures = [...invasionData.features];

  const alienFeatures = aliens
    .map(alien => {
      const decoded = decodePolyline(alien.route || '');
      if (!decoded || decoded.length === 0) return null;
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: decoded[0]
        },
        properties: {
          type: "alien",
          id: alien.id,
          landingId: alien.landingId
        }
      };
    })
    .filter(Boolean); // מסיר null

  res.json({
    type: "FeatureCollection",
    features: [...allFeatures, ...alienFeatures]
  });
});

// ✅ יצירת נחיתה עם ID ייחודי
app.post('/api/landing', (req, res) => {
  const { lat, lng } = req.body;
  const id = nextLandingId++;
  const newFeature = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lng, lat]
    },
    properties: {
      id,
      createdAt: new Date().toISOString(),
      type: "landing"
    }
  };
  invasionData.features.push(newFeature);
  res.status(201).json({ id, lat, lng });
});

// ✅ יצירת 8 חייזרים לכל נחיתה
app.post('/api/aliens', async (req, res) => {
  const { landingId, lat, lng } = req.body;
  const directions = [0, 45, 90, 135, 180, 225, 270, 315];

  try {
    const createdAliens = await Promise.all(
      directions.map(async (angle) => {
        const rad = angle * (Math.PI / 180);
        const to = [
          lat + 0.05 * Math.cos(rad),
          lng + 0.05 * Math.sin(rad)
        ];
        const routeRes = await axios.get(
          `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${to[1]},${to[0]}?overview=full&geometries=polyline`
        );
        const route = routeRes.data.routes[0].geometry;
        return {
          id: nextAlienId++,
          landingId,
          route,
          positionIdx: 0
        };
      })
    );
    aliens.push(...createdAliens);
    res.status(201).json(createdAliens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ מחיקת נחיתה + החייזרים שלה
app.delete('/api/landing/:id', (req, res) => {
  const id = parseInt(req.params.id);
  invasionData.features = invasionData.features.filter(f => f.properties?.id !== id);
  aliens = aliens.filter(a => a.landingId !== id);
  res.json({ message: `Landing ${id} and its aliens deleted.` });
});

// ✅ שליפת כל החייזרים בלבד
app.get('/api/aliens', (req, res) => {
  res.json(aliens);
});

// ✅ שליפת כל הנחיתות בלבד
app.get('/api/landings', (req, res) => {
  const landings = invasionData.features.filter(f => f.properties?.type === "landing");
  res.json(landings);
});

// ✅ מסלול בין נקודות
app.get('/api/route', async (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  try {
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ פונקציית פענוח polyline של OSRM
function decodePolyline(encoded) {
  let points = [], index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

app.listen(PORT, () => {
  console.log(`🛰️ Server running on port ${PORT}`);
});
