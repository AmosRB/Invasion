// App.js – rewritten to await server-confirmed landings
import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import MapView from './components/MapView';
import { getLandings, getAliens, postLanding, deleteLanding, getRoute } from './utils/api';
import { logEvent } from './utils/logger';
import polyline from 'polyline';

export default function App() {
  const [landings, setLandings] = useState([]);
  const [aliens, setAliens] = useState([]);
  const [placingLanding, setPlacingLanding] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [log, setLog] = useState([]);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAliens((prev) =>
        prev.map((a) => {
          const next = a.positionIdx + 1;
          if (next < a.decodedRoute.length) {
            return { ...a, positionIdx: next };
          } else if (a.local) {
            generateNewRouteForAlien(a);
            return { ...a, positionIdx: 0 };
          } else {
            return { ...a, positionIdx: a.decodedRoute.length - 1 };
          }
        })
      );
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const refreshData = async () => {
    const [landingsRes, aliensRes] = await Promise.all([getLandings(), getAliens()]);
    setLandings(landingsRes);

    const decoded = aliensRes.map((a) => ({
      ...a,
      decodedRoute: polyline.decode(a.route || ''),
    }));
    setAliens((prev) => {
      const localAliens = prev.filter((a) => a.local);
      return [...decoded, ...localAliens];
    });
  };

  const waitUntilLandingAppears = async (id, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const landings = await getLandings();
      const exists = landings.find((l) => l.id === id);
      if (exists) return exists;
      await new Promise((res) => setTimeout(res, 500));
    }
    throw new Error("Timeout waiting for landing");
  };

  const generateNewRouteForAlien = async (alien) => {
    const lastPos = alien.decodedRoute[alien.decodedRoute.length - 1];
    const angle = Math.random() * 360;
    const rad = angle * (Math.PI / 180);
    const to = [lastPos[0] + 0.05 * Math.cos(rad), lastPos[1] + 0.05 * Math.sin(rad)];
    try {
      const route = await getRoute(lastPos, to);
      const decoded = polyline.decode(route.geometry);
      alien.decodedRoute = decoded;
      alien.route = polyline.encode(decoded);
    } catch (e) {
      console.error("OSRM route error:", e.message);
    }
  };

  const handleMapClick = async (e) => {
    if (placingLanding) {
      const res = await postLanding(e.latlng.lat, e.latlng.lng);
      try {
        const confirmed = await waitUntilLandingAppears(res.id);
        logEvent(`🛸 נחיתה ${confirmed.id} נוצרה`, setLog);

        const directions = [0, 45, 90, 135, 180, 225, 270, 315];
        const nextAlienId = aliens.length ? Math.max(...aliens.map((a) => a.id)) + 1 : 1;

        const routes = await Promise.all(
          directions.map(async (angle) => {
            const rad = angle * (Math.PI / 180);
            const to = [
              confirmed.lat + 0.05 * Math.cos(rad),
              confirmed.lng + 0.05 * Math.sin(rad),
            ];
            const r = await getRoute([confirmed.lat, confirmed.lng], to);
            return polyline.decode(r.geometry);
          })
        );

        const localAliens = routes.map((route, i) => ({
          id: nextAlienId + i,
          landingId: confirmed.id,
          decodedRoute: route,
          route: polyline.encode(route),
          positionIdx: 0,
          local: true,
        }));

        setAliens((prev) => [...prev, ...localAliens]);
        logEvent(`👽 ${localAliens.length} חייזרים שוגרו`, setLog);
      } catch (err) {
        logEvent(`❌ נחיתה נכשלה: ${res.id}`, setLog);
      }

      setPlacingLanding(false);
      document.body.style.cursor = 'default';
      refreshData();
    } else if (deleteMode) {
      const clicked = landings.find((l) => {
        const distance = Math.hypot(l.lat - e.latlng.lat, l.lng - e.latlng.lng);
        return distance < 0.001;
      });
      if (!clicked) return;

      await deleteLanding(clicked.id);
      setLandings((prev) => prev.filter((l) => l.id !== clicked.id));
      setAliens((prev) => prev.filter((a) => a.landingId !== clicked.id));
      logEvent(`🗑️ נמחקה נחיתה ${clicked.id}`, setLog);

      setDeleteMode(false);
      document.body.classList.remove('delete-mode');
      document.body.style.cursor = 'default';
    }
  };

  const handleDeleteAll = async () => {
    const ids = landings.map((l) => l.id);
    try {
      await Promise.all(ids.map((id) => deleteLanding(id)));
      ids.forEach((id) => logEvent(`🧨 נמחקה נחיתה ${id}`, setLog));
    } catch (err) {
      console.error("שגיאה במחיקת נחיתות", err);
    }
    setLandings([]);
    setAliens((prev) => prev.filter((a) => !ids.includes(a.landingId)));
  };

  return (
    <div>
      <Navbar
        landingCount={landings.length}
        alienCount={aliens.length}
        onStart={() => {
          setPlacingLanding(true);
          setDeleteMode(false);
          document.body.style.cursor = 'copy';
          logEvent("🛸 מצב יצירת נחיתה הופעל", setLog);
        }}
        onDelete={() => {
          setDeleteMode(true);
          setPlacingLanding(false);
          document.body.classList.add('delete-mode');
          logEvent("🗑️ מצב מחיקה הופעל", setLog);
        }}
        log={log}
        showLog={showLog}
        toggleLog={() => setShowLog(!showLog)}
      />
      <button onClick={handleDeleteAll} style={{ position: 'absolute', top: 10, right: 10, zIndex: 9999 }}>🧨 מחק הכל</button>
      <MapView landings={landings} aliens={aliens} onMapClick={handleMapClick} />
    </div>
  );
}
