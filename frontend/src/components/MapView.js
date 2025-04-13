
import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const ClickHandler = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
};

const alienIcon = (number) => L.divIcon({
  html: `<div style="font-size:20px; font-weight:bold;">👽 <span style="font-size:14px; color:black;">${number}</span></div>`,
  className: 'alien-icon',
  iconSize: [30, 30],
});

const landingIcon = (locationName) => L.divIcon({
  html: `<div style="display:flex; flex-direction:column; align-items:center;">
    <div style="font-size:24px;">🛸</div>
    <div style="background-color:black; color:white; padding:2px 6px; border-radius:4px; font-size:12px; margin-top:2px;">${locationName}</div>
  </div>`,
  className: 'landing-icon',
  iconSize: [100, 40],
});

export default function MapView({ center, landings, aliens, onMapClick }) {
  return (
    <MapContainer center={center} zoom={10} style={{ height: 'calc(100vh - 50px)' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickHandler onClick={onMapClick} />

      {landings.map((l) => (
        <Marker key={l.id} position={[l.lat, l.lng]} icon={landingIcon(l.name)} />
      ))}

      {aliens.map((a) => (
        <React.Fragment key={a.id}>
          <Polyline positions={a.route} color="purple" dashArray="3" />
          <Marker position={a.route[a.positionIdx]} icon={alienIcon(a.id)} />
        </React.Fragment>
      ))}
    </MapContainer>
  );
}
