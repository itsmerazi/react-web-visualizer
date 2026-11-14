// Non-secret settings. Vite copies VITE_* variables into the bundle at build time.
const REQUIRED = ['VITE_AWS_REGION', 'VITE_IOT_ENDPOINT', 'VITE_IDENTITY_POOL_ID'];

export function loadConfig(env = import.meta.env) {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length) throw new Error('missing setting: ' + missing.join(', '));
  return {
    region: env.VITE_AWS_REGION,
    endpoint: env.VITE_IOT_ENDPOINT,
    identityPoolId: env.VITE_IDENTITY_POOL_ID,
    topic: 'simulation/telemetry',
  };
}