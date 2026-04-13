import { getInitialState } from './defaults.js';

const SHARED_STATE_KEY = 'picker_assistant_shared_state';
const MASTER_STATE_KEY = 'picker_assistant_master_products';
const VISUAL_KEY_PREFIX = 'picker_assistant_visual:';

function getVisualStorageKey(key) {
  return `${VISUAL_KEY_PREFIX}${encodeURIComponent(String(key || '').trim())}`;
}

function normalizeVisualMeta(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const meta = {
    hasSource: Boolean(input.hasSource || input.src),
  };

  if (typeof input.updatedAt === 'string' && input.updatedAt.trim()) {
    meta.updatedAt = input.updatedAt;
  }

  const width = Number(input.width);
  const height = Number(input.height);
  const cropTop = Number(input.cropTop);
  const version = Number(input.version);

  if (Number.isFinite(width) && width > 0) {
    meta.width = width;
  }

  if (Number.isFinite(height) && height > 0) {
    meta.height = height;
  }

  if (Number.isFinite(cropTop) && cropTop >= 0) {
    meta.cropTop = cropTop;
  }

  if (Number.isFinite(version) && version > 0) {
    meta.version = version;
  }

  return meta;
}

function buildVisualMeta(visual) {
  const normalizedVisual = normalizeVisual(visual);

  if (!normalizedVisual) {
    return null;
  }

  return normalizeVisualMeta({
    hasSource: true,
    updatedAt: normalizedVisual.updatedAt,
    width: normalizedVisual.width,
    height: normalizedVisual.height,
    cropTop: normalizedVisual.cropTop,
    version: normalizedVisual.version,
  });
}

function normalizeMasterCode(value) {
  return String(value || '')
    .replace(/\s/g, '')
    .trim();
}

function normalizeMasterName(value) {
  return String(value || '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMasterKeys(product) {
  return Array.from(
    new Set(
      [
        normalizeMasterCode(product?.sku),
        normalizeMasterCode(product?.barcode),
        normalizeMasterCode(product?.productId),
      ].filter(Boolean),
    ),
  );
}

function normalizeMasterProduct(product) {
  const sku = normalizeMasterCode(product?.sku);
  const barcode = normalizeMasterCode(product?.barcode);
  const productId = normalizeMasterCode(product?.productId);
  const primaryCode = sku || barcode || productId;
  const name = normalizeMasterName(product?.name);

  if (!primaryCode) {
    return null;
  }

  return {
    sku: sku || primaryCode,
    barcode: barcode || productId || sku || primaryCode,
    productId: productId || barcode || sku || primaryCode,
    name,
  };
}

function pickPreferredMasterCode(currentValue, nextValue) {
  const currentCode = normalizeMasterCode(currentValue);
  const nextCode = normalizeMasterCode(nextValue);

  if (!currentCode) {
    return nextCode;
  }

  if (!nextCode) {
    return currentCode;
  }

  return nextCode.length > currentCode.length ? nextCode : currentCode;
}

function pickPreferredMasterName(currentValue, nextValue) {
  const currentName = normalizeMasterName(currentValue);
  const nextName = normalizeMasterName(nextValue);

  if (!currentName) {
    return nextName;
  }

  if (!nextName) {
    return currentName;
  }

  return nextName.length > currentName.length ? nextName : currentName;
}

function mergeMasterProducts(products) {
  const mergedProducts = [];
  const keyToIndex = new Map();

  (products || []).forEach((product) => {
    const normalizedProduct = normalizeMasterProduct(product);

    if (!normalizedProduct) {
      return;
    }

    const matchingKey = buildMasterKeys(normalizedProduct).find((key) => keyToIndex.has(key));

    if (matchingKey) {
      const matchedIndex = keyToIndex.get(matchingKey);
      const currentProduct = mergedProducts[matchedIndex];
      mergedProducts[matchedIndex] = normalizeMasterProduct({
        sku: pickPreferredMasterCode(currentProduct?.sku, normalizedProduct?.sku),
        barcode: pickPreferredMasterCode(currentProduct?.barcode, normalizedProduct?.barcode),
        productId: pickPreferredMasterCode(currentProduct?.productId, normalizedProduct?.productId),
        name: pickPreferredMasterName(currentProduct?.name, normalizedProduct?.name),
      });
      buildMasterKeys(mergedProducts[matchedIndex]).forEach((key) => {
        keyToIndex.set(key, matchedIndex);
      });
      return;
    }

    const nextIndex = mergedProducts.push(normalizedProduct) - 1;
    buildMasterKeys(normalizedProduct).forEach((key) => {
      keyToIndex.set(key, nextIndex);
    });
  });

  return mergedProducts.sort((leftProduct, rightProduct) => {
    const leftLabel = `${leftProduct?.name || ''}|${leftProduct?.sku || leftProduct?.barcode || leftProduct?.productId || ''}`.toLowerCase();
    const rightLabel = `${rightProduct?.name || ''}|${rightProduct?.sku || rightProduct?.barcode || rightProduct?.productId || ''}`.toLowerCase();

    if (leftLabel < rightLabel) {
      return -1;
    }

    if (leftLabel > rightLabel) {
      return 1;
    }

    return 0;
  });
}

function normalizeState(input) {
  const rawVisuals = input?.aisleVisuals && typeof input.aisleVisuals === 'object' ? input.aisleVisuals : {};
  const aisleVisuals = {};

  Object.entries(rawVisuals).forEach(([key, value]) => {
    const meta = normalizeVisualMeta(value);

    if (meta) {
      aisleVisuals[key] = meta;
    }
  });

  return {
    aisleProducts:
      input?.aisleProducts && typeof input.aisleProducts === 'object' ? input.aisleProducts : {},
    aisleVisuals,
    aisleNames:
      input?.aisleNames && typeof input.aisleNames === 'object' ? input.aisleNames : {},
    lossAudits: Array.isArray(input?.lossAudits) ? input.lossAudits : [],
    stockChecks: Array.isArray(input?.stockChecks) ? input.stockChecks : [],
    masterProducts: mergeMasterProducts(input?.masterProducts),
    updatedAt: input?.updatedAt || new Date().toISOString(),
  };
}

function normalizeVisual(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const src = typeof input.src === 'string' ? input.src.trim() : '';

  if (!src) {
    return null;
  }

  return {
    ...input,
    src,
    updatedAt:
      typeof input.updatedAt === 'string' && input.updatedAt.trim()
        ? input.updatedAt
        : new Date().toISOString(),
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
  const timeoutId = setTimeout(() => controller.abort(), 30000);
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

async function readRawStateFromKv() {
  const [sharedResult, masterResult] = await Promise.all([
     runKvCommand(['GET', SHARED_STATE_KEY]),
     runKvCommand(['GET', MASTER_STATE_KEY])
  ]);
  
  const rawShared = sharedResult?.result;
  const rawMaster = masterResult?.result;

  if (!rawShared) {
    return null;
  }

  try {
    const shared = JSON.parse(String(rawShared));
    const master = rawMaster ? JSON.parse(String(rawMaster)) : [];
    return {
      ...shared,
      masterProducts: Array.isArray(master) ? master : (shared.masterProducts || [])
    };
  } catch {
    return null;
  }
}

async function writeRawStateToKv(payload) {
  const { masterProducts, ...shared } = payload;
  await Promise.all([
    runKvCommand(['SET', SHARED_STATE_KEY, JSON.stringify(shared)]),
    runKvCommand(['SET', MASTER_STATE_KEY, JSON.stringify(masterProducts || [])])
  ]);
}

async function migrateLegacyVisuals(rawState) {
  const legacyVisuals =
    rawState?.aisleVisuals && typeof rawState.aisleVisuals === 'object' ? rawState.aisleVisuals : {};
  const visualMeta = {};

  for (const [key, value] of Object.entries(legacyVisuals)) {
    const normalizedVisual = normalizeVisual({
      ...value,
      updatedAt: value?.updatedAt || rawState?.updatedAt || new Date().toISOString(),
    });

    if (!normalizedVisual) {
      continue;
    }

    await runKvCommand(['SET', getVisualStorageKey(key), JSON.stringify(normalizedVisual)]);
    const meta = buildVisualMeta(normalizedVisual);

    if (meta) {
      visualMeta[key] = meta;
    }
  }

  const payload = normalizeState({
    ...rawState,
    aisleVisuals: visualMeta,
    updatedAt: rawState?.updatedAt || new Date().toISOString(),
  });

  await writeRawStateToKv(payload);
  return payload;
}

async function ensureSharedState(includeMaster = true) {
  const rawState = await readRawStateFromKv();

  let state;
  if (!rawState) {
    const initial = normalizeState(getInitialState());
    await writeRawStateToKv(initial);
    state = initial;
  } else {
    const hasLegacyVisualPayload = Object.values(rawState?.aisleVisuals || {}).some((value) => {
      return value && typeof value === 'object' && typeof value.src === 'string' && value.src.trim();
    });

    if (hasLegacyVisualPayload) {
      state = await migrateLegacyVisuals(rawState);
    } else {
      state = normalizeState(rawState);
    }
  }

  if (!includeMaster) {
    state.masterProducts = [];
  }
  return state;
}

export async function readSharedState(includeMaster = true) {
  return ensureSharedState(includeMaster);
}

export async function writeSharedState(nextState) {
  const currentState = await ensureSharedState();
  const mergedVisuals = {
    ...currentState.aisleVisuals,
  };
  const incomingVisuals =
    nextState?.aisleVisuals && typeof nextState.aisleVisuals === 'object' ? nextState.aisleVisuals : {};

  for (const [key, value] of Object.entries(incomingVisuals)) {
    const normalizedVisual = normalizeVisual(value);

    if (normalizedVisual) {
      await runKvCommand(['SET', getVisualStorageKey(key), JSON.stringify(normalizedVisual)]);
      const meta = buildVisualMeta(normalizedVisual);

      if (meta) {
        mergedVisuals[key] = meta;
      }

      continue;
    }

    const meta = normalizeVisualMeta(value);

    if (meta) {
      mergedVisuals[key] = {
        ...mergedVisuals[key],
        ...meta,
        hasSource: Boolean(mergedVisuals[key]?.hasSource || meta.hasSource),
      };
    }
  }

  const masterToSave = Array.isArray(nextState?.masterProducts)
    ? nextState.masterProducts
    : currentState.masterProducts;

  const payload = normalizeState({
    ...currentState,
    ...nextState,
    masterProducts: masterToSave,
    aisleVisuals: mergedVisuals,
    updatedAt: new Date().toISOString(),
  });

  await writeRawStateToKv(payload);
  return payload;
}

export async function readSharedVisual(key) {
  const safeKey = String(key || '').trim();

  if (!safeKey) {
    return null;
  }

  await ensureSharedState();
  const result = await runKvCommand(['GET', getVisualStorageKey(safeKey)]);
  const raw = result?.result;

  if (!raw) {
    return null;
  }

  try {
    return normalizeVisual(JSON.parse(String(raw)));
  } catch {
    return null;
  }
}

export async function writeSharedVisual(key, visual) {
  const safeKey = String(key || '').trim();

  if (!safeKey) {
    throw new Error('Visual key is required.');
  }

  const normalizedVisual = normalizeVisual({
    ...visual,
    updatedAt: new Date().toISOString(),
  });

  if (!normalizedVisual) {
    throw new Error('Invalid visual payload.');
  }

  await runKvCommand(['SET', getVisualStorageKey(safeKey), JSON.stringify(normalizedVisual)]);

  const currentState = await ensureSharedState();
  const payload = normalizeState({
    ...currentState,
    updatedAt: new Date().toISOString(),
    aisleVisuals: {
      ...currentState.aisleVisuals,
      [safeKey]: buildVisualMeta(normalizedVisual),
    },
  });

  await writeRawStateToKv(payload);
  return normalizedVisual;
}
