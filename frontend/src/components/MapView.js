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

const createEmojiIcon = (emoji, label, isLanding = false) =>
  L.divIcon({
    html: `
      <div style="display: flex; flex-direction: column; align-items: center;">
        ${
          isLanding
            ? `<div style="
                background-color: black;
                color: white;
                padding: 1px 4px;
                border-radius: 4px;
                font-size: 10px;
                margin-bottom: 2px;
                white-space: nowrap;
              ">${label}</div>`
            : ''
        }
        <div style="font-size: 24px;">${emoji}</div>
        ${
          !isLanding
            ? `<div style="
                background-color: transparent;
                color: black;
                padding: 1px 4px;
                font-size: 12px;
                margin-top: -6px;
                white-space: nowrap;
              ">${label}</div>`
            : ''
        }
      </div>
    `,
    className: 'emoji-icon',
    iconSize: [30, 42],
    iconAnchor: [15, 21],
    popupAnchor: [0, -30],
  });

export default function MapView({ center, landings, aliens, onMapClick }) {
  return (
    <MapContainer center={center} zoom={10} style={{ height: 'calc(100vh - 50px)' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickHandler onClick={onMapClick} />

      {/* ✅ הצגת הנתיבים של החייזרים */}
      {aliens.map((alien, idx) => (
        alien.route?.length > 0 ? (
          <Polyline
            key={`route-${idx}`}
            positions={alien.route}
            color="purple"
            weight={2}
          />
        ) : null
      ))}

      {[...landings, ...aliens].map((feature, idx) => {
        const isLanding = feature.name !== undefined;
        const position = isLanding ? [feature.lat, feature.lng] : feature.route[feature.positionIdx];
        const label = isLanding
          ? `${feature.name} (${feature.landingCode || '?'})`
          : feature.alienCode || feature.id;

        return (
          <Marker
            key={`marker-${idx}`}
            position={position}
            icon={createEmojiIcon(isLanding ? '🛸' : '👽', label, isLanding)}
          />
        );
      })}
    </MapContainer>
  );
}