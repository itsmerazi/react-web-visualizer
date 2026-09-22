import React, { useState, useEffect, useRef, useCallback } from 'react';

const DEVICE_AND_A = 'Dev-AND-001';
const DEVICE_AND_B = 'Dev-AND-002';
const DEVICE_OR_A  = 'Dev-OR-001';
const DEVICE_OR_B  = 'Dev-OR-002';
const DEVICE_NOT_A = 'Dev-NOT-001';

const WS_URL = 'wss://localhost:8081';

// Global CSS reset to clear user-agent margin gaps at body/html bounds
const globalResetStyles = `
  html, body, #root {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: 100% !important;
    box-sizing: border-box !important;
    overflow-x: hidden !important;
  }
  *, *:before, *:after {
    box-sizing: inherit !important;
  }
`;

export default function App() {
  const [connStatus, setConnStatus] = useState('disconnected');

  const [telemetry, setTelemetry] = useState({
    switches: {
      [DEVICE_AND_A]: false,
      [DEVICE_AND_B]: false,
      [DEVICE_OR_A]: false,
      [DEVICE_OR_B]: false,
      [DEVICE_NOT_A]: false,
    },
    lamps: {
      andLamp: false,
      orLamp: false,
      notLamp: true,
    }
  });

  const wsRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  const sendCommand = useCallback((deviceId, targetState) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const commandPayload = {
        action: 'EXECUTE_COMMAND',
        deviceId: deviceId,
        command: targetState ? 'ON' : 'OFF',
        payload: { value: targetState },
        timestamp: Math.floor(Date.now() / 1000)
      };
      ws.send(JSON.stringify(commandPayload));
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    setConnStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[React WebApp] Connected to Bridge');
      setConnStatus('connected');
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const actionType = String(data.action || data.event || '').toUpperCase();

        if (actionType === 'DEVICE_STATE_CHANGED' || actionType === 'TELEMETRY_UPDATE') {
          if (data.devices) {
            const nextSwitches = {};
            let andLamp = false;
            let orLamp = false;
            let notLamp = false;

            data.devices.forEach((dev) => {
              if (dev.deviceType === 'SMART_SWITCH') {
                nextSwitches[dev.deviceId] = dev.state?.isOn ?? false;
              } else if (dev.deviceId === 'Dev-LAMP-AND') {
                andLamp = dev.state?.isOn ?? false;
              } else if (dev.deviceId === 'Dev-LAMP-OR') {
                orLamp = dev.state?.isOn ?? false;
              } else if (dev.deviceId === 'Dev-LAMP-NOT') {
                notLamp = dev.state?.isOn ?? false;
              }
            });

            setTelemetry({ switches: nextSwitches, lamps: { andLamp, orLamp, notLamp } });
          } else if (data.deviceId) {
            const { deviceId, currentState } = data;
            const isOn = currentState?.isOn ?? (currentState?.command === 'ON');

            setTelemetry((prev) => ({
              ...prev,
              switches: {
                ...prev.switches,
                [deviceId]: isOn
              }
            }));
          }
        }
      } catch (err) {
        console.error('[React WebApp] Frame parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[React WebApp] WebSocket Error:', err);
      setConnStatus('error');
    };

    ws.onclose = () => {
      setConnStatus('disconnected');
      wsRef.current = null;
      const timeout = Math.min(30000, 1000 * Math.pow(2, Math.min(reconnectAttemptRef.current, 10))) + Math.random() * 1000;
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, timeout);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const andSwitchA = telemetry.switches[DEVICE_AND_A] || false;
  const andSwitchB = telemetry.switches[DEVICE_AND_B] || false;
  const orSwitchA  = telemetry.switches[DEVICE_OR_A] || false;
  const orSwitchB  = telemetry.switches[DEVICE_OR_B] || false;
  const notSwitchA = telemetry.switches[DEVICE_NOT_A] || false;

  const andOutput = telemetry.lamps.andLamp;
  const orOutput  = telemetry.lamps.orLamp;
  const notOutput = telemetry.lamps.notLamp;

  const isConnected = connStatus === 'connected';
  const COLOR_WIRE_ACTIVE = '#22c55e';
  const COLOR_WIRE_INACTIVE = '#1e293b';

  const andWireColor = andOutput ? COLOR_WIRE_ACTIVE : COLOR_WIRE_INACTIVE;
  const orWireColor = orOutput ? COLOR_WIRE_ACTIVE : COLOR_WIRE_INACTIVE;
  const notWireColor = notOutput ? COLOR_WIRE_ACTIVE : COLOR_WIRE_INACTIVE;

  return (
    <>
      <style>{globalResetStyles}</style>
      
      {/* Root Full-Width Outer Canvas */}
      <div style={{
        backgroundColor: '#0f172a',
        minHeight: '100vh',
        width: '100%',
        margin: 0,
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        
        {/* Full Edge-to-Edge White Card Wrapper */}
        <div style={{
          width: '100%',
          flex: 1,
          backgroundColor: '#f8fafc',
          borderRadius: 0, // Set to 0 to align directly against browser frame edges
          padding: '24px 20px',
          boxSizing: 'border-box'
        }}>
          
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: '700', color: '#0f172a' }}>Logic Gate Switch Circuits</h1>
            <div style={{ fontSize: '13px', fontWeight: '700', color: isConnected ? '#16a34a' : '#dc2626', letterSpacing: '0.5px' }}>
              SYSTEM STATUS: {connStatus.toUpperCase()}
            </div>
          </div>

          {/* 3-Column Responsive Grid Filling Horizontal Viewport Capacity */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
            width: '100%'
          }}>
            
            {/* AND Gate Panel */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg viewBox="0 0 400 220" style={{ width: '100%', height: 'auto', maxHeight: '220px' }}>
                <line x1="50" y1="95" x2="70" y2="95" stroke="#1e293b" strokeWidth="3" />
                <line x1="55" y1="103" x2="65" y2="103" stroke="#1e293b" strokeWidth="3" />
                <line x1="48" y1="111" x2="72" y2="111" stroke="#1e293b" strokeWidth="3" />
                <line x1="55" y1="119" x2="65" y2="119" stroke="#1e293b" strokeWidth="3" />
                
                <text x="36" y="93" fontSize="16" fontWeight="bold" fill="#1e293b">+</text>
                <text x="37" y="127" fontSize="18" fontWeight="bold" fill="#1e293b">-</text>

                <path d="M 60 95 L 60 60 L 110 60" stroke={andWireColor} strokeWidth="3" fill="none" />
                <path d="M 165 60 L 205 60" stroke={andWireColor} strokeWidth="3" fill="none" />
                <path d="M 260 60 L 350 60 L 350 85" stroke={andWireColor} strokeWidth="3" fill="none" />
                <path d="M 350 135 L 350 160 L 60 160 L 60 119" stroke={andWireColor} strokeWidth="3" fill="none" />

                <circle cx="110" cy="60" r="4" fill="#1e293b" />
                <circle cx="165" cy="60" r="4" fill="#1e293b" />
                <line x1="110" y1="60" x2="160" y2={andSwitchA ? '60' : '42'} stroke="#2563eb" strokeWidth="4.5" strokeLinecap="round" />
                <text x="135" y="32" fontSize="16" fontWeight="bold" fill="#1e293b" textAnchor="middle">A</text>

                <circle cx="205" cy="60" r="4" fill="#1e293b" />
                <circle cx="260" cy="60" r="4" fill="#1e293b" />
                <line x1="205" y1="60" x2="255" y2={andSwitchB ? '60' : '42'} stroke="#2563eb" strokeWidth="4.5" strokeLinecap="round" />
                <text x="232" y="32" fontSize="16" fontWeight="bold" fill="#1e293b" textAnchor="middle">B</text>

                <circle cx="350" cy="110" r="24" fill={andOutput ? '#fde047' : '#ffffff'} stroke="#1e293b" strokeWidth="3" />
                <line x1="333" y1="93" x2="367" y2="127" stroke="#1e293b" strokeWidth="2.5" />
                <line x1="367" y1="93" x2="333" y2="127" stroke="#1e293b" strokeWidth="2.5" />
              </svg>

              <h2 style={{ margin: '12px 0 16px 0', fontSize: '20px', color: '#0f172a', fontWeight: '700' }}>AND Gate (Series)</h2>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', width: '100%' }}>
                <button
                  onClick={() => sendCommand(DEVICE_AND_A, !andSwitchA)}
                  disabled={!isConnected}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isConnected ? '#cbd5e1' : '#e2e8f0',
                    color: isConnected ? '#475569' : '#94a3b8',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isConnected ? 'pointer' : 'not-allowed'
                  }}
                >
                  Toggle A: {andSwitchA ? '1 (CLOSED)' : '0 (OPEN)'}
                </button>
                <button
                  onClick={() => sendCommand(DEVICE_AND_B, !andSwitchB)}
                  disabled={!isConnected}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isConnected ? '#cbd5e1' : '#e2e8f0',
                    color: isConnected ? '#475569' : '#94a3b8',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isConnected ? 'pointer' : 'not-allowed'
                  }}
                >
                  Toggle B: {andSwitchB ? '1 (CLOSED)' : '0 (OPEN)'}
                </button>
              </div>

              <div style={{ width: '100%', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#1e293b', boxSizing: 'border-box' }}>
                Output (Y) = {andOutput ? '1 (HIGH / Lamp ON)' : '0 (LOW / Lamp OFF)'}
              </div>
            </div>

            {/* OR Gate Panel */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg viewBox="0 0 400 220" style={{ width: '100%', height: 'auto', maxHeight: '220px' }}>
                <line x1="50" y1="95" x2="70" y2="95" stroke="#1e293b" strokeWidth="3" />
                <line x1="55" y1="103" x2="65" y2="103" stroke="#1e293b" strokeWidth="3" />
                <line x1="48" y1="111" x2="72" y2="111" stroke="#1e293b" strokeWidth="3" />
                <line x1="55" y1="119" x2="65" y2="119" stroke="#1e293b" strokeWidth="3" />
                
                <text x="36" y="93" fontSize="16" fontWeight="bold" fill="#1e293b">+</text>
                <text x="37" y="127" fontSize="18" fontWeight="bold" fill="#1e293b">-</text>

                <path d="M 60 95 L 60 70 L 110 70 M 110 40 L 110 100 M 250 40 L 250 100 M 250 70 L 350 70 L 350 85" stroke={orWireColor} strokeWidth="3" fill="none" />
                <path d="M 350 135 L 350 160 L 60 160 L 60 119" stroke={orWireColor} strokeWidth="3" fill="none" />

                <path d="M 110 40 L 135 40 M 190 40 L 250 40" stroke={orWireColor} strokeWidth="3" fill="none" />
                <circle cx="135" cy="40" r="4" fill="#1e293b" />
                <circle cx="190" cy="40" r="4" fill="#1e293b" />
                <line x1="135" y1="40" x2="185" y2={orSwitchA ? '40' : '22'} stroke="#2563eb" strokeWidth="4.5" strokeLinecap="round" />
                <text x="160" y="18" fontSize="16" fontWeight="bold" fill="#1e293b" textAnchor="middle">A</text>

                <path d="M 110 100 L 135 100 M 190 100 L 250 100" stroke={orWireColor} strokeWidth="3" fill="none" />
                <circle cx="135" cy="100" r="4" fill="#1e293b" />
                <circle cx="190" cy="100" r="4" fill="#1e293b" />
                <line x1="135" y1="100" x2="185" y2={orSwitchB ? '100' : '82'} stroke="#2563eb" strokeWidth="4.5" strokeLinecap="round" />
                <text x="160" y="124" fontSize="16" fontWeight="bold" fill="#1e293b" textAnchor="middle">B</text>

                <circle cx="350" cy="110" r="24" fill={orOutput ? '#fde047' : '#ffffff'} stroke="#1e293b" strokeWidth="3" />
                <line x1="333" y1="93" x2="367" y2="127" stroke="#1e293b" strokeWidth="2.5" />
                <line x1="367" y1="93" x2="333" y2="127" stroke="#1e293b" strokeWidth="2.5" />
              </svg>

              <h2 style={{ margin: '12px 0 16px 0', fontSize: '20px', color: '#0f172a', fontWeight: '700' }}>OR Gate (Parallel)</h2>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', width: '100%' }}>
                <button
                  onClick={() => sendCommand(DEVICE_OR_A, !orSwitchA)}
                  disabled={!isConnected}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isConnected ? '#cbd5e1' : '#e2e8f0',
                    color: isConnected ? '#475569' : '#94a3b8',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isConnected ? 'pointer' : 'not-allowed'
                  }}
                >
                  Toggle A: {orSwitchA ? '1 (CLOSED)' : '0 (OPEN)'}
                </button>
                <button
                  onClick={() => sendCommand(DEVICE_OR_B, !orSwitchB)}
                  disabled={!isConnected}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isConnected ? '#cbd5e1' : '#e2e8f0',
                    color: isConnected ? '#475569' : '#94a3b8',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isConnected ? 'pointer' : 'not-allowed'
                  }}
                >
                  Toggle B: {orSwitchB ? '1 (CLOSED)' : '0 (OPEN)'}
                </button>
              </div>

              <div style={{ width: '100%', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#1e293b', boxSizing: 'border-box' }}>
                Output (Y) = {orOutput ? '1 (HIGH / Lamp ON)' : '0 (LOW / Lamp OFF)'}
              </div>
            </div>

            {/* NOT Gate Panel */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg viewBox="0 0 400 220" style={{ width: '100%', height: 'auto', maxHeight: '220px' }}>
                <line x1="50" y1="95" x2="70" y2="95" stroke="#1e293b" strokeWidth="3" />
                <line x1="55" y1="103" x2="65" y2="103" stroke="#1e293b" strokeWidth="3" />
                <line x1="48" y1="111" x2="72" y2="111" stroke="#1e293b" strokeWidth="3" />
                <line x1="55" y1="119" x2="65" y2="119" stroke="#1e293b" strokeWidth="3" />
                
                <text x="36" y="93" fontSize="16" fontWeight="bold" fill="#1e293b">+</text>
                <text x="37" y="127" fontSize="18" fontWeight="bold" fill="#1e293b">-</text>

                <path d="M 60 95 L 60 60 L 350 60 L 350 85" stroke={notWireColor} strokeWidth="3" fill="none" />
                <path d="M 350 135 L 350 160 L 60 160 L 60 119" stroke={notWireColor} strokeWidth="3" fill="none" />

                <line x1="200" y1="60" x2="200" y2="82" stroke={notSwitchA ? '#ef4444' : '#1e293b'} strokeWidth="3" />
                <line x1="200" y1="128" x2="200" y2="160" stroke={notSwitchA ? '#ef4444' : '#1e293b'} strokeWidth="3" />

                <circle cx="200" cy="60" r="3.5" fill="#1e293b" />
                <circle cx="200" cy="160" r="3.5" fill="#1e293b" />

                <circle cx="200" cy="82" r="3.5" fill="#1e293b" />
                <circle cx="200" cy="128" r="3.5" fill="#1e293b" />

                <line
                  x1="200"
                  y1="128"
                  x2={notSwitchA ? '200' : '182'}
                  y2={notSwitchA ? '82' : '92'}
                  stroke="#2563eb"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />

                <text x="165" y="112" fontSize="16" fontWeight="bold" fill="#1e293b" textAnchor="end">A</text>

                <circle cx="350" cy="110" r="24" fill={notOutput ? '#fde047' : '#ffffff'} stroke="#1e293b" strokeWidth="3" />
                <line x1="333" y1="93" x2="367" y2="127" stroke="#1e293b" strokeWidth="2.5" />
                <line x1="367" y1="93" x2="333" y2="127" stroke="#1e293b" strokeWidth="2.5" />
              </svg>

              <h2 style={{ margin: '12px 0 16px 0', fontSize: '20px', color: '#0f172a', fontWeight: '700' }}>NOT Gate (Inverter)</h2>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', width: '100%' }}>
                <button
                  onClick={() => sendCommand(DEVICE_NOT_A, !notSwitchA)}
                  disabled={!isConnected}
                  style={{
                    width: '100%',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isConnected ? '#cbd5e1' : '#e2e8f0',
                    color: isConnected ? '#475569' : '#94a3b8',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isConnected ? 'pointer' : 'not-allowed'
                  }}
                >
                  Toggle A: {notSwitchA ? '1 (CLOSED)' : '0 (OPEN)'}
                </button>
              </div>

              <div style={{ width: '100%', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#1e293b', boxSizing: 'border-box' }}>
                Output (Y) = {notOutput ? '1 (HIGH / Lamp ON)' : '0 (LOW / Lamp OFF)'}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}