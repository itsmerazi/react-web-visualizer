// server/wss_bridge.cjs
const fs = require('fs');
const path = require('path');
const https = require('https');
const { WebSocketServer, WebSocket } = require('ws');

const certDir = path.join(__dirname, '../.cert');

const caCert = fs.readFileSync(path.join(certDir, 'ca_cert.pem'));
const serverCert = fs.readFileSync(path.join(certDir, 'webapp_server_cert.pem'));
const serverKey = fs.readFileSync(path.join(certDir, 'webapp_server_key.pem'));

// 1. Strict mTLS WSS Server for Python Simulator Engine (Port 8080)
const mtlsServer = https.createServer({
  ca: caCert,
  cert: serverCert,
  key: serverKey,
  requestCert: true,
  rejectUnauthorized: true
});
const wssMtls = new WebSocketServer({ server: mtlsServer });

// 2. Standard WSS Server for Visual Clients: React / Android (Port 8081)
const browserServer = https.createServer({
  cert: serverCert,
  key: serverKey,
  requestCert: false
});
const wssBrowser = new WebSocketServer({ server: browserServer });

/**
 * Directs upstream control frames exclusively to Python,
 * and fans downstream telemetry frames out to all UI clients.
 */
function routeMessage(senderWs, message) {
  const payloadStr = message.toString();

  try {
    const data = JSON.parse(payloadStr);
    const action = String(data.action || data.event || '').toUpperCase();

    // Upstream commands: Route UI actions strictly into Python (Engine & Source of Truth)
    if (action === 'EXECUTE_COMMAND' || action === 'DISCOVER_DEVICES' || action === 'DISCOVER') {
      wssMtls.clients.forEach((pythonClient) => {
        if (pythonClient !== senderWs && pythonClient.readyState === WebSocket.OPEN) {
          pythonClient.send(payloadStr);
        }
      });
      return;
    }

    // Downstream telemetry / catalog: Broadcast Python engine updates to all connected UI clients
    if (action === 'DEVICE_STATE_CHANGED' || action === 'TOPOLOGY_CATALOG_RESPONSE' || action === 'TELEMETRY_UPDATE') {
      wssBrowser.clients.forEach((uiClient) => {
        if (uiClient !== senderWs && uiClient.readyState === WebSocket.OPEN) {
          uiClient.send(payloadStr);
        }
      });
      return;
    }

    // Fallback relay for untagged synchronization frames
    [...wssMtls.clients, ...wssBrowser.clients].forEach((client) => {
      if (client !== senderWs && client.readyState === WebSocket.OPEN) {
        client.send(payloadStr);
      }
    });

  } catch (err) {
    console.error('[Bridge Server] Error parsing or routing frame:', err.message);
  }
}

function attachSocketHandlers(ws, clientName) {
  const totalSockets = wssMtls.clients.size + wssBrowser.clients.size;
  console.log(`[Bridge Server] Connected: ${clientName} | Total Active Sockets: ${totalSockets}`);

  ws.on('message', (message) => {
    routeMessage(ws, message);
  });

  ws.on('close', () => {
    const remaining = wssMtls.clients.size + wssBrowser.clients.size;
    console.log(`[Bridge Server] Disconnected: ${clientName} | Remaining Sockets: ${remaining}`);
  });

  ws.on('error', (err) => {
    console.error(`[Bridge Server] Socket Error (${clientName}):`, err.message);
  });
}

// Handle Python connections on 8080 (mTLS)
wssMtls.on('connection', (ws, req) => {
  const cert = req.socket.getPeerCertificate();
  const name = cert?.subject?.CN || 'PythonSimulatorClient';
  attachSocketHandlers(ws, `Python Engine (${name})`);
});

// Handle React Browser / Android connections on 8081
wssBrowser.on('connection', (ws) => {
  attachSocketHandlers(ws, 'UI Client (Browser/Android)');
});

mtlsServer.listen(8080, () => {
  console.log('[Bridge Server] Secure mTLS listening on wss://localhost:8080');
});

browserServer.listen(8081, () => {
  console.log('[Bridge Server] Browser WSS listening on wss://localhost:8081');
});