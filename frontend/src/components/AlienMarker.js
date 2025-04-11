// components/AlienMarker.js
import React from 'react';
import { Marker, Polyline } from 'react-leaflet';
import { alienIcon } from '../utils/icons';

export default function AlienMarker({ alien }) {
  return (
    <>
      <Polyline positions={alien.decodedRoute} color="purple" dashArray="3" />
      <Marker
        position={alien.decodedRoute[alien.positionIdx]}
        icon={alienIcon(alien.id)}
      />
    </>
  );
}