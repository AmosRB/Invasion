// components/ClickHandler.js
import { useMapEvents } from 'react-leaflet';

export default function ClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => {
      if (onClick) onClick(e);
    },
  });
  return null;
}
