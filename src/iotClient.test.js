import { expect, it } from 'vitest';
import { presignedUrl } from './iotClient.js';

const config = { endpoint: 'abc123-ats.iot.ap-south-1.amazonaws.com', region: 'ap-south-1' };
const creds = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret', sessionToken: 'tok/en+=' };
const date = new Date('2026-10-24T05:00:00Z');

it('signs a wss URL and appends the session token after the signature', async () => {
  const url = new URL(await presignedUrl(config, creds, date));
  expect(url.protocol).toBe('wss:');
  expect(url.host).toBe(config.endpoint);
  expect(url.pathname).toBe('/mqtt');
  const q = url.searchParams;
  expect(q.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
  expect(q.get('X-Amz-Credential')).toBe('AKIDEXAMPLE/20261024/ap-south-1/iotdevicegateway/aws4_request');
  expect(q.get('X-Amz-SignedHeaders')).toBe('host');
  expect(q.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  expect([...q.keys()].at(-1)).toBe('X-Amz-Security-Token');   // added last, not signed
  expect(q.get('X-Amz-Security-Token')).toBe('tok/en+=');
});

it('gives the same signature with or without a session token', async () => {
  const withToken = new URL(await presignedUrl(config, creds, date)).searchParams.get('X-Amz-Signature');
  const without = new URL(await presignedUrl(config, { ...creds, sessionToken: undefined }, date))
    .searchParams.get('X-Amz-Signature');
  expect(withToken).toBe(without);
});