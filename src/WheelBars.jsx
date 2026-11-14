// Two horizontal bars from -1 to 1 m/s, filled from the centre.
export default function WheelBars({ left, right }) {
  return (
    <div className="wheels">
      {[['Left wheel', left], ['Right wheel', right]].map(([label, v]) => (
        <div key={label} className="wheel">
          <span>{label}</span>
          <div className="track">
            <div
              className={v < 0 ? 'fill neg' : 'fill'}
              style={{ width: `${Math.min(Math.abs(v), 1) * 50}%`,
                       [v < 0 ? 'right' : 'left']: '50%' }}
            />
          </div>
          <b>{v.toFixed(2)} m/s</b>
        </div>
      ))}
    </div>
  );
}