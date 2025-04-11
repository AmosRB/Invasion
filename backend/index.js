const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let invasionData = { type: "FeatureCollection", features: [] };
let aliens = [];
let nextLandingId = 1000;
let nextAlienId = 1;

// GET all data (landings + aliens)
app.get('/api/invasion', (req, res) => {
  const allFeatures = [...invasionData.features];
  const alienFeatures = aliens.map(alien => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: decodePolyline(alien.route)[0] || [0, 0]
    },
    properties: {
      type: "alien",
      id: alien.id,
      landingId: alien.landingId
    }
  }));
  res.json({
    type: "FeatureCollection",
    features: [...allFeatures, ...alienFeatures]
  });
});

// GET simplified list of landings
app.get('/api/landings', (req, res) => {
  const landings = invasionData.features
    .filter(f => f.properties?.type === 'landing')
    .map(f => ({
      id: f.properties.id,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0]
    }));
  res.json(landings);
});

// GET all aliens
app.get('/api/aliens', (req, res) => {
  res.json(aliens);
});

// POST new landing
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

// DELETE landing and related aliens
app.delete('/api/landing/:id', (req, res) => {
  const id = parseInt(req.params.id);
  invasionData.features = invasionData.features.filter(f => f.properties?.id !== id);
  aliens = aliens.filter(a => a.landingId !== id);
  res.json({ message: `Landing ${id} and its aliens deleted.` });
});

// POST create 8 aliens per landing
app.post('/api/aliens', async (req, res) => {
  const { landingId, lat, lng } = req.body;
  const directions = [0, 45, 90, 135, 180, 225, 270, 315];

  try {
    const createdAliens = await Promise.all(
      directions.map(async angle => {
        const rad = angle * Math.PI / 180;
        const to = [
          lat + 0.05 * Math.cos(rad),
          lng + 0.05 * Math.sin(rad)
        ];
        const routeRes = await axios.get(
          `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${to[1]},${to[0]}?overview=full&geometries=polyline`
        );
        return {
          id: nextAlienId++,
          landingId,
          route: routeRes.data.routes[0].geometry,
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

// GET OSRM route between 2 points
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

// Decode polyline to get alien coordinates
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
