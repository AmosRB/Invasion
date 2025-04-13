
import axios from 'axios';
import polyline from 'polyline';

const API_BASE = "https://invasion-api.onrender.com";

export default async function getRoute(from, to) {
  try {
    const res = await axios.get(
      `${API_BASE}/api/route?fromLat=${from[0]}&fromLng=${from[1]}&toLat=${to[0]}&toLng=${to[1]}`
    );
    return polyline.decode(res.data.routes[0].geometry).map(([lat, lng]) => [lat, lng]);
  } catch (err) {
    console.error("❌ getRoute failed:", err.message);
    return [from]; // fallback to starting point
  }
}
