import { INITIAL_AISLE_PRODUCTS, STORAGE_KEY, VISUAL_STORAGE_KEY } from './data';

const STOCK_META = {
  unchecked: {
    id: 'unchecked',
    label: 'Chua KT',
    shortLabel: 'Chua KT',
    tone: 'neutral',
  },
  in_stock: {
    id: 'in_stock',
    label: 'Con hang',
    shortLabel: 'Con hang',
    tone: 'good',
  },
  low_stock: {
    id: 'low_stock',
    label: 'Sap het',
    shortLabel: 'Sap het',
    tone: 'warn',
  },
  out_of_stock: {
    id: 'out_of_stock',
    label: 'Het hang',
    shortLabel: 'Het hang',
    tone: 'danger',
  },
};

export function parseStoredProducts() {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return INITIAL_AISLE_PRODUCTS;
  }

  try {
    const parsed = JSON.parse(stored);
    return typeof parsed === 'object' && parsed ? parsed : INITIAL_AISLE_PRODUCTS;
  } catch {
    return INITIAL_AISLE_PRODUCTS;
  }
}

export function normaliseExtractedItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const normalizedSku = String(
        item?.sku || item?.barcode || item?.productId || item?.ean || item?.barCode || '',
      )
        .replace(/\s/g, '')
        .trim();

      const normalizedBarcode = String(item?.barcode || item?.productId || item?.ean || normalizedSku)
        .replace(/\s/g, '')
        .trim();

      return {
        locId: Number(item?.locId),
        sku: normalizedSku,
        barcode: normalizedBarcode || normalizedSku,
        productId: normalizedBarcode || normalizedSku,
        name: String(item?.name || '')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      };
    })
    .filter((item) => Number.isFinite(item.locId) && item.locId > 0 && (item.sku || item.name))
    .sort((left, right) => right.locId - left.locId);
}

export function parseStoredVisuals() {
  const stored = window.localStorage.getItem(VISUAL_STORAGE_KEY);

  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function persistToStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function normaliseSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildToast(type, message) {
  return { id: Date.now(), type, message };
}

export function getStockMeta(status) {
  return STOCK_META[status] || STOCK_META.unchecked;
}

export function getStockControlOptions() {
  return [
    STOCK_META.unchecked,
    STOCK_META.in_stock,
    STOCK_META.low_stock,
    STOCK_META.out_of_stock,
  ];
}

export function pickStockFields(product) {
  const stock = getStockMeta(product?.stockStatus);

  return {
    stockStatus: stock.id,
    stockCheckedAt: product?.stockCheckedAt || null,
  };
}

export function mergeProductStockState(nextItems, existingItems) {
  if (!Array.isArray(nextItems)) {
    return [];
  }

  const existingBySku = new Map();
  const existingByLoc = new Map();

  (existingItems || []).forEach((product) => {
    const stockState = pickStockFields(product);
    const sku = String(product?.sku || '').trim();
    const locKey = `${Number(product?.locId) || 0}|${normaliseSearchText(product?.name || '')}`;

    if (sku) {
      existingBySku.set(sku, stockState);
    }

    if (locKey !== '0|') {
      existingByLoc.set(locKey, stockState);
    }
  });

  return nextItems.map((item) => {
    const sku = String(item?.sku || '').trim();
    const locKey = `${Number(item?.locId) || 0}|${normaliseSearchText(item?.name || '')}`;
    const matchedState = (sku && existingBySku.get(sku)) || existingByLoc.get(locKey);

    return matchedState
      ? {
          ...item,
          ...matchedState,
        }
      : {
          ...item,
          stockStatus: STOCK_META.unchecked.id,
          stockCheckedAt: null,
        };
  });
}

export function formatStockCheckedAt(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
