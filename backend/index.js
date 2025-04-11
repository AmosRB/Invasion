
// index.js – שרת עם תמיכה מלאה: ID לנחיתות ולחייזרים, נתונים אחידים לכל המשתמשים
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
let nextAlienId = 1;
let nextLandingId = 1000;

// שליפת כל הנתונים
app.get('/api/invasion', (req, res) => {
  res.json(invasionData);
});

// שליפת רשימת נחיתות
app.get('/api/landings', (req, res) => {
  const landings = invasionData.features
    .filter(f => f.properties?.type === 'landing')
    .map(f => ({
      id: f.properties?.id,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0]
    }));
  res.json(landings);
});

// שליפת כל החייזרים
app.get('/api/aliens', (req, res) => {
  res.json(aliens);
});

// יצירת נחיתה חדשה
app.post('/api/landing', (req, res) => {
  const { lat, lng } = req.body;
  const id = nextLandingId++;
  const landingFeature = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lng, lat]
    },
    properties: {
      id,
      type: "landing",
      createdAt: new Date().toISOString()
    }
  };
  invasionData.features.push(landingFeature);
  res.status(201).json({ id, lat, lng });
});

// מחיקת נחיתה לפי ID
app.delete('/api/landing/:id', (req, res) => {
  const id = parseInt(req.params.id);
  invasionData.features = invasionData.features.filter(f => f.properties?.id !== id);
  aliens = aliens.filter(a => a.landingId !== id);
  res.json({ message: `Landing ${id} and its aliens deleted.` });
});

// יצירת 8 חייזרים סביב נחיתה
app.post('/api/aliens', async (req, res) => {
  const { landingId, lat, lng } = req.body;
  const directions = [0, 45, 90, 135, 180, 225, 270, 315];
  try {
    const createdAliens = await Promise.all(
      directions.map(async angle => {
        const rad = angle * Math.PI / 180;
        const toLat = lat + 0.05 * Math.cos(rad);
        const toLng = lng + 0.05 * Math.sin(rad);
        const routeRes = await axios.get(
          `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${toLng},${toLat}?overview=full&geometries=polyline`
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

// שליחת מסלול בודד
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

app.listen(PORT, () => {
  console.log(`🛸 Server running on port ${PORT}`);
});
