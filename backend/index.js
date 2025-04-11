// index.js – שרת תומך גם בגרסה עם /api/invasion וגם בגרסה חדשה עם /api/landings
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

// קבלת נתוני GeoJSON
app.get('/api/invasion', (req, res) => {
  res.json(invasionData);
});

// עדכון GeoJSON (לדוגמה, אם יש אפליקציה שמעבירה את זה)
app.post('/api/update-invasion', (req, res) => {
  invasionData = req.body;
  res.json({ message: "Updated successfully" });
});

// ✅ התאמה לגרסה החדשה – החזרת רשימת נחיתות בפורמט פשוט
app.get('/api/landings', (req, res) => {
  const landings = invasionData.features.map((f, i) => ({
    id: f.properties?.id || i + 1,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
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

app.listen(PORT, () => {
  console.log(`🛰️ Server running on port ${PORT}`);
});
