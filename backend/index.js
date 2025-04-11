// index.js – includes /api/invasion returning full GeoJSON
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let landings = [];
let aliens = [];
let nextLandingId = 1;
let nextAlienId = 1;

app.get("/landings", (req, res) => {
  res.json(landings);
});

app.post("/landings", (req, res) => {
  const { lat, lng } = req.body;

  const existing = landings.find(l => l.lat === lat && l.lng === lng);
  if (existing) {
    console.log("Duplicate landing detected:", existing);
    return res.status(200).json(existing);
  }

  const newLanding = {
    id: nextLandingId++,
    lat,
    lng,
    timestamp: Date.now()
  };
  landings.push(newLanding);
  console.log("Landing created:", newLanding);
  res.json(newLanding);
});

app.delete("/landings/:id", (req, res) => {
  const id = parseInt(req.params.id);
  landings = landings.filter((l) => l.id !== id);
  aliens = aliens.filter((a) => a.landingId !== id);
  res.sendStatus(204);
});

app.get("/aliens", (req, res) => {
  res.json(aliens);
});

app.post("/aliens", (req, res) => {
  const newAliens = req.body;
  if (!Array.isArray(newAliens)) {
    return res.status(400).json({ error: "Expected array of aliens" });
  }

  newAliens.forEach((alien) => {
    if (!aliens.find(a => a.id === alien.id)) {
      aliens.push(alien);
    }
  });

  console.log(`Received ${newAliens.length} aliens`);
  res.status(201).json({ success: true });
});

// ✅ New: Unified GeoJSON endpoint
app.get("/api/invasion", (req, res) => {
  const landingFeatures = landings.map((l) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [l.lng, l.lat],
    },
    properties: {
      id: l.id,
      createdAt: new Date(l.timestamp).toISOString(),
      type: "landing"
    }
  }));

  const alienFeatures = aliens.map((a) => {
    try {
      const coords = a.route ? require("polyline").decode(a.route) : [];
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coords.map(([lat, lng]) => [lng, lat]),
        },
        properties: {
          id: a.id,
          landingId: a.landingId,
          type: "alien"
        }
      };
    } catch {
      return null;
    }
  }).filter(f => f);

  res.json({
    type: "FeatureCollection",
    features: [...landingFeatures, ...alienFeatures]
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
