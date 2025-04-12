const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let invasionData = { type: "FeatureCollection", features: [] };
let nextLandingId = 1000;
let nextAlienId = 1;

app.get('/api/invasion', (req, res) => {
  res.json(invasionData);
});

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

app.get('/api/aliens', (req, res) => {
  const aliens = invasionData.features
    .filter(f => f.properties?.type === 'alien')
    .map(f => ({
      id: f.properties.id,
      landingId: f.properties.landingId,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0]
    }));
  res.json(aliens);
});

app.post('/api/landing', (req, res) => {
  const { lat, lng } = req.body;
  const id = nextLandingId++;
  const newLanding = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id,
      createdAt: new Date().toISOString(),
      type: "landing"
    }
  };
  invasionData.features.push(newLanding);
  res.status(201).json({ id, lat, lng });
});

app.delete('/api/landing/:id', (req, res) => {
  const id = parseInt(req.params.id);
  invasionData.features = invasionData.features.filter(f => {
    const pid = f.properties?.id;
    const type = f.properties?.type;
    const lid = f.properties?.landingId;
    return !(type === 'landing' && pid === id) && !(type === 'alien' && lid === id);
  });
  res.json({ message: `Landing ${id} and its aliens deleted.` });
});

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
        const route = routeRes.data.routes[0].geometry;
        const decoded = decodePolyline(route)[0] || [lng, lat];

        const alienFeature = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: decoded
          },
          properties: {
            id: nextAlienId++,
            landingId,
            type: "alien"
          }
        };

        invasionData.features.push(alienFeature);
        return alienFeature;
      })
    );

    res.status(201).json(createdAliens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
