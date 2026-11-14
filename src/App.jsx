import { useEffect, useMemo, useState } from 'react';
import { loadConfig } from './config.js';
import { connectTelemetry } from './iotClient.js';
import { createSeqTracker, parseSnapshot } from './telemetry.js';
import ArenaCanvas from './ArenaCanvas.jsx';
import WheelBars from './WheelBars.jsx';
import './App.css';

const TRAIL = 300; // positions kept for the trail

export default function App() {
  const config = useMemo(() => {
    try { return loadConfig(); } catch (err) { return err; }
  }, []);
  const [status, setStatus] = useState({ name: 'starting', detail: '' });
  const [snap, setSnap] = useState(null);
  const [stats, setStats] = useState(null);
  const [trail, setTrail] = useState([]);
  const [lastCid, setLastCid] = useState(null);

  useEffect(() => {
    if (config instanceof Error) return undefined;
    const tracker = createSeqTracker();
    return connectTelemetry(config, {
      onStatus: (name, detail = '') => setStatus({ name, detail }),
      onMessage: (text) => {
        const s = parseSnapshot(text);
        if (!s || !tracker.accept(s.seq)) return;
        setSnap(s);
        if (s.correlationId) setLastCid(s.correlationId); // most snapshots carry null
        setStats({ ...tracker.stats });
        setTrail((t) => [...t.slice(1 - TRAIL), [s.state.x, s.state.y]]);
      },
    });
  }, [config]);

  if (config instanceof Error) {
    return <main className="app"><p className="error">{config.message}</p></main>;
  }
  const st = snap?.state;
  const rows = st ? [
    ['Position', `${st.x.toFixed(2)} m, ${st.y.toFixed(2)} m`],
    ['Heading', `${((st.heading * 180) / Math.PI).toFixed(0)}°`],
    ['Throttle / steer', `${st.throttle.toFixed(2)} / ${st.steer.toFixed(2)}`],
    ['Snapshot seq', snap.seq],
    ['Dropped / restarts', `${stats.dropped} / ${stats.restarts}`],
    ['Last command', lastCid ?? '-'],
  ] : [];

  return (
    <main className="app">
      <header>
        <h1>Robot telemetry</h1>
        <span className={`status ${status.name}`}>
          {status.name}{status.detail && ` - ${status.detail}`}
        </span>
      </header>
      <div className="layout">
        <div className="arena-wrap">
          <ArenaCanvas state={st} trail={trail} />
          {!snap && <p className="waiting">Waiting for telemetry</p>}
        </div>
        <aside>
          <WheelBars left={st?.left ?? 0} right={st?.right ?? 0} />
          <dl>
            {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
          </dl>
        </aside>
      </div>
    </main>
  );
}