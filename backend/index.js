// index.js – שרת עם תמיכה ב־GeoJSON, נחיתות מרובות, וחייזרים מתואמים בין כל המשתמשים
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

let aliens = []; // כל החייזרים הפעילים
let nextAlienId = 1;

// שליפת נתוני GeoJSON
app.get('/api/invasion', (req, res) => {
  res.json(invasionData);
});

// עדכון GeoJSON ידני
app.post('/api/update-invasion', (req, res) => {
  invasionData = req.body;
  res.json({ message: "Updated successfully" });
});

// יצירת נחיתה חדשה
app.post('/api/landing', (req, res) => {
  const { lat, lng } = req.body;
  const newFeature = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lng, lat]
    },
    properties: {
      id: invasionData.features.length + 1,
      createdAt: new Date().toISOString()
    }
  };
  invasionData.features.push(newFeature);
  res.status(201).json({
    id: newFeature.properties.id,
    lat,
    lng
  });
});

// מחיקת נחיתה לפי ID
app.delete('/api/landing/:id', (req, res) => {
  const id = parseInt(req.params.id);
  invasionData.features = invasionData.features.filter(f => (f.properties?.id || 0) !== id);
  aliens = aliens.filter(a => a.landingId !== id);
  res.json({ message: `Landing ${id} and its aliens deleted.` });
});

// שליפת רשימת נחיתות פשוטה
app.get('/api/landings', (req, res) => {
  const landings = invasionData.features.map((f, i) => ({
    id: f.properties?.id || i + 1,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
  res.json(landings);
});

// יצירת מסלול בין שתי נקודות (משותף לשתי גרסאות)
app.get('/api/route', async (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  try {
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`
    );
    res.json(response.data);
  } catch (error) {
    console.error("OSRM Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// יצירת 8 חייזרים לכל נחיתה
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
        const id = nextAlienId++;
        return {
          id,
          landingId,
          route,
          positionIdx: 0
        };
      })
    );

    aliens.push(...createdAliens);
    res.status(201).json(createdAliens);
  } catch (err) {
    console.error("Alien route error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// שליפת כל החייזרים
app.get('/api/aliens', (req, res) => {
  res.json(aliens);
});

// עדכון מיקום חייזרים (בהמשך – אם נרצה להזיז אותם אוטומטית מהשרת)

app.listen(PORT, () => {
  console.log(`🛰️ Server running on port ${PORT}`);
});
