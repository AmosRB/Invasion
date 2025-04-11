// index.js – שרת מעודכן עם ID ו-type קבועים לנחיתות ולחייזרים + תצוגת נתונים מלאה לכל המשתמשים
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
let nextLandingId = 1;

// שליפת נתוני GeoJSON מלא עם נחיתות וחייזרים
app.get('/api/invasion', (req, res) => {
  const allFeatures = [
    ...invasionData.features,
    ...aliens.map((a) => {
      const coords = a.route ? require("@mapbox/polyline").decode(a.route) : [];
      return {
        type: "Feature",
        geometry: coords.length > 1 ? {
          type: "LineString",
          coordinates: coords.map(([lat, lng]) => [lng, lat])
        } : {
          type: "Point",
          coordinates: [a.lng || 0, a.lat || 0]
        },
        properties: {
          id: a.id,
          landingId: a.landingId,
          type: "alien"
        }
      };
    })
  ];
  res.json({ type: "FeatureCollection", features: allFeatures });
});

// עדכון GeoJSON ידני
app.post('/api/update-invasion', (req, res) => {
  invasionData = req.body;
  res.json({ message: "Updated successfully" });
});

// יצירת נחיתה חדשה עם ID ו-type
app.post('/api/landing', (req, res) => {
  const { lat, lng } = req.body;
  const newFeature = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lng, lat]
    },
    properties: {
      id: nextLandingId++,
      createdAt: new Date().toISOString(),
      type: "landing"
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
  const landings = invasionData.features.filter(f => f.properties?.type === "landing").map((f) => ({
    id: f.properties?.id,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0]
  }));
  res.json(landings);
});

// יצירת מסלול בין שתי נקודות
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

// יצירת 8 חייזרים עם ID ו-type
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
          positionIdx: 0,
          lat,
          lng
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

app.listen(PORT, () => {
  console.log(`🛰️ Server running on port ${PORT}`);
});
