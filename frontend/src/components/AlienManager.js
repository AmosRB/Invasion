
import { useEffect } from 'react';
import getRoute from '../utils/getRoute';

export default function AlienManager({ aliens, setAliens }) {
  useEffect(() => {
    const interval = setInterval(async () => {
      const updatedAliens = await Promise.all(
        aliens.map(async alien => {
          const newIdx = alien.positionIdx + 1;

          if (newIdx >= alien.route.length) {
            const from = alien.route[alien.route.length - 1];
            const angle = Math.random() * 360;
            const to = [
              from[0] + 0.05 * Math.cos(angle * Math.PI / 180),
              from[1] + 0.05 * Math.sin(angle * Math.PI / 180)
            ];
            const newRoute = await getRoute(from, to);
            return {
              ...alien,
              route: newRoute,
              positionIdx: 0
            };
          }

          return {
            ...alien,
            positionIdx: newIdx
          };
        })
      );
      setAliens(updatedAliens);
    }, 1000);

    return () => clearInterval(interval);
  }, [aliens]);

  return null;
}
