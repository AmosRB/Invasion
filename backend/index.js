// index.js – שרת Node/Express תומך גם בגרסה הישנה וגם בחדשה של Invasion
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let nextLandingId = 1;
let landings = []; // רשימת כל הנחיתות הפעילות

// --- API מודרני לתמיכה בגרסה החדשה של האפליקציה --- //

// קבלת כל הנחיתות
app.get('/api/landings', (req, res) => {
  res.json(landings);
});

// יצירת נחיתה חדשה
app.post('/api/landing', (req, res) => {
  const { lat, lng } = req.body;
  const newLanding = {
    id: nextLandingId++,
    lat,
    lng,
    timestamp: Date.now()
  };
  landings.push(newLanding);
  res.status(201).json(newLanding);
});

// מחיקת נחיתה לפי מזהה
app.delete('/api/landing/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = landings.findIndex(l => l.id === id);
  if (index !== -1) {
    landings.splice(index, 1);
    res.json({ message: `Landing ${id} deleted.` });
  } else {
    res.status(404).json({ error: 'Landing not found' });
  }
});

// יצירת מסלול בין שתי נקודות (לשימוש בשתי הגרסאות)
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

// --- תמיכה אחורית (Backward compatibility) --- //

// לדוגמה: אם הגרסה הישנה הייתה פונה ל-/api/alien או משהו דומה, תוכל להוסיף כאן מסלול מותאם
// app.get('/api/alien', (req, res) => {
//   res.json({ message: 'API for old client (placeholder)' });
// });

app.listen(PORT, () => {
  console.log(`🛰️ Server running on port ${PORT}`);
});
