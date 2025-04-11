// utils/api.js
import axios from 'axios';

const API = 'https://invasion-api.onrender.com';

export const getLandings = async () => {
  const res = await axios.get(`${API}/api/landings`);
  return res.data;
};

export const getAliens = async () => {
  const res = await axios.get(`${API}/api/aliens`);
  return res.data;
};

export const postLanding = async (lat, lng) => {
  const res = await axios.post(`${API}/api/landing`, { lat, lng });
  return res.data;
};

export const deleteLanding = async (id) => {
  await axios.delete(`${API}/api/landing/${id}`);
};

export const getRoute = async (from, to) => {
  const res = await axios.get(`${API}/api/route`, {
    params: {
      fromLat: from[0],
      fromLng: from[1],
      toLat: to[0],
      toLng: to[1],
    },
  });
  return res.data.routes[0];
};
