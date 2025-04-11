// index.js – שרת Express שתומך בגרסאות ישנות וחדשות, כולל GeoJSON ויצירת נחיתות חדשות
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

// ✅ קבלת נתוני GeoJSON – ניתן לשימוש בכל לקוח
app.get('/api/invasion', (req, res) => {
  res.json(invasionData);
});

// ✅ עדכון GeoJSON שלם (לשימוש עתידי או ע"י לקוח אחר)
app.post('/api/update-invasion', (req, res) => {
  invasionData = req.body;
  res.json({ message: "Updated successfully" });
});

// ✅ יצירת נחיתה חדשה בפורמט פשוט (lat/lng) – תואם לקליינט החדש
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

// ✅ מחיקת נחיתה לפי מזהה
app.delete('/api/landing/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const before = invasionData.features.length;
  invasionData.features = invasionData.features.filter(f => (f.properties?.id || 0) !== id);
  const after = invasionData.features.length;

  if (before === after) {
    res.status(404).json({ error: "Landing not found" });
  } else {
    res.json({ message: `Landing ${id} deleted.` });
  }
});

// ✅ תמיכה בגרסה חדשה – שליפת כל הנחיתות בפורמט פשוט
app.get('/api/landings', (req, res) => {
  const landings = invasionData.features.map((f, i) => ({
    id: f.properties?.id || i + 1,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
  res.json(landings);
});

// ✅ יצירת מסלול בין שתי נקודות (בשימוש גם בגרסה הישנה וגם בחדשה)
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
