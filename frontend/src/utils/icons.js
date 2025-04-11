// utils/icons.js
import L from 'leaflet';

export const landingIcon = L.divIcon({
  className: 'custom-icon',
  html: '<div style="font-size:32px;">🛸</div>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});




export const alienIcon = (id) =>
  L.divIcon({
    className: 'custom-icon',
    html: `<div style="font-size:20px; color:green;">👽<div style="font-size:10px">${id}</div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
