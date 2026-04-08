import { getInitialState } from './defaults.js';

const SHARED_STATE_KEY = 'picker_assistant_shared_state';

function normalizeState(input) {
  return {
    aisleProducts:
      input?.aisleProducts && typeof input.aisleProducts === 'object' ? input.aisleProducts : {},
    aisleVisuals:
      input?.aisleVisuals && typeof input.aisleVisuals === 'object' ? input.aisleVisuals : {},
    lossAudits: Array.isArray(input?.lossAudits) ? input.lossAudits : [],
    stockChecks: Array.isArray(input?.stockChecks) ? input.stockChecks : [],
    updatedAt: input?.updatedAt || new Date().toISOString(),
  };
}

function getKvConfig() {
  const url = String(process.env.KV_REST_API_URL || '').trim();
  const token = String(process.env.KV_REST_API_TOKEN || '').trim();

  if (!url || !token) {
    throw new Error('Missing Upstash KV environment variables.');
  }

  return { url, token };
}

async function runKvCommand(command) {
  const { url, token } = getKvConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });
  } catch (error) {
    const message =
      error?.name === 'AbortError'
        ? 'Upstash KV request timed out.'
        : error?.message || 'Upstash KV request failed.';
    throw new Error(message);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Upstash KV request failed (${response.status}).`);
  }

  return response.json();
}

export async function readSharedState() {
  const result = await runKvCommand(['GET', SHARED_STATE_KEY]);
  const raw = result?.result;

  if (!raw) {
    const initial = normalizeState(getInitialState());
    await writeSharedState(initial);
    return initial;
  }

  try {
    return normalizeState(JSON.parse(String(raw)));
  } catch {
    const initial = normalizeState(getInitialState());
    await writeSharedState(initial);
    return initial;
  }
}

export async function writeSharedState(nextState) {
  const payload = normalizeState({
    ...nextState,
    updatedAt: new Date().toISOString(),
  });

  await runKvCommand(['SET', SHARED_STATE_KEY, JSON.stringify(payload)]);

  return payload;
}
