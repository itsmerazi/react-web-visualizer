import { useEffect, useRef } from 'react';

const ARENA = 10;                  // the engine keeps the robot within +/- 10 m
const SIZE = 480;                  // canvas size in pixels
const SCALE = SIZE / (2 * ARENA);  // pixels per metre
const toPx = (x, y) => [SIZE / 2 + x * SCALE, SIZE / 2 - y * SCALE]; // y points up

export default function ArenaCanvas({ state, trail }) {
  const ref = useRef(null);

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.fillStyle = '#0d121b';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = '#1f2a3c';                      // 2 m grid
    for (let m = -ARENA; m <= ARENA; m += 2) {
      const [gx, gy] = toPx(m, m);
      ctx.beginPath();
      ctx.moveTo(gx, 0); ctx.lineTo(gx, SIZE);
      ctx.moveTo(0, gy); ctx.lineTo(SIZE, gy);
      ctx.stroke();
    }
    if (trail.length > 1) {                            // where the robot has been
      ctx.strokeStyle = 'rgba(95, 220, 192, 0.5)';
      ctx.beginPath();
      trail.forEach(([x, y], i) => {
        const [px, py] = toPx(x, y);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
    if (!state) return;
    const [px, py] = toPx(state.x, state.y);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-state.heading);                       // canvas angles turn clockwise
    ctx.fillStyle = '#5aa0ff';
    ctx.fillRect(-SCALE / 2, -SCALE / 2, SCALE, SCALE); // 1 m body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();                                  // nose shows the heading
    ctx.moveTo(SCALE * 0.75, 0);
    ctx.lineTo(SCALE * 0.3, -SCALE * 0.25);
    ctx.lineTo(SCALE * 0.3, SCALE * 0.25);
    ctx.fill();
    ctx.restore();
  }, [state, trail]);

  return <canvas ref={ref} width={SIZE} height={SIZE} className="arena" />;
}