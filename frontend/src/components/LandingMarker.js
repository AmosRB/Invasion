// components/LandingMarker.js
import React from 'react';
import { Marker } from 'react-leaflet';
import { landingIcon } from '../utils/icons';

export default function LandingMarker({ id, lat, lng }) {
  return (
    <Marker
      key={`landing-${id}`}
      position={[lat, lng]}
      icon={landingIcon}
    />
  );
}