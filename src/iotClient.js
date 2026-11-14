import mqtt from 'mqtt';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';

// Builds a signed wss:// URL for AWS IoT Core from temporary credentials.
// AWS IoT expects the session token to be added AFTER signing, so it is kept
// out of the signature and appended at the end.
export async function presignedUrl({ endpoint, region }, creds, now = new Date()) {
  const signer = new SignatureV4({
    service: 'iotdevicegateway',
    region,
    sha256: Sha256,
    credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey },
  });
  const signed = await signer.presign(
    { method: 'GET', protocol: 'wss:', hostname: endpoint, path: '/mqtt',
      headers: { host: endpoint }, query: {} },
    { expiresIn: 300, signingDate: now },
  );
  const query = Object.entries(signed.query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const token = creds.sessionToken
    ? `&X-Amz-Security-Token=${encodeURIComponent(creds.sessionToken)}`
    : '';
  return `wss://${endpoint}/mqtt?${query}${token}`;
}

// Connects as a view-only viz- client and calls onMessage(text) for every snapshot.
// Returns a function that disconnects. A dropped connection is re-opened after
// 3 s with fresh credentials, because the signed URL and the credentials expire.
export function connectTelemetry(config, { onMessage, onStatus }) {
  const credentials = fromCognitoIdentityPool({
    identityPoolId: config.identityPoolId,
    clientConfig: { region: config.region },
  });
  const clientId = 'viz-' + crypto.randomUUID().slice(0, 8); // the IAM role allows viz-* only
  let client = null;
  let timer = null;
  let stopped = false;

  async function open() {
    try {
      onStatus('connecting');
      const url = await presignedUrl(config, await credentials());
      if (stopped) return;
      client = mqtt.connect(url, {
        clientId, protocolVersion: 4, clean: true,
        reconnectPeriod: 0, connectTimeout: 10000, keepalive: 30,
      });
      client.on('connect', () => {
        client.subscribe(config.topic, { qos: 0 }, (err, granted) => {
          if (err || granted?.[0]?.qos === 128) onStatus('error', 'subscribe refused');
          else onStatus('connected', clientId);
        });
      });
      client.on('message', (_topic, payload) => onMessage(payload.toString()));
      client.on('error', (err) => onStatus('error', err.message));
      client.on('close', retry);
    } catch (err) {
      onStatus('error', err.message);
      retry();
    }
  }

  function retry() {
    if (stopped || timer) return;
    if (client) {
      client.removeAllListeners();
      client.end(true);
      client = null;
    }
    onStatus('reconnecting');
    timer = setTimeout(() => {
      timer = null;
      open();
    }, 3000);
  }

  open();
  return () => {
    stopped = true;
    clearTimeout(timer);
    if (client) client.end(true);
  };
}