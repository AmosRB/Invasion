// components/MapView.js
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import ClickHandler from './ClickHandler';
import LandingMarker from './LandingMarker';
import AlienMarker from './AlienMarker';

export default function MapView({
  landings,
  aliens,
  onMapClick
}) {
  return (
    <MapContainer center={[32.1, 34.8]} zoom={12} style={{ height: '100vh', width: '100%' }}>
      <ClickHandler onClick={onMapClick} />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {landings.map((landing) => (
        <LandingMarker
          key={`landing-${landing.id}`}
          id={landing.id}
          lat={landing.lat}
          lng={landing.lng}
        />
      ))}
      {aliens.map((alien) => (
        <AlienMarker key={`alien-${alien.id}`} alien={alien} />
      ))}
    </MapContainer>
  );
}
