// Picker Assistant - Version 2.0 (Optimized for Cloudflare)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileUp,
  Hash,
  History,
  Image as ImageIcon,
  LayoutGrid,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  PackageSearch,
  PackageX,
  Search,
  SearchX,
  Settings,
  Trash2,
  Sparkles,
  TableProperties,
  Target,
  UserRound,
  UserPlus,
  Users,
  ShieldCheck,
  Key,
  X,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Loader,
  UploadCloud,
  Tag,
} from 'lucide-react';

import { translations, FONT_OPTIONS } from './translations';
import { MAIN_AISLES, SECONDARY_AISLES, STORAGE_KEY } from './data';
import {
  buildToast,
  formatStockCheckedAt,
  getStockControlOptions,
  getStockMeta,
  mergeProductStockState,
  normaliseExtractedItems,
  normaliseSearchText,
  persistToStorage,
} from './utils';

const ACCENT_COLORS = [
  { id: 'indigo', hex: '#6366f1', rgb: '99, 102, 241', name: 'Indigo' },
  { id: 'blue', hex: '#3b82f6', rgb: '59, 130, 246', name: 'Blue' },
  { id: 'emerald', hex: '#10b981', rgb: '16, 185, 129', name: 'Emerald' },
  { id: 'rose', hex: '#f43f5e', rgb: '244, 63, 94', name: 'Rose' },
  { id: 'amber', hex: '#f59e0b', rgb: '245, 158, 11', name: 'Amber' },
  { id: 'violet', hex: '#8b5cf6', rgb: '139, 92, 246', name: 'Violet' },
  { id: 'teal', hex: '#14b8a6', rgb: '20, 184, 166', name: 'Teal' },
  { id: 'graphite', hex: '#4b5563', rgb: '75, 85, 99', name: 'Graphite' },
];

const STOCK_OPTIONS = getStockControlOptions();
const AUTH_TOKEN_STORAGE_KEY = 'picker-assistant-auth-token';
const LOSS_EXPORT_SHEET_NAME = 'Loss Details';
const LOSS_SUMMARY_SHEET_NAME = 'Summary';

function normaliseLọcIdValue(value) {
  const asNumber = Number(value);

  if (Number.isFinite(asNumber) && asNumber > 0) {
    return String(Math.trunc(asNumber));
  }

  return String(value || '')
    .trim()
    .toLowerCase();
}

function getProductSearchableText(product, masterName = '') {
  const sku = String(product?.sku || '')
    .replace(/\s/g, '')
    .trim();
  const barcode = String(product?.barcode || product?.productId || product?.ean || '')
    .replace(/\s/g, '')
    .trim();
  const productId = String(product?.productId || product?.barcode || product?.ean || '')
    .replace(/\s/g, '')
    .trim();

  return normaliseSearchText(
    `${masterName || product?.name || ''} ${product?.locId || ''} ${sku} ${barcode} ${productId}`,
  );
}

function normaliseProductCode(value) {
  return String(value || '')
    .replace(/\s/g, '')
    .trim()
    .toLowerCase();
}

const MASTER_IMPORT_FIELD_MATCHERS = {
  name: [
    /ten.*sp/, /ten.*hang/, /product.*name/, /item.*name/, /description/, /desc/, /mo ?ta/, 
    /dien.*giai/, /ten.*ba/, /thiet.*bi/, /product/, /display.*name/, /sub.*desc/, /item.*desc/,
    /ten/, /sp/, /name/, /ho.*ten/
  ],
  barcode: [
    /supplier.*barcode/, /supp.*barcode/, /barcode/, /ma.*vach/, /ean/, /upc/, /qr/, /scan/, 
    /ma.*vach.*sp/, /plu/, /gtin/, /^bc$/, /so.*ma/, /ma.*barcode/, /item.*upc/, /ean.*code/,
    /mbarcode/, /sbarcode/, /vendor.*barcode/, /ean.*13/, /upc.*a/, /barcode.*1/, /code.*vach/
  ],
  sku: [
    /item.*code/, /item.*no/, /prod.*code/, /ma.*sp/, /ma.*hang/, /^sku$/, /^code$/, /ma.*hang.*hoa/,
    /masp/, /item.*id/, /art.*id/, /sap/, /internal.*id/, /^id$/, /article/, /prod.*id/, /uuid/, /serial/, 
    /ma.*phu/, /aeon/, /vattu/, /material/, /part.*no/, /maut/
  ],
  division: [
    /div.*cd/, /ma.*div/, /ma.*nganh/, /div.*id/, /madiv/, /manganh/, /ma.*nganh.*hang/, 
    /ma.*phong/, /div.*code/, /^div$/
  ],
  divisionName: [
    /div.*name/, /ten.*div/, /ten.*nganh/, /div.*desc/, /nganh.*hang/, /category/, /cat/, 
    /division/, /ten.*phong/, /nganh/, /l1/
  ],
  department: [
    /dept.*cd/, /ma.*dept/, /ma.*nhom/, /sub.*dept.*cd/, /madept/, /manhom/, /ma.*dept.*id/, 
    /ma.*nhom.*hang/, /dept.*code/, /^dept$/
  ],
  departmentName: [
    /dept.*name/, /ten.*dept/, /ten.*nhom/, /sub.*desc/, /nhom.*hang/, /department/, 
    /phan.*loai/, /ten.*nhom.*hang/, /sub.*cat/, /l2/
  ],
};

function cleanMasterText(value) {
  return String(value || '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** IndexedDB Helpers for Master Data Persistence */
const IDB_DB_NAME = 'PickerAssistantDB';
const IDB_STORE = 'MasterData';

async function idbGetMaster() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 3);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const getReq = store.get('cache');
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function idbGetMasterMeta() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 3);
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const getReq = store.get('meta');
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function idbSetMaster(data, meta) {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, 3);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        if (data) store.put(data, 'cache');
        if (meta) store.put(meta, 'meta');
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      };
      request.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}

function cleanMasterCode(value) {
  let valStr = String(value || '').replace(/\s/g, '').trim();
  // Fix scientific notation for large barcodes (e.g. 8.93E+12, 8E12, 8.9e+12)
  if (/^[0-9](\.[0-9]+)?E\+?[0-9]+$/i.test(valStr)) {
     try {
       const num = Number(valStr);
       if (!Number.isNaN(num) && Number.isFinite(num)) {
         valStr = BigInt(Math.round(num)).toString();
       }
     } catch(e) {
       try {
         valStr = Number(valStr).toFixed(0);
       } catch(e2) {}
     }
  }
  return valStr;
}

function buildMasterLookupKeys(product) {
  return Array.from(
    new Set(
      [
        normaliseProductCode(product?.sku),
        normaliseProductCode(product?.barcode || product?.ean),
        normaliseProductCode(product?.productId || product?.articleId || product?.itemId),
      ].filter(Boolean),
    ),
  );
}

function normaliseMasterProduct(product) {
  const sku = cleanMasterCode(
    product?.sku || product?.itemCode || product?.itemNo || product?.productCode || product?.code,
  );
  const barcode = cleanMasterCode(
    product?.barcode || product?.barCode || product?.ean || product?.upc || product?.qr ||
    product?.aeonCode || product?.internalId
  );
  const productId = cleanMasterCode(
    product?.productId || product?.articleId || product?.itemId || product?.id
  );
  
  const primaryCode = sku || barcode || productId;
  const name = cleanMasterText(product?.name || product?.productName || product?.description);

  const division = cleanMasterText(product?.division || product?.divisionCd || product?.madivision || product?.manganh);
  const divisionName = cleanMasterText(product?.divisionName || product?.tendivision || product?.tennganh);
  const department = cleanMasterText(product?.department || product?.departmentCd || product?.madepartment || product?.manhom);
  const departmentName = cleanMasterText(product?.departmentName || product?.tendepartment || product?.tennhom);

  if (!primaryCode) {
    return null;
  }

  return {
    sku: sku || primaryCode,
    barcode: barcode || productId || '',
    productId: productId || barcode || '',
    name: name || 'Sản phẩm không tên',
    division: division || '',
    divisionName: divisionName || '',
    department: department || '',
    departmentName: departmentName || '',
    searchLabel: `${sku} ${barcode} ${productId} ${name} ${division} ${divisionName} ${department} ${departmentName}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  };
}

function pickPreferredMasterText(currentValue, nextValue) {
  const currentText = cleanMasterText(currentValue);
  const nextText = cleanMasterText(nextValue);
  // Ưu tiên dữ liệu mới từ file
  return nextText || currentText;
}

function pickPreferredMasterCode(currentValue, nextValue) {
  const currentCode = cleanMasterCode(currentValue);
  const nextCode = cleanMasterCode(nextValue);
  // Ưu tiên dữ liệu mới từ file
  return nextCode || currentCode;
}

function mergeMasterProductEntries(currentProduct, nextProduct) {
  return normaliseMasterProduct({
    sku: pickPreferredMasterCode(currentProduct?.sku, nextProduct?.sku),
    barcode: pickPreferredMasterCode(currentProduct?.barcode, nextProduct?.barcode),
    name: pickPreferredMasterText(currentProduct?.name, nextProduct?.name),
    division: pickPreferredMasterCode(currentProduct?.division, nextProduct?.division),
    divisionName: pickPreferredMasterText(currentProduct?.divisionName, nextProduct?.divisionName),
    department: pickPreferredMasterCode(currentProduct?.department, nextProduct?.department),
    departmentName: pickPreferredMasterText(currentProduct?.departmentName, nextProduct?.departmentName),
  });
}

function dedupeMasterProducts(products) {
  if (!Array.isArray(products) || products.length === 0) return [];
  
  const mergedProducts = [];
  const keyToIndex = new Map();

  for (let i = 0, len = products.length; i < len; i++) {
    const product = products[i];
    const skuKey = product.sku ? normaliseProductCode(product.sku) : '';
    const barcodeKey = product.barcode ? normaliseProductCode(product.barcode) : '';
    
    let matchedIndex = -1;
    if (skuKey && keyToIndex.has(skuKey)) {
        matchedIndex = keyToIndex.get(skuKey);
    } else if (barcodeKey && keyToIndex.has(barcodeKey)) {
        matchedIndex = keyToIndex.get(barcodeKey);
    }

    if (matchedIndex !== -1) {
      const current = mergedProducts[matchedIndex];
      // Faster merge
      current.sku = product.sku || current.sku;
      current.barcode = product.barcode || current.barcode;
      current.name = product.name || current.name;
      current.division = product.division || current.division;
      current.divisionName = product.divisionName || current.divisionName;
      current.department = product.department || current.department;
      current.departmentName = product.departmentName || current.departmentName;
      
      if (skuKey) keyToIndex.set(skuKey, matchedIndex);
      if (barcodeKey) keyToIndex.set(barcodeKey, matchedIndex);
    } else {
      const nextIndex = mergedProducts.length;
      mergedProducts.push(product);
      if (skuKey) keyToIndex.set(skuKey, nextIndex);
      if (barcodeKey) keyToIndex.set(barcodeKey, nextIndex);
    }
  }

  return mergedProducts;
}

function normaliseMasterHeader(value) {
  return normaliseSearchText(value);
}

function detectMasterFieldType(headerValue) {
  const normalizedHeader = normaliseMasterHeader(headerValue);
  if (!normalizedHeader) return null;

  const fieldOrder = ['barcode', 'sku', 'name', 'division', 'divisionName', 'department', 'departmentName'];
  
  for (const field of fieldOrder) {
    const matchers = MASTER_IMPORT_FIELD_MATCHERS[field];
    for (let priority = 0; priority < matchers.length; priority++) {
      if (matchers[priority].test(normalizedHeader)) {
        return { field, priority };
      }
    }
  }
  return null;
}

function detectMasterHeaderConfig(rows) {
  let bestConfig = null;
  const scanLimit = Math.min(rows.length, 300);

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    if (row.length < 2) continue;

    const columns = {};
    row.forEach((cellValue, cellIndex) => {
      const match = detectMasterFieldType(cellValue);
      if (match) {
        const { field, priority } = match;
        // If we haven't found this field yet, or we found a higher-priority match (lower priority number)
        if (columns[field] === undefined || priority < columns[field].priority) {
          columns[field] = { index: cellIndex, priority };
        }
      }
    });

    // Convert back to simple index for core logic, but keep the columns structure
    const finalColumns = {};
    Object.keys(columns).forEach(key => {
      finalColumns[key] = columns[key].index;
    });
    
    // Use finalColumns for the rest of validation in this loop
    const matchedFields = Object.keys(finalColumns);
    const hasCodeColumn = ['sku', 'barcode'].some((field) => Number.isInteger(finalColumns[field]));

    if (!hasCodeColumn || matchedFields.length < 2) {
      continue;
    }

    const score = matchedFields.length * 2 + (matchedFields.includes('sku') && matchedFields.includes('barcode') ? 2 : 0);

    if (!bestConfig || score > bestConfig.score) {
      bestConfig = {
        headerRowIndex: rowIndex,
        columns: finalColumns,
        score,
      };
    }
    
    if (score >= 10) break;
  }

  return bestConfig;
}

function extractMasterProductsFromWorkbook(workbook, XLSX) {
  const mergedProducts = [];
  const keyToIndex = new Map();
  let detectedColumnsInfo = '';

  (workbook?.SheetNames || []).forEach((sheetName) => {
    const worksheet = workbook?.Sheets?.[sheetName];
    if (!worksheet) return;

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
    const headerConfig = detectMasterHeaderConfig(rows);

    if (!headerConfig) return;

    const foundFields = Object.keys(headerConfig.columns);
    console.log(`[Import] Found headers in "${sheetName}":`, headerConfig.columns);
    
    if (!detectedColumnsInfo) {
       detectedColumnsInfo = `Các cột tìm thấy: ${foundFields.join(', ')}`;
    }

    const { columns, headerRowIndex } = headerConfig;

    for (let i = headerRowIndex + 1, len = rows.length; i < len; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const normalizedProduct = normaliseMasterProduct({
        sku: columns.sku !== undefined ? row[columns.sku] : '',
        barcode: columns.barcode !== undefined ? row[columns.barcode] : '',
        name: columns.name !== undefined ? row[columns.name] : '',
        division: columns.division !== undefined ? row[columns.division] : '',
        divisionName: columns.divisionName !== undefined ? row[columns.divisionName] : '',
        department: columns.department !== undefined ? row[columns.department] : '',
        departmentName: columns.departmentName !== undefined ? row[columns.departmentName] : '',
      });

      if (!normalizedProduct) continue;

      const skuKey = normaliseProductCode(normalizedProduct.sku);
      const barcodeKey = normaliseProductCode(normalizedProduct.barcode);
      
      let matchedIndex = -1;
      if (skuKey && keyToIndex.has(skuKey)) {
          matchedIndex = keyToIndex.get(skuKey);
      } else if (barcodeKey && keyToIndex.has(barcodeKey)) {
          matchedIndex = keyToIndex.get(barcodeKey);
      }

      if (matchedIndex !== -1) {
        const current = mergedProducts[matchedIndex];
        current.sku = normalizedProduct.sku || current.sku;
        current.barcode = normalizedProduct.barcode || current.barcode;
        current.name = normalizedProduct.name || current.name;
        current.division = normalizedProduct.division || current.division;
        current.divisionName = normalizedProduct.divisionName || current.divisionName;
        current.department = normalizedProduct.department || current.department;
        current.departmentName = normalizedProduct.departmentName || current.departmentName;
        if (skuKey) keyToIndex.set(skuKey, matchedIndex);
        if (barcodeKey) keyToIndex.set(barcodeKey, matchedIndex);
      } else {
        const nextIndex = mergedProducts.length;
        mergedProducts.push(normalizedProduct);
        if (skuKey) keyToIndex.set(skuKey, nextIndex);
        if (barcodeKey) keyToIndex.set(barcodeKey, nextIndex);
      }
    }
  });

  return { 
    products: mergedProducts, 
    info: detectedColumnsInfo 
  };
}

function makeLossPeriodLabel(date = new Date()) {
  const safeDate = date instanceof Date ? date : new Date(date);
  const stamp = Number.isNaN(safeDate.getTime())
    ? new Date()
    : safeDate;

  return `Kỳ kiểm loss ${new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(stamp)}`;
}

function makeSafeFileNameSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normaliseCountInput(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const nextValue = Number.parseInt(String(value), 10);

  if (!Number.isFinite(nextValue) || nextValue < 0) {
    return 0;
  }

  return nextValue;
}

function getCountValue(value) {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && asNumber > 0 ? Math.trunc(asNumber) : 0;
}

function computeLossValue(systemStock, actualStock) {
  return Math.max(0, getCountValue(systemStock) - getCountValue(actualStock));
}

function fetchJsonWithTimeout(url, options = {}, timeoutMs = 300000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function mergeVisualCache(existingCache, incomingVisualMeta) {
  const currentCache = existingCache && typeof existingCache === 'object' ? existingCache : {};
  const nextMeta = incomingVisualMeta && typeof incomingVisualMeta === 'object' ? incomingVisualMeta : {};
  const merged = {};

  Object.entries(nextMeta).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') {
      return;
    }

    const cachedVisual = currentCache[key];
    const incomingUpdatedAt = String(value.updatedAt || '');
    const cachedUpdatedAt = String(cachedVisual?.updatedAt || '');
    const canReuseCachedSource = Boolean(
      cachedVisual?.src &&
        (!incomingUpdatedAt || !cachedUpdatedAt || incomingUpdatedAt === cachedUpdatedAt),
    );

    merged[key] = canReuseCachedSource
      ? {
          ...value,
          ...cachedVisual,
          hasSource: true,
        }
      : value;
  });

  return merged;
}

function triggerBarcodeScanFeedback() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      return navigator.vibrate([220, 80, 160]);
    }
  } catch {}

  return false;
}

function getLossItemMetrics(item) {
  const systemStock = getCountValue(item?.systemStock);
  const actualStock = getCountValue(item?.actualStock);
  const fallbackLoss = getCountValue(item?.quantity);
  const lossQuantity = Math.max(
    0,
    Number.isFinite(Number(item?.lossQuantity))
      ? Math.trunc(Number(item.lossQuantity))
      : computeLossValue(systemStock, actualStock) || fallbackLoss,
  );

  return {
    systemStock,
    actualStock,
    lossQuantity,
  };
}

function HighlightText({ text, highlight }) {
  if (!text) {
    return null;
  }

  const value = String(text);

  if (!highlight || highlight.trim().length < 2) {
    return <span>{value}</span>;
  }

  try {
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = value.split(new RegExp(`(${escaped})`, 'gi'));

    return (
      <span>
        {parts.map((part, index) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={`${part}-${index}`} className="search-highlight">
              {part}
            </mark>
          ) : (
            <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
          ),
        )}
      </span>
    );
  } catch {
    return <span>{value}</span>;
  }
}

function PlanogramPreview({
  visual,
  highlightedLọcIds,
  showAllMarkers = false,
  enableMagnifier = false,
}) {
  if (!visual?.src) {
    return (
      <section className="planogram-card planogram-card-empty">
        <div className="planogram-empty-icon">
          <ImageIcon size={28} />
        </div>
      </section>
    );
  }

  const highlighted = new Set((highlightedLọcIds || []).map(normaliseLọcIdValue));
  const isLegacyMarkerSet = !visual.version || visual.version < 2;
  const markers = Array.isArray(visual.markers) ? visual.markers : [];
  const markerEntries = markers
    .map((marker, index) => {
      const rawY = Number(marker?.y);
      const rawX = Number(marker?.x);

      if (!Number.isFinite(rawY) || !Number.isFinite(rawX)) {
        return null;
      }

      const normalizedY = isLegacyMarkerSet ? 1 - rawY : rawY;
      const markerLọcKey = normaliseLọcIdValue(marker.locId);
      const isHighlighted = highlighted.has(markerLọcKey);

      return {
        marker,
        markerLọcKey,
        normalizedY,
        x: rawX,
        isHighlighted,
        emphasis: marker.emphasis || 1,
        key: `${markerLọcKey}-${rawX}-${rawY}-${index}`,
      };
    })
    .filter(Boolean);
  const markerYs = markerEntries.map((entry) => entry.normalizedY);
  const minMarkerY = markerYs.length > 0 ? Math.min(...markerYs) : 0;
  const maxMarkerY = markerYs.length > 0 ? Math.max(...markerYs) : 1;
  const rawCropBottom = markerYs.length > 0
    ? Math.min(1, Math.max(0.72, maxMarkerY + 0.14))
    : 1;
  const cropBottom = rawCropBottom > 0.97 ? 1 : rawCropBottom;
  const autoCropTop = markerYs.length > 0
    ? Math.max(0, Math.min(0.62, minMarkerY - 0.22))
    : 0;
  const cropTopFromVisual = Number(visual.cropTop);
  const rawCropTop = Number.isFinite(cropTopFromVisual)
    ? Math.max(0, Math.min(cropTopFromVisual, 0.8))
    : autoCropTop;
  const cropTop = rawCropTop >= cropBottom - 0.26 ? Math.max(0, cropBottom - 0.26) : rawCropTop;
  const cropSpan = Math.max(0.26, cropBottom - cropTop);
  const stageRef = useRef(null);
  const [lensState, setLensState] = useState({
    active: false,
    x: 0.5,
    y: 0.5,
    width: 0,
    height: 0,
  });
  const visualWidth = Number(visual.width) || 4;
  const visualHeight = Number(visual.height) || 3;
  const lensSize = 178;
  const lensZoom = 2.4;

  function updateLensPosition(event) {
    if (!enableMagnifier || event.pointerType === 'touch') {
      return;
    }

    const stageElement = stageRef.current;

    if (!stageElement) {
      return;
    }

    const rect = stageElement.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const nextX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const nextY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    setLensState({
      active: true,
      x: nextX,
      y: nextY,
      width: rect.width,
      height: rect.height,
    });
  }

  function hideLens() {
    setLensState((previous) => ({
      ...previous,
      active: false,
    }));
  }

  const fullImageHeight = lensState.height > 0 ? lensState.height / cropSpan : 0;
  const focusX = lensState.x * lensState.width;
  const focusY = (cropTop + lensState.y * cropSpan) * fullImageHeight;
  const backgroundWidth = lensState.width * lensZoom;
  const backgroundHeight = fullImageHeight * lensZoom;
  const backgroundX = lensSize / 2 - focusX * lensZoom;
  const backgroundY = lensSize / 2 - focusY * lensZoom;
  const lensMarkers =
    enableMagnifier && lensState.active && lensState.width > 0 && fullImageHeight > 0
      ? markerEntries
          .filter((entry) => showAllMarkers || entry.isHighlighted)
          .map((entry) => {
            const markerPixelX = entry.x * lensState.width;
            const markerPixelY = entry.normalizedY * fullImageHeight;

            return {
              ...entry,
              lensX: lensSize / 2 + (markerPixelX - focusX) * lensZoom,
              lensY: lensSize / 2 + (markerPixelY - focusY) * lensZoom,
            };
          })
      : [];
  const lensStyle = {
    left: `${lensState.x * 100}%`,
    top: `${lensState.y * 100}%`,
  };
  const lensImageStyle = {
    backgroundImage: `url(${visual.src})`,
    backgroundSize: `${backgroundWidth}px ${backgroundHeight}px`,
    backgroundPosition: `${backgroundX}px ${backgroundY}px`,
  };
  const stageStyle = {
    '--pog-ratio': `${visualWidth} / ${visualHeight * cropSpan}`,
    '--pog-crop-top': String(cropTop),
    '--pog-crop-bottom': String(cropBottom),
    '--pog-crop-span': String(cropSpan),
  };

  return (
    <section className="planogram-card">
      <div
        className={`planogram-stage ${cropSpan < 0.99 ? 'is-bottom-cropped' : ''}`}
        style={stageStyle}
        ref={stageRef}
        onPointerEnter={updateLensPosition}
        onPointerMove={updateLensPosition}
        onPointerLeave={hideLens}
        onPointerCancel={hideLens}
      >
        <img src={visual.src} alt="Planogram" className="planogram-image" />
        {enableMagnifier && lensState.active ? (
          <div className="planogram-magnifier" style={lensStyle}>
            <div className="planogram-magnifier-image" style={lensImageStyle} />
            <div className="planogram-magnifier-overlay">
              {lensMarkers.map((entry) => (
                <div
                  key={`lens-${entry.key}`}
                  className={`planogram-marker planogram-marker-lens ${
                    entry.isHighlighted ? 'is-highlighted' : 'is-passive'
                  }`}
                  style={{
                    left: `${entry.lensX}px`,
                    top: `${entry.lensY}px`,
                    '--marker-scale': entry.emphasis,
                  }}
                  title={`Lọc ${entry.markerLọcKey}`}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="planogram-overlay">
          {markerEntries.map((entry) => {
            const isHighlighted = entry.isHighlighted;
            const shouldRender = showAllMarkers || isHighlighted;

            if (!shouldRender) {
              return null;
            }

            return (
              <div
                key={entry.key}
                className={`planogram-marker ${isHighlighted ? 'is-highlighted' : 'is-passive'}`}
                style={{
                  left: `${entry.x * 100}%`,
                  top: `${entry.normalizedY * 100}%`,
                  '--marker-scale': entry.emphasis,
                }}
                title={`Lọc ${entry.markerLọcKey}`}
              >
                <span>{entry.marker.locId}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [aisleProducts, setAisleProducts] = useState({});
  const [aisleVisuals, setAisleVisuals] = useState({});
  const [aisleNames, setAisleNames] = useState({});
  const [lossAudits, setLossAudits] = useState([]);
  const [masterProducts, setMasterProducts] = useState([]);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [masterSearchTerm, setMasterSearchTerm] = useState('');
  const [masterSearchInput, setMasterSearchInput] = useState('');
  const [masterPage, setMasterPage] = useState(1);
  const [selectedMasterSkus, setSelectedMasterSkus] = useState(new Set());
  const ITEMS_PER_MASTER_PAGE = 100;
  const [isImportingMaster, setIsImportingMaster] = useState(false);
  const [isExportingMaster, setIsExportingMaster] = useState(false);
  const masterImportRef = useRef(null);
  const [isSharedLoading, setIsSharedLoading] = useState(true);
  const [loadingVisualKey, setLoadingVisualKey] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [language, setLanguage] = useState(() => localStorage.getItem('lang') || 'vi');
  const [selectedFont, setSelectedFont] = useState(() => localStorage.getItem('appFont') || 'Nunito');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('appAccentColor') || '#6366f1');
  const [showSettings, setShowSettings] = useState(false);
  const [isMasterLoading, setIsMasterLoading] = useState(false);
  const [hasLoadedMaster, setHasLoadedMaster] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font', `'${selectedFont}'`);
    localStorage.setItem('appFont', selectedFont);
  }, [selectedFont]);

  useEffect(() => {
    localStorage.setItem('appAccentColor', accentColor);
    document.documentElement.style.setProperty('--accent-primary', accentColor);
    
    const selected = ACCENT_COLORS.find(c => c.hex === accentColor);
    if (selected?.rgb) {
      document.documentElement.style.setProperty('--accent-rgb', selected.rgb);
    }
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  const [isCompactView, setIsCompactView] = useState(() => window.innerWidth <= 760);
  const [isWideDesktopView, setIsWideDesktopView] = useState(() => window.innerWidth > 1180);
  const [activeModule, setActiveModule] = useState('pog');
  const [mobileMapSection, setMobileMapSection] = useState('main');
  const [selectedId, setSelectedId] = useState('L12-A');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [focusedLọcId, setFocusedLọcId] = useState(null);
  const [lossSearchTerm, setLossSearchTerm] = useState('');
  const [lossSearchInput, setLossSearchInput] = useState('');
  const [lossBarcodeInput, setLossBarcodeInput] = useState('');
  const [checkStockSearchTerm, setCheckStockSearchTerm] = useState('');
  const [checkStockSearchInput, setCheckStockSearchInput] = useState('');
  const [checkStockBarcodeInput, setCheckStockBarcodeInput] = useState('');
  const [lossPeriodName, setLossPeriodName] = useState(() => makeLossPeriodLabel());
  const [lossDraftItems, setLossDraftItems] = useState([]);
  const [isSavingLossAudit, setIsSavingLossAudit] = useState(false);
  const [isExportingLossFile, setIsExportingLossFile] = useState(false);
  const [isExportingStockFile, setIsExportingStockFile] = useState(false);
  const [isImportingStockFile, setIsImportingStockFile] = useState(false);
  const stockImportInputRef = useRef(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isScannerStarting, setIsScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scanResult, setScanResult] = useState(null); // { barcode, sku, name, systemStock, division, department, found }
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState('unknown');
  const [toast, setToast] = useState(null);
  const [showManagePogModal, setShowManagePogModal] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '');
  const [authUser, setAuthUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showManageUsersModal, setShowManageUsersModal] = useState(false);
  const [accountTab, setAccountTab] = useState('profile'); // 'profile' or 'members'
  const [usersList, setUsersList] = useState([]);
  const [isManagingUsers, setIsManagingUsers] = useState(false);
  const [savingStockKey, setSavingStockKey] = useState('');

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiStep, setAiStep] = useState(1);
  const [targetLine, setTargetLine] = useState('L17');
  const [targetSide, setTargetSide] = useState('A');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const [extractedVisual, setExtractedVisual] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [tempAisleName, setTempAisleName] = useState('');
  const [isRenamingAisle, setIsRenamingAisle] = useState(false);
  const [highlightedCategory, setHighlightedCategory] = useState(null);
  const scannerVideoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const scannerReaderRef = useRef(null);
  const scannerStreamRef = useRef(null);
  const scannerFrameRef = useRef(0);
  const scannerTimeoutRef = useRef(0);
  const lastScannedBarcodeRef = useRef('');

  const filteredMasterProducts = useMemo(() => {
    if (!masterSearchTerm) return masterProducts;
    const term = normaliseSearchText(masterSearchTerm);
    return masterProducts.filter(p => p.searchLabel?.includes(term) || normaliseProductCode(p.sku).includes(term));
  }, [masterProducts, masterSearchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => setMasterSearchTerm(masterSearchInput), 500);
    return () => clearTimeout(timer);
  }, [masterSearchInput]);

  useEffect(() => {
    const timer = setTimeout(() => setLossSearchTerm(lossSearchInput), 500);
    return () => clearTimeout(timer);
  }, [lossSearchInput]);

  useEffect(() => {
    const timer = setTimeout(() => setCheckStockSearchTerm(checkStockSearchInput), 500);
    return () => clearTimeout(timer);
  }, [checkStockSearchInput]);
  const scannerFeedbackAudioContextRef = useRef(null);
  const [desktopDrawerWidth, setDesktopDrawerWidth] = useState(() => {
    const preferredWidth = Math.round(window.innerWidth * 0.38);
    return Math.min(Math.max(preferredWidth, 420), 780);
  });
  const [isDesktopResizing, setIsDesktopResizing] = useState(false);

  const allLines = useMemo(() => {
    const main = MAIN_AISLES.map((aisle) => ({
      ...aisle,
      name: aisleNames[aisle.id] || aisle.name,
    }));
    const secondary = SECONDARY_AISLES.map((aisle) => ({
      ...aisle,
      name: aisleNames[aisle.id] || aisle.name,
    }));
    return [...main, ...secondary];
  }, [aisleNames]);

  const groupedMainAisles = useMemo(() => {
    const main = allLines.filter((a) => MAIN_AISLES.some((m) => m.id === a.id));
    const groups = {};
    main.forEach((aisle) => {
      const cat = aisle.cat || 'Khác';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(aisle);
    });
    return groups;
  }, [allLines]);

  const groupedSecondaryAisles = useMemo(() => {
    const secondary = allLines.filter((a) => SECONDARY_AISLES.some((s) => s.id === a.id));
    const groups = {};
    secondary.forEach((aisle) => {
      const cat = aisle.cat || 'Khác';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(aisle);
    });
    return groups;
  }, [allLines]);

  const masterLookup = useMemo(() => {
    const map = new Map();
    (masterProducts || []).forEach((product) => {
      const normalizedProduct = normaliseMasterProduct(product);

      if (!normalizedProduct) {
        return;
      }

      buildMasterLookupKeys(normalizedProduct).forEach((key) => {
        map.set(key, normalizedProduct);
      });
    });
    return map;
  }, [masterProducts]);

  const resolveProductName = useCallback((product) => {
    if (!product) return '';

    const masterMatch = buildMasterLookupKeys(product)
      .map((key) => masterLookup.get(key))
      .find(Boolean);

    if (masterMatch && masterMatch.name) {
      return masterMatch.name;
    }
    return product.name || '';
  }, [masterLookup]);

  const searchKeyword = useMemo(() => normaliseSearchText(searchTerm), [searchTerm]);
  const lossSearchKeyword = useMemo(() => normaliseSearchText(lossSearchTerm), [lossSearchTerm]);
  const userLabel = authUser?.displayName || authUser?.username || 'Tài khoản';
  const isReadOnly = !authUser;
  const authPermissions = authUser?.permissions || {};
  const isAdminAccount = authUser?.role === 'admin';
  const canEditPog = Boolean(authUser && (isAdminAccount || authPermissions.pog !== false));
  const canUseLossTools = Boolean(authUser && (isAdminAccount || authPermissions.loss !== false));
  const canUseStockTools = Boolean(authUser && (isAdminAccount || authPermissions.stock !== false));
  const canManageAccounts = Boolean(authUser && (isAdminAccount || authPermissions.adminUsers === true));

  const t = (key, ...args) => {
    if (!key) return '';
    const val = translations[language]?.[key] ?? translations['vi']?.[key] ?? translations['en']?.[key] ?? key;
    if (typeof val === 'function') {
      try {
        const result = val(...args);
        return result !== undefined ? result : key;
      } catch (e) {
        console.error(`Translation error for key "${key}":`, e);
        return key;
      }
    }
    return val !== undefined ? val : key;
  };
  const manageAccountsLabel = language === 'en' ? 'Manage Accounts' : 'Quản lý tài khoản';
  const accountsTabLabel = language === 'en' ? 'Accounts' : 'Tài khoản';
  const createAccountLabel = language === 'en' ? 'Create account' : 'Tạo tài khoản';
  const accountListLabel = language === 'en' ? 'Account list' : 'Danh sách tài khoản';

  const topbarSearchValue = activeModule === 'pog' 
    ? searchTerm 
    : activeModule === 'stock'
      ? checkStockSearchTerm
      : lossSearchTerm;

  const topbarSearchPlaceholder =
    activeModule === 'pog'
      ? t('searchPogPlaceholder')
      : activeModule === 'stock'
        ? t('searchStockPlaceholder')
        : t('searchLossPlaceholder');

  const handleTopbarSearchChange = (value) => {
    if (activeModule === 'pog') {
      setSearchTerm(value);
    } else if (activeModule === 'stock') {
      setCheckStockSearchTerm(value);
    } else {
      setLossSearchTerm(value);
    }
  };

  function clampDesktopDrawerWidth(nextWidth) {
    const minWidth = 360;
    const maxWidth = Math.max(minWidth, Math.min(920, window.innerWidth - 280));
    return Math.min(Math.max(nextWidth, minWidth), maxWidth);
  }

  async function ensureScannerFeedbackAudioReady() {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    let audioContext = scannerFeedbackAudioContextRef.current;

    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioContextCtor();
      scannerFeedbackAudioContextRef.current = audioContext;
    }

    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch {}
    }

    return audioContext;
  }

  function playScannerFeedbackTone() {
    const audioContext = scannerFeedbackAudioContextRef.current;

    if (!audioContext || audioContext.state !== 'running') {
      return;
    }

    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const startAt = audioContext.currentTime;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1046, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(1318, startAt + 0.08);

      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(0.06, startAt + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.18);
    } catch {}
  }

  const selectedShelf = useMemo(() => {
    if (!selectedId) {
      return null;
    }

    const [lineId, side] = selectedId.split('-');
    const shelf = allLines.find((item) => item.id === lineId);

    if (!shelf) {
      return null;
    }

    return {
      ...shelf,
      side,
      data: {
        products: (aisleProducts[selectedId] || []).map(p => ({
          ...p,
          displayName: resolveProductName(p)
        })),
        visual: aisleVisuals[selectedId] || null,
      },
    };
  }, [aisleProducts, aisleVisuals, allLines, resolveProductName, selectedId]);

  const globalMatches = useMemo(() => {
    if (!searchKeyword) {
      return [];
    }

    return Object.entries(aisleProducts).flatMap(([lineKey, products]) =>
      (products || [])
        .filter((product) => {
          return getProductSearchableText(product, resolveProductName(product)).includes(searchKeyword);
        })
        .map((product) => ({
          lineKey,
          product,
        })),
    );
  }, [aisleProducts, resolveProductName, searchKeyword]);

  const matchedProducts = useMemo(() => {
    if (!selectedShelf || !searchKeyword) {
      return [];
    }

    return selectedShelf.data.products.filter((product) => {
      return getProductSearchableText(product, product.displayName).includes(searchKeyword);
    });
  }, [searchKeyword, selectedShelf]);

  const visibleProducts = useMemo(() => {
    if (!selectedShelf) {
      return [];
    }

    if (!searchKeyword) {
      return selectedShelf.data.products;
    }

    const matched = [];
    const unmatched = [];

    selectedShelf.data.products.forEach((product) => {
      if (getProductSearchableText(product, product.displayName).includes(searchKeyword)) {
        matched.push(product);
      } else {
        unmatched.push(product);
      }
    });

    return [...matched, ...unmatched];
  }, [searchKeyword, selectedShelf]);

  const highlightedLọcIds = useMemo(() => {
    const locIds = new Map();

    matchedProducts.forEach((product) => {
      const key = normaliseLọcIdValue(product.locId);

      if (key) {
        locIds.set(key, product.locId);
      }
    });

    if (focusedLọcId) {
      const focusedKey = normaliseLọcIdValue(focusedLọcId);

      if (focusedKey) {
        locIds.set(focusedKey, focusedLọcId);
      }
    }

    return Array.from(locIds.values());
  }, [focusedLọcId, matchedProducts]);

  const selectedStockSummary = useMemo(() => {
    const summary = {
      total: selectedShelf?.data.products.length || 0,
      checked: 0,
      unchecked: 0,
      in_stock: 0,
      low_stock: 0,
      out_of_stock: 0,
    };

    (selectedShelf?.data.products || []).forEach((product) => {
      const stockId = getStockMeta(product?.stockStatus).id;
      summary[stockId] += 1;
    });

    summary.checked = summary.in_stock + summary.low_stock + summary.out_of_stock;
    return summary;
  }, [selectedShelf]);

  const totalLineWithData = useMemo(() => {
    return Object.values(aisleProducts).filter((products) => Array.isArray(products) && products.length > 0).length;
  }, [aisleProducts]);

  const totalSkuCount = useMemo(() => {
    return Object.values(aisleProducts).reduce((total, products) => {
      return total + (Array.isArray(products) ? products.length : 0);
    }, 0);
  }, [aisleProducts]);

  const productCodeLookup = useMemo(() => {
    const lookup = new Map();

    (masterProducts || []).forEach((product) => {
      const normalizedProduct = normaliseMasterProduct(product);

      if (!normalizedProduct) {
        return;
      }

      const entry = {
        lineKey: '',
        locId: '',
        name: normalizedProduct.name,
        sku: normalizedProduct.sku,
        barcode: normalizedProduct.barcode,
        productId: normalizedProduct.productId,
        division: normalizedProduct.division,
        divisionName: normalizedProduct.divisionName,
        department: normalizedProduct.department,
        departmentName: normalizedProduct.departmentName,
        stockStatus: 'unchecked',
      };

      buildMasterLookupKeys(normalizedProduct).forEach((code) => {
        lookup.set(code, entry);
      });
    });

    Object.entries(aisleProducts).forEach(([lineKey, products]) => {
      (products || []).forEach((product) => {
        const normalizedProduct = normaliseMasterProduct(product);

        if (!normalizedProduct) {
          return;
        }

        const entry = {
          lineKey,
          locId: product?.locId,
          name: resolveProductName(product),
          sku: normalizedProduct.sku,
          barcode: normalizedProduct.barcode,
          productId: normalizedProduct.productId,
          division: normalizedProduct.division,
          divisionName: normalizedProduct.divisionName,
          department: normalizedProduct.department,
          departmentName: normalizedProduct.departmentName,
          stockStatus: getStockMeta(product?.stockStatus).id,
        };

        buildMasterLookupKeys(normalizedProduct).forEach((code) => {
          lookup.set(code, entry);
        });
      });
    });

    return lookup;
  }, [aisleProducts, masterProducts, resolveProductName]);

  const allStockProducts = useMemo(() => {
    const productsList = [];
    Object.entries(aisleProducts).forEach(([lineKey, products]) => {
      (products || []).forEach((product) => {
        const sku = String(product?.sku || '').trim();
        const barcode = String(product?.barcode || product?.productId || product?.sku || '').trim();
        const displayName = resolveProductName(product);
        
        const matchingDraft = lossDraftItems.find(
          (item) =>
            (item.sku && String(item.sku).trim() === sku) ||
            (item.barcode && String(item.barcode).trim() === barcode)
        );

        const actualStockFromLoss = matchingDraft ? matchingDraft.actualStock : '--';
        
        productsList.push({
          ...product,
          name: displayName || product?.name || '',
          lineKey,
          barcodeView: barcode,
          actualStockFromLoss,
          displayName,
        });
      });
    });

    productsList.sort((a, b) => {
      const nameA = String(a.displayName || a.name || '').toLowerCase();
      const nameB = String(b.displayName || b.name || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    return productsList;
  }, [aisleProducts, lossDraftItems, resolveProductName]);

  const filteredStockProducts = useMemo(() => {
    if (!checkStockSearchTerm || checkStockSearchTerm.trim() === '') {
      return [];
    }

    const searchInput = String(checkStockSearchTerm);
    const rawKeyword = normaliseProductCode(searchInput);
    const keyword = normaliseSearchText(searchInput);

    // 1. Try to find EXACT match by SKU or Barcode in Aisle first
    const exactAisleMatches = allStockProducts.filter(p => 
      normaliseProductCode(p.sku) === rawKeyword || 
      normaliseProductCode(p.barcodeView) === rawKeyword ||
      normaliseProductCode(p.productId) === rawKeyword
    );

    if (exactAisleMatches.length > 0) {
      return exactAisleMatches.map(product => ({
        ...product,
        // Use normalized key for lookup
        masterInfo: product.masterInfo || masterLookup.get(normaliseProductCode(product.sku)) || masterLookup.get(normaliseProductCode(product.barcodeView))
      }));
    }

    // 2. Exact match in Master Data
    const exactMasterMatches = masterProducts.filter(m => 
       normaliseProductCode(m.sku) === rawKeyword || 
       normaliseProductCode(m.barcode) === rawKeyword
    );

    if (exactMasterMatches.length > 0) {
      return exactMasterMatches.map(m => ({
          sku: m.sku, 
          barcode: m.barcode, 
          barcodeView: m.barcode,
          name: m.name, 
          displayName: m.name,
          locId: 'Master',
          lineKey: '-',
          isFromMasterOnly: true,
          masterInfo: m,
          systemStock: 0,
          actualStockFromLoss: '--',
          stockStatus: 'unchecked'
      }));
    }

    // 3. Fallback: Fuzzy search in Aisle
    const fuzzyAisleMatches = allStockProducts.filter((product) => {
      const text = normaliseSearchText(
        `${product.sku} ${product.barcodeView} ${product.productId || ''} ${product.displayName || product.name || ''}`,
      );
      return text.includes(keyword);
    });

    if (fuzzyAisleMatches.length > 0) {
      return fuzzyAisleMatches.map(product => ({
        ...product,
        masterInfo: product.masterInfo || masterLookup.get(product.sku) || masterLookup.get(product.barcodeView)
      }));
    }

    // 4. Fallback: Fuzzy search in Master
    const fuzzyMasterMatches = masterProducts.filter(m => 
      normaliseSearchText(`${m.sku} ${m.barcode} ${m.name}`).includes(keyword)
    ).slice(0, 1).map(m => ({ 
      sku: m.sku, 
      barcode: m.barcode, 
      barcodeView: m.barcode,
      name: m.name, 
      displayName: m.name,
      locId: 'Master',
      lineKey: '-',
      isFromMasterOnly: true,
      masterInfo: m,
      systemStock: 0,
      actualStockFromLoss: '--',
      stockStatus: 'unchecked'
    }));

    return fuzzyMasterMatches;
  }, [allStockProducts, masterProducts, masterLookup, checkStockSearchTerm]);

  const filteredLossDraftItems = useMemo(() => {
    if (!lossSearchKeyword) {
      return lossDraftItems;
    }

    return lossDraftItems.filter((item) => {
      const metrics = getLossItemMetrics(item);
      const searchable = normaliseSearchText(
        `${item?.barcode || ''} ${item?.productId || ''} ${item?.sku || ''} ${item?.name || ''} ${item?.lineKey || ''} ${item?.locId || ''} ${metrics.systemStock} ${metrics.actualStock} ${metrics.lossQuantity}`,
      );
      return searchable.includes(lossSearchKeyword);
    });
  }, [lossDraftItems, lossSearchKeyword]);

  const filteredLossAudits = useMemo(() => {
    if (!lossSearchKeyword) {
      return lossAudits;
    }

    return lossAudits.filter((audit) => {
      const summaryText = normaliseSearchText(
        `${audit?.periodName || ''} ${audit?.createdByName || ''} ${audit?.itemCount || ''} ${
          audit?.totalLossQuantity || audit?.totalQuantity || ''
        } ${audit?.totalSystemStock || ''} ${audit?.totalActualStock || ''}`,
      );

      if (summaryText.includes(lossSearchKeyword)) {
        return true;
      }

      return (audit?.items || []).some((item) => {
        const metrics = getLossItemMetrics(item);
        const searchable = normaliseSearchText(
          `${item?.barcode || ''} ${item?.productId || ''} ${item?.sku || ''} ${item?.name || ''} ${item?.lineKey || ''} ${item?.locId || ''} ${metrics.systemStock} ${metrics.actualStock} ${metrics.lossQuantity}`,
        );
        return searchable.includes(lossSearchKeyword);
      });
    });
  }, [lossAudits, lossSearchKeyword]);

  const lossDraftSummary = useMemo(() => {
    return {
      totalItems: lossDraftItems.length,
      totalLoss: lossDraftItems.reduce((total, item) => {
        return total + getLossItemMetrics(item).lossQuantity;
      }, 0),
      totalSystemStock: lossDraftItems.reduce((total, item) => {
        return total + getLossItemMetrics(item).systemStock;
      }, 0),
      totalActualStock: lossDraftItems.reduce((total, item) => {
        return total + getLossItemMetrics(item).actualStock;
      }, 0),
    };
  }, [lossDraftItems]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function syncViewportMode() {
      setIsCompactView(window.innerWidth <= 760);
      setIsWideDesktopView(window.innerWidth > 1180);
      setDesktopDrawerWidth((current) => clampDesktopDrawerWidth(current));
    }

    syncViewportMode();
    window.addEventListener('resize', syncViewportMode);

    return () => {
      window.removeEventListener('resize', syncViewportMode);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncCameraPermission() {
      if (!window.isSecureContext || !navigator?.mediaDevices?.getUserMedia) {
        setCameraPermissionState('unsupported');
        return;
      }

      try {
        if (navigator?.permissions?.query) {
          const status = await navigator.permissions.query({ name: 'camera' });

          if (cancelled) {
            return;
          }

          setCameraPermissionState(status.state);
          status.onchange = () => {
            setCameraPermissionState(status.state);
          };
          return;
        }
      } catch {}

      if (!cancelled) {
        setCameraPermissionState('prompt');
      }
    }

    syncCameraPermission();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      document.body.classList.remove('layout-resizing');
    };
  }, []);

  useEffect(() => {
    return () => {
      stopBarcodeScannerSession();
    };
  }, []);

  useEffect(() => {
    if (!showBarcodeScanner) {
      stopBarcodeScannerSession();
      return undefined;
    }

    let cancelled = false;

    startBarcodeScannerSession().catch((error) => {
      if (cancelled) {
        return;
      }

      setScannerError(error?.message || 'Khong mo duoc camera quet barcode.');
      setIsScannerStarting(false);
    });

    return () => {
      cancelled = true;
      stopBarcodeScannerSession();
    };
  }, [showBarcodeScanner]);

  useEffect(() => {
    setFocusedLọcId(null);
  }, [selectedId, searchTerm]);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!authToken) {
        setAuthUser(null);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn.');
        }

        if (!response.ok) {
          throw new Error(`Không thể xác thực tài khoản (${response.status}).`);
        }

        const data = await response.json();

        if (!active) {
          return;
        }

        setAuthUser(data?.user || null);
      } catch (error) {
        if (!active) {
          return;
        }

        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        setAuthToken('');
        setAuthUser(null);
        setToast(buildToast('error', error.message || t('errSessionExpired')));
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    setIsSharedLoading(true);

    async function loadSharedState(silent = false) {
      try {
        const headers = authToken
          ? {
              Authorization: `Bearer ${authToken}`,
            }
          : undefined;

        const response = await fetchJsonWithTimeout('/api/state', {
          cache: 'no-store',
          headers,
        });

        if (response.status === 401) {
          if (!active) {
            return;
          }

          if (authToken) {
            window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
            setAuthToken('');
            setAuthUser(null);

            if (!silent) {
              setToast(buildToast('error', t('errSessionExpired')));
            }
          }

          return;
        }

        if (!response.ok) {
          throw new Error(`Khong tai duoc du lieu chia se (${response.status}).`);
        }

        const sharedState = await response.json();

        if (!active) {
          return;
        }

        setAisleProducts(
          sharedState?.aisleProducts && typeof sharedState.aisleProducts === 'object'
            ? sharedState.aisleProducts
            : {},
        );
        setAisleVisuals((current) =>
          mergeVisualCache(
            current,
            sharedState?.aisleVisuals && typeof sharedState.aisleVisuals === 'object'
              ? sharedState.aisleVisuals
              : {},
          ),
        );
        setAisleNames(
          sharedState?.aisleNames && typeof sharedState.aisleNames === 'object'
            ? sharedState.aisleNames
            : {},
        );
        setLossAudits(Array.isArray(sharedState?.lossAudits) ? sharedState.lossAudits : []);
        // Master Products are handled by loadMasterData on-demand
      } catch (error) {
        if (!active || silent) {
          return;
        }

        setToast(buildToast('error', error.message || 'Không kết nối được kho dữ liệu dùng chung.'));
      } finally {
        if (active && !silent) {
          setIsSharedLoading(false);
        }
      }
    }

    loadSharedState(false);
    const intervalId = window.setInterval(() => loadSharedState(true), 8000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [authToken]);

  useEffect(() => {
    if (hasLoadedMaster || isMasterLoading) {
       return;
    }
    
    // Only fetch if module is active, modal is open or searching
    const needsMaster = activeModule === 'master' || showMasterModal || searchTerm || lossSearchTerm || checkStockSearchTerm;
    if (!needsMaster) return;

    async function loadMasterData() {
      setIsMasterLoading(true);
      
      // 1. Try Loading from IndexedDB Cache first (Instant)
      const cachedData = await idbGetMaster();
      const cachedMeta = await idbGetMasterMeta();
      
      let hasLocal = false;
      if (Array.isArray(cachedData) && cachedData.length > 0) {
        setMasterProducts(cachedData);
        setHasLoadedMaster(true);
        setIsMasterLoading(false);
        hasLocal = true;
      }

      try {
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
        
        // 2. Check Version first
        const infoRes = await fetchJsonWithTimeout('/api/master-info', { headers });
        if (infoRes.ok) {
          const info = await infoRes.json();
          // If we have local cache and it matches server version, skip full download!
          if (hasLocal && cachedMeta?.updatedAt === info.updatedAt) {
            console.log('[Master] Cache is up to date:', info.updatedAt);
            setIsMasterLoading(false);
            return;
          }
        }

        // 3. Needs Update or No Cache
        const response = await fetchJsonWithTimeout('/api/master', { headers });
        if (!response.ok) throw new Error('Failed to load master data');
        
        const products = await response.json();
        const data = Array.isArray(products) ? products : [];
        
        setMasterProducts(data);
        setHasLoadedMaster(true);
        
        // Save to cache with new timestamp
        if (data.length > 0) {
          idbSetMaster(data, { updatedAt: new Date().toISOString() });
        }
      } catch (error) {
        if (!hasLocal) {
          setToast(buildToast('error', 'Không tải được dữ liệu Master.'));
        }
      } finally {
        setIsMasterLoading(false);
      }
    }

    loadMasterData();
  }, [activeModule, showMasterModal, searchTerm, lossSearchTerm, checkStockSearchTerm, hasLoadedMaster, isMasterLoading, authToken]);

  useEffect(() => {
    if (!selectedId) {
      setLoadingVisualKey('');
      return undefined;
    }

    const selectedVisual = aisleVisuals[selectedId];

    if (!selectedVisual?.hasSource || selectedVisual?.src) {
      setLoadingVisualKey((current) => (current === selectedId ? '' : current));
      return undefined;
    }

    let active = true;
    const headers = authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : undefined;

    setLoadingVisualKey(selectedId);

    fetchJsonWithTimeout(`/api/visual?key=${encodeURIComponent(selectedId)}`, {
      cache: 'no-store',
      headers,
    })
      .then(async (response) => {
        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Khong tai duoc anh line (${response.status}).`);
        }

        const payload = await response.json();
        return payload?.visual || null;
      })
      .then((visual) => {
        if (!active) {
          return;
        }

        setAisleVisuals((current) => {
          const currentEntry = current[selectedId];

          if (!currentEntry) {
            return current;
          }

          if (!visual?.src) {
            return {
              ...current,
              [selectedId]: {
                ...currentEntry,
                hasSource: false,
              },
            };
          }

          return {
            ...current,
            [selectedId]: {
              ...currentEntry,
              ...visual,
              hasSource: true,
            },
          };
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setToast(buildToast('error', error.message || 'Khong tai duoc anh line.'));
      })
      .finally(() => {
        if (active) {
          setLoadingVisualKey((current) => (current === selectedId ? '' : current));
        }
      });

    return () => {
      active = false;
    };
  }, [aisleVisuals, authToken, selectedId]);

  useEffect(() => {
    if (matchedProducts.length === 0) {
      return;
    }

    setFocusedLọcId((current) => {
      if (!current) {
        return matchedProducts[0].locId;
      }

      const currentKey = normaliseLọcIdValue(current);
      const hasCurrentLọc = matchedProducts.some((product) => {
        return normaliseLọcIdValue(product.locId) === currentKey;
      });

      return hasCurrentLọc ? current : matchedProducts[0].locId;
    });
  }, [matchedProducts]);

  useEffect(() => {
    if (!showAiModal || !selectedId) {
      return;
    }

    const [lineId, side] = selectedId.split('-');
    setTargetLine(lineId);
    setTargetSide(side || 'A');
  }, [selectedId, showAiModal]);

  function handleAisleSelect(lineId, side) {
    setSelectedId(`${lineId}-${side}`);

    if (isCompactView) {
      window.setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }, 60);
    }
  }

  function handleDesktopResizeStart(event) {
    if (isCompactView || !selectedShelf) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = desktopDrawerWidth;
    setIsDesktopResizing(true);
    document.body.classList.add('layout-resizing');

    function handlePointerMove(moveEvent) {
      const deltaX = startX - moveEvent.clientX;
      setDesktopDrawerWidth(clampDesktopDrawerWidth(startWidth + deltaX));
    }

    function handlePointerUp() {
      setIsDesktopResizing(false);
      document.body.classList.remove('layout-resizing');
      window.removeEventListener('pointermove', handlePointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  const downloadPogData = async (lineKey) => {
    const data = aisleProducts[lineKey] || [];
    if (!data.length) {
      setToast(buildToast('error', t('errNoDataToDownload')));
      return;
    }

    const exportData = data.map(item => ({
      'Line/Side': lineKey,
      'Loc ID': item.locId,
      'SKU': item.sku,
      'Barcode': item.barcode || item.sku,
      'Product Name': resolveProductName(item)
    }));

    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'POG Data');
      
      // Tạo width cho từng cột
      const columnWidths = [
        { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 60 }
      ];
      worksheet['!cols'] = columnWidths;

      XLSX.writeFile(workbook, `POG_${lineKey}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setToast(buildToast('success', t('successDownloadPog', lineKey)));
    } catch (error) {
      setToast(buildToast('error', error.message || 'Lỗi xuất file Excel.'));
    }
  };

  const deletePogData = (lineKey) => {
    if (!window.confirm(t('confirmDeletePog', lineKey))) {
      return;
    }
    
    setAisleProducts(current => {
      const updated = { ...current };
      delete updated[lineKey];
      persistToStorage(STORAGE_KEY, updated);
      return updated;
    });
    
    if (selectedId === lineKey) {
      setSelectedId(null);
    }
    
    setToast(buildToast('success', t('successDeletePog', lineKey)));
  };

  function requireFeatureAccess(isAllowed, moduleKey = 'pog') {
    if (isAllowed) {
      return true;
    }

    if (!authUser) {
      setShowLoginModal(true);
      setToast(buildToast('error', t('errLoginRequired')));
      return false;
    }

    const moduleLabel =
      moduleKey === 'stock'
        ? t('moduleStock')
        : moduleKey === 'loss'
          ? t('moduleLoss')
          : 'POG';

    setToast(buildToast('error', `Tai khoan nay chua duoc cap quyen ${moduleLabel}.`));
    return false;
  }

  function openSyncModal() {
    if (!requireFeatureAccess(canEditPog, 'pog')) {
      return;
    }

    if (selectedId) {
      const [lineId, side] = selectedId.split('-');
      setTargetLine(lineId);
      setTargetSide(side || 'A');
    }

    setShowAiModal(true);
  }

  async function authLogin(username, password) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Login failed (${response.status})`);
      }

      return response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Yêu cầu đăng nhập quá hạn (10s). Vui lòng kiểm tra kết nối mạng.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function handleRenameAisle(aisleId, nextName) {
    if (!requireFeatureAccess(isAdminAccount, 'admin')) {
      return;
    }

    const trimmed = String(nextName || '').trim();
    if (!trimmed) {
      setToast(buildToast('error', 'Tên line không được để trống.'));
      return;
    }

    try {
      const nextAisleNames = {
        ...aisleNames,
        [aisleId]: trimmed,
      };

      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ aisleNames: nextAisleNames }),
      });

      if (!response.ok) {
        throw new Error(`Lỗi cập nhật tên line (${response.status})`);
      }

      setAisleNames(nextAisleNames);
      setIsRenamingAisle(false);
      setToast(buildToast('success', `Đã đổi tên line thành "${trimmed}".`));
    } catch (error) {
      setToast(buildToast('error', error.message || 'Không thể đổi tên line.'));
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    const username = loginUsername.trim();
    const password = loginPassword;

    if (!username || !password) {
      setToast(buildToast('error', t('errFillLogin')));
      return;
    }

    setIsLoggingIn(true);
    setAuthError('');

    try {
      const payload = await authLogin(username, password);
      setAuthToken(payload.token);
      setAuthUser(payload.user);
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, payload.token);
      setShowLoginModal(false);
      
      const welcomeName = payload?.user?.displayName || payload?.user?.username || username;
      setToast(buildToast('success', t('successLogin', welcomeName)));
    } catch (error) {
      setAuthError(error.message || t('errLoginFailed'));
      setToast(buildToast('error', error.message || t('errLoginFailed')));
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function fetchUsersList() {
    if (!authToken) return;
    try {
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsersList(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }

  async function handleCreateUser(payload) {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t('errUserCreateFailed'));
      }
      const data = await response.json();
      setUsersList(data.users);
      setToast(buildToast('success', t('msgUserCreated')));
      return true;
    } catch (error) {
      setToast(buildToast('error', error.message));
      return false;
    }
  }

  async function handleUpdateUser(userId, patch) {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ id: userId, patch })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t('errUserUpdateFailed'));
      }
      const data = await response.json();
      setUsersList(data.users);
      if (userId === authUser?.id && data.user) {
        setAuthUser(data.user);
      }
      setToast(buildToast('success', t('msgUserUpdated')));
    } catch (error) {
      setToast(buildToast('error', error.message));
    }
  }

  async function handleLogout() {
    const token = authToken;

    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {}
    }

    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthToken('');
    setAuthUser(null);
    setShowLoginModal(false);
    setShowAiModal(false);
    setToast(buildToast('success', 'Da dang xuat thanh cong.'));
  }

  async function saveSharedState(nextProducts, nextLossAudits = lossAudits, intent = 'pog', overrides = {}) {
    if (!authToken || !authUser) {
      throw new Error('Vui lòng đăng nhập để chỉnh sửa dữ liệu.');
    }

    const bodyPayload = {
      aisleProducts: nextProducts,
      lossAudits: Array.isArray(nextLossAudits) ? nextLossAudits : [],
      intent,
    };

    if (Array.isArray(overrides.masterProducts)) {
       bodyPayload.masterProducts = overrides.masterProducts;
    }

    let finalBody = JSON.stringify(bodyPayload);

    if (finalBody.length > 200 * 1024) {
      try {
        const { gzipSync, strToU8 } = await import('fflate');
        const compressed = gzipSync(strToU8(finalBody));
        
        // Ultra-fast Native Base64 conversion for large arrays
        const b64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
              resolve(result.split(',')[1]);
            } else {
              resolve('');
            }
          };
          reader.readAsDataURL(new Blob([compressed]));
        });

        finalBody = JSON.stringify({
          _compressed: true,
          data: b64,
        });
      } catch (err) {
        console.warn('Compression failed, sending raw:', err.message);
      }
    }

    const response = await fetchJsonWithTimeout('/api/state', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: finalBody,
    });

    if (response.status === 401) {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setAuthToken('');
      setAuthUser(null);
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (!response.ok) {
      throw new Error(`Khong luu duoc du lieu dung chung (${response.status}).`);
    }

    const savedState = await response.json();

    setAisleProducts(savedState?.aisleProducts || {});
    setAisleVisuals((current) =>
      mergeVisualCache(
        current,
        savedState?.aisleVisuals && typeof savedState.aisleVisuals === 'object'
          ? savedState.aisleVisuals
          : {},
      ),
    );
    setLossAudits(Array.isArray(savedState?.lossAudits) ? savedState.lossAudits : []);
    setMasterProducts(
      Array.isArray(savedState?.masterProducts)
        ? dedupeMasterProducts(savedState.masterProducts)
        : [],
    );

    return savedState;
  }

  async function saveSharedVisual(lineKey, visual) {
    if (!authToken || !authUser) {
      throw new Error('Vui long dang nhap de cap nhat anh line.');
    }

    if (!lineKey || !visual?.src) {
      return null;
    }

    const response = await fetchJsonWithTimeout(`/api/visual?key=${encodeURIComponent(lineKey)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ visual }),
    });

    if (response.status === 401) {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setAuthToken('');
      setAuthUser(null);
      throw new Error('Phien dang nhap da het han. Vui long dang nhap lai.');
    }

    if (!response.ok) {
      throw new Error(`Khong luu duoc anh line (${response.status}).`);
    }

    const payload = await response.json();
    const savedVisual = payload?.visual || null;

    if (savedVisual?.src) {
      setAisleVisuals((current) => ({
        ...current,
        [lineKey]: {
          ...current[lineKey],
          ...savedVisual,
          hasSource: true,
        },
      }));
    }

    return savedVisual;
  }

  function resetSyncFlow() {
    setAiStep(1);
    setIsAiProcessing(false);
    setExtractedData([]);
    setExtractedVisual(null);
    setUploadFile(null);
  }

  function closeSyncModal() {
    setShowAiModal(false);
    resetSyncFlow();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      setUploadFile(null);
      setToast(buildToast('error', 'Chi chap nhan tep PDF planogram.'));
      return;
    }

    setUploadFile(file);
    setExtractedData([]);
    setExtractedVisual(null);
    setAiStep(1);
  }

  async function processUploadedPdf() {
    if (!uploadFile) {
      setToast(buildToast('error', t('errUploadPdfFirst')));
      return;
    }

    setIsAiProcessing(true);
    setAiStep(2);

    try {
      const { extractPlanogramFromPdf } = await import('./pdfParser');
      const parsed = await extractPlanogramFromPdf(uploadFile, {
        lineId: targetLine,
        side: targetSide,
      });

      setExtractedData(parsed.products || []);
      setExtractedVisual(parsed.visual || null);
      setAiStep(3);
    } catch (error) {
      setAiStep(1);
      setToast(buildToast('error', error.message || t('errPdfParseFailed')));
    } finally {
      setIsAiProcessing(false);
    }
  }

  async function confirmUpdate() {
    const key = `${targetLine}-${targetSide}`;
    const cleanedItems = mergeProductStockState(
      normaliseExtractedItems(extractedData).map((item) => ({
        ...item,
        verified: true,
      })),
      aisleProducts[key] || [],
    );

    if (cleanedItems.length === 0) {
      setToast(buildToast('error', t('errNoValidData')));
      return;
    }

    const nextProducts = {
      ...aisleProducts,
      [key]: cleanedItems,
    };

    setIsAiProcessing(true);
    try {
      await saveSharedState(nextProducts, lossAudits, 'pog');

      if (extractedVisual?.src) {
        await saveSharedVisual(key, extractedVisual);
      }

      setSelectedId(key);
      closeSyncModal();
      setToast(
        buildToast(
          'success',
          t('msgSyncComplete', cleanedItems.length, key, !!extractedVisual?.src),
        ),
      );
    } catch (error) {
      setToast(buildToast('error', error.message || t('errSaveSharedFailed')));
    } finally {
      setIsAiProcessing(false);
    }
  }

  async function handleStockUpdate(product, nextStatus) {
    if (!requireFeatureAccess(canEditPog, 'pog')) {
      return;
    }

    if (!selectedId) {
      return;
    }

    const currentProducts = aisleProducts[selectedId] || [];
    const productIndex = currentProducts.findIndex((item) => item === product);

    if (productIndex < 0) {
      return;
    }

    const stockStatus = getStockMeta(nextStatus).id;
    const saveKey = `${selectedId}-${product.locId}-${product.sku || 'na'}-${productIndex}`;
    const previousProducts = aisleProducts;
    const nextProducts = {
      ...previousProducts,
      [selectedId]: currentProducts.map((item, index) =>
        index === productIndex
          ? {
              ...item,
              stockStatus,
              stockCheckedAt: stockStatus === 'unchecked' ? null : new Date().toISOString(),
            }
          : item,
      ),
    };

    setAisleProducts(nextProducts);
    setSavingStockKey(saveKey);

    try {
      await saveSharedState(nextProducts, lossAudits, 'stock');
    } catch (error) {
      setAisleProducts(previousProducts);
      setToast(buildToast('error', error.message || t('errStockSaveFailed')));
    } finally {
      setSavingStockKey((current) => (current === saveKey ? '' : current));
    }
  }



  function stopBarcodeScannerSession() {
    if (scannerFrameRef.current) {
      window.cancelAnimationFrame(scannerFrameRef.current);
      scannerFrameRef.current = 0;
    }

    if (scannerTimeoutRef.current) {
      window.clearTimeout(scannerTimeoutRef.current);
      scannerTimeoutRef.current = 0;
    }

    scannerControlsRef.current?.stop?.();
    scannerControlsRef.current = null;
    scannerReaderRef.current = null;

    const stream = scannerStreamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      scannerStreamRef.current = null;
    }

    if (scannerVideoRef.current) {
      scannerVideoRef.current.pause?.();
      scannerVideoRef.current.srcObject = null;
    }
  }

  async function startNativeBarcodeDetection(videoElement) {
    if (!('BarcodeDetector' in window)) {
      return false;
    }

    const Detector = window.BarcodeDetector;
    const preferredFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar'];
    const supportedFormats = typeof Detector.getSupportedFormats === 'function'
      ? await Detector.getSupportedFormats().catch(() => [])
      : [];
    const formats = supportedFormats.length > 0
      ? preferredFormats.filter((format) => supportedFormats.includes(format))
      : preferredFormats;
    const detector = new Detector({
      formats: formats.length > 0 ? formats : preferredFormats,
    });

    const scanFrame = async () => {
      if (!scannerVideoRef.current || !showBarcodeScanner) {
        return;
      }

      if (videoElement.readyState >= 2) {
        try {
          const barcodes = await detector.detect(videoElement);
          const detectedCode = String(barcodes?.[0]?.rawValue || '').trim();

          if (detectedCode && detectedCode !== lastScannedBarcodeRef.current) {
            lastScannedBarcodeRef.current = detectedCode;
            handleDetectedBarcode(detectedCode);
            return;
          }
        } catch {}
      }

      scannerTimeoutRef.current = window.setTimeout(() => {
        scannerFrameRef.current = window.requestAnimationFrame(scanFrame);
      }, 16); // Ultra-high sensitivity for native (scans almost every frame)
    };

    scannerFrameRef.current = window.requestAnimationFrame(scanFrame);
    return true;
  }

  async function startZxingBarcodeDetection(videoElement) {
    try {
      let ZXingLib;
      try {
        ZXingLib = await import('@zxing/library');
      } catch (e) {
        ZXingLib = await import('@zxing/browser');
      }

      // BrowserBarcodeReader is often better for 1D barcodes (EAN/UPC)
      const { BrowserBarcodeReader, BrowserMultiFormatReader } = await import('@zxing/browser');
      const DecodeHintType = ZXingLib.DecodeHintType;
      const BarcodeFormat = ZXingLib.BarcodeFormat;

      let reader;
      if (DecodeHintType && BarcodeFormat) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.RSS_14
        ]);
        // Speed optimization: Disable TRY_HARDER for retail-ready performance.
        // It consumes significant CPU and can slow down frame rates on mobile.
        hints.set(DecodeHintType.TRY_HARDER, false);
        hints.set(DecodeHintType.ASSUME_GS1, true);
        
        // Use Barcode-specific reader if available, otherwise MultiFormat
        const ReaderClass = BrowserBarcodeReader || BrowserMultiFormatReader;
        reader = new ReaderClass(hints);
      } else {
        const ReaderClass = BrowserBarcodeReader || BrowserMultiFormatReader;
        reader = new ReaderClass();
      }

      scannerReaderRef.current = reader;

      const controls = await reader.decodeFromVideoElement(videoElement, (result) => {
        const detectedCode = String(result?.getText?.() || result?.text || '').trim();
        if (!detectedCode || detectedCode === lastScannedBarcodeRef.current) {
          return;
        }
        lastScannedBarcodeRef.current = detectedCode;
        handleDetectedBarcode(detectedCode);
      });

      scannerControlsRef.current = controls;
      return true;
    } catch (error) {
      console.error('ZXing Startup Error:', error);
      throw error;
    }
  }

  async function startBarcodeScannerSession() {
    if (!scannerVideoRef.current) {
      return;
    }

    try {
      stopBarcodeScannerSession();
      setIsScannerStarting(true);
      setScannerError('');
      lastScannedBarcodeRef.current = '';

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt của bạn không hỗ trợ Camera.');
      }

      // High-performance constraints for retail barcodes
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 }, // Lowering resolution slightly speeds up JS-based decoding significantly
          height: { ideal: 480 },
          frameRate: { ideal: 60 } // Requesting higher frame rate for smoother detection
        },
      });

      scannerStreamRef.current = stream;

      const videoElement = scannerVideoRef.current;
      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.muted = true;
      await videoElement.play();
      setCameraPermissionState('granted');

      // Attempt Native Detector First (Ultra Fast)
      let detectorActive = false;
      try {
        detectorActive = await startNativeBarcodeDetection(videoElement);
      } catch (err) {
        console.warn('Native detector failed:', err);
      }

      // Fallback to ZXing if native is not available or failed
      if (!detectorActive) {
        try {
          await startZxingBarcodeDetection(videoElement);
        } catch (zxError) {
          throw new Error('Không thể khởi động bộ quét: ' + zxError.message);
        }
      }

      setIsScannerStarting(false);
    } catch (error) {
      stopBarcodeScannerSession();
      const errorName = String(error?.name || '');

      if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
        setCameraPermissionState('denied');
      }

      throw error;
    }
  }

  function closeBarcodeScanner() {
    stopBarcodeScannerSession();
    setShowBarcodeScanner(false);
    setIsScannerStarting(false);
    setIsTorchOn(false);
    setScannerError('');
    setScanResult(null);
    lastScannedBarcodeRef.current = '';
  }

  async function toggleTorch() {
    try {
      const stream = scannerStreamRef.current;
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      const capabilities = track.getCapabilities();
      if (!capabilities.torch) {
        setToast(buildToast('error', 'Camera nay khong ho tro den flash.'));
        return;
      }

      const nextState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (error) {
       console.error('Torch error:', error);
    }
  }

  function openBarcodeScanner() {
    // Mở khóa tính năng Camera cho Guest (Người dùng khách)
    // Guest vẫn có quyền Scan Barcode để tra cứu tồn kho (Stock/POG). Chỉ chặn Scanner ở module Loss.

    if (activeModule === 'loss' && !requireFeatureAccess(canUseLossTools, 'loss')) {
      return;
    }

    if (cameraPermissionState === 'unsupported') {
      setToast(buildToast('error', t('errScannerNotSupported')));
      return;
    }

    if (cameraPermissionState === 'denied') {
      setToast(buildToast('error', t('errCameraBlocked')));
      return;
    }

    setScannerError('');
    ensureScannerFeedbackAudioReady().catch(() => {});
    setShowBarcodeScanner(true);
  }

  function addLossItemFromCode(rawCode, sourceLabel = 'scan') {
    if (!rawCode) {
      setToast(buildToast('error', t('errNeedInputBeforeScan')));
      return false;
    }
    
    const barcodeInput = normaliseProductCode(rawCode);

    if (!barcodeInput) {
      setToast(buildToast('error', t('errNeedInputBeforeScan')));
      return false;
    }

    setLossBarcodeInput(String(rawCode || '').trim());
    // Removed auto-set of lossSearchTerm to avoid hiding other items during scan session

    try {
      const matched = productCodeLookup.get(barcodeInput);

      if (!matched) {
        setToast(buildToast('error', t('errNotFoundProductCode', String(rawCode || '').trim())));
        return false;
      }

      const nowIso = new Date().toISOString();

      setLossDraftItems((current) => {
        const currentIndex = current.findIndex((item) => {
          return normaliseProductCode(item?.barcode || item?.productId || item?.sku) === barcodeInput;
        });

        if (currentIndex >= 0) {
          return current.map((item, index) =>
            index === currentIndex
              ? {
                  ...item,
                  barcode: matched.barcode || matched.productId || matched.sku || '',
                  productId: matched.productId || matched.barcode || matched.sku || '',
                  sku: matched.sku || matched.barcode || matched.productId || '',
                  name: matched.name || item.name || '',
                  lineKey: matched.lineKey || item.lineKey || '',
                  locId: matched.locId || item.locId || '',
                  stockStatus: matched.stockStatus || item.stockStatus || 'unchecked',
                  division: matched.division || item.division || '',
                  divisionName: matched.divisionName || item.divisionName || '',
                  department: matched.department || item.department || '',
                  departmentName: matched.departmentName || item.departmentName || '',
                  lastScannedAt: nowIso,
                  lossQuantity: computeLossValue(item.systemStock, item.actualStock),
                }
              : item,
          );
        }

        return [
          {
            id: `loss-item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            barcode: matched.barcode || matched.productId || matched.sku || '',
            productId: matched.productId || matched.barcode || matched.sku || '',
            sku: matched.sku || matched.barcode || matched.productId || '',
            name: matched.name || '',
            lineKey: matched.lineKey || '',
            locId: matched.locId || '',
            systemStock: '',
            actualStock: '',
            lossQuantity: 0,
            stockStatus: matched.stockStatus || 'unchecked',
            division: matched.division || '',
            divisionName: matched.divisionName || '',
            department: matched.department || '',
            departmentName: matched.departmentName || '',
            scannedAt: nowIso,
            lastScannedAt: nowIso,
          },
          ...current,
        ];
      });

      const displayName = matched.name || matched.sku || matched.barcode || 'sản phẩm';
      setToast(
        buildToast(
          'success',
          t('msgScanned', sourceLabel, displayName),
        ),
      );

      return true;
    } catch (error) {
       console.error('Scan processing error:', error);
       setToast(buildToast('error', 'Lỗi xử lý dữ liệu quét.'));
       return false;
    }
  }

  function handleDetectedBarcode(scannedCode) {
    if (!scannedCode || scannedCode === 'undefined') {
      console.warn('Scan result is invalid:', scannedCode);
      return;
    }

    // Stop scanning loop FIRST to prevent repeated triggers, but keep modal open
    if (scannerFrameRef.current) {
      window.cancelAnimationFrame(scannerFrameRef.current);
      scannerFrameRef.current = 0;
    }
    if (scannerTimeoutRef.current) {
      window.clearTimeout(scannerTimeoutRef.current);
      scannerTimeoutRef.current = 0;
    }
    scannerControlsRef.current?.stop?.();
    scannerControlsRef.current = null;

    const didVibrate = triggerBarcodeScanFeedback();
    if (!didVibrate) playScannerFeedbackTone();

    if (activeModule === 'loss') {
      addLossItemFromCode(scannedCode, 'quet');
      closeBarcodeScanner();
      return;
    }

    // --- Stock / POG mode: look up in Master then display result INSIDE scanner modal ---
    const rawCode = String(scannedCode).trim();
    const normCode = rawCode.toLowerCase();

    // Search masterLookup first (exact)
    let master = masterLookup.get(rawCode) || masterLookup.get(normCode);

    // Search masterProducts array if not found
    if (!master) {
      const found = masterProducts.find(m =>
        String(m.sku).toLowerCase() === normCode ||
        String(m.barcode).toLowerCase() === normCode
      );
      if (found) master = found;
    }

    // Also search allStockProducts for systemStock
    const aisleMatch = allStockProducts.find(p =>
      String(p.sku).toLowerCase() === normCode ||
      String(p.barcodeView).toLowerCase() === normCode ||
      String(p.barcode || '').toLowerCase() === normCode
    );

    const resultInfo = {
      barcode: rawCode,
      sku: master?.sku || aisleMatch?.sku || rawCode,
      name: master?.name || aisleMatch?.displayName || aisleMatch?.name || '',
      systemStock: aisleMatch?.systemStock ?? master?.systemStock ?? '--',
      division: master?.division || aisleMatch?.division || '',
      department: master?.department || aisleMatch?.department || '',
      found: !!(master || aisleMatch),
    };

    setScanResult(resultInfo);

    // Điền mã vào ô tìm kiếm của mô-đun hiện tại để khi đóng modal sẽ thấy kết quả ngay
    if (activeModule === 'stock') {
      setCheckStockSearchTerm(rawCode);
      setCheckStockBarcodeInput(rawCode);
    } else {
      // Cho POG hoặc Master Data
      setSearchTerm(rawCode);
    }
  }

  function handleStockScanSubmit(event) {
    event.preventDefault();
    setCheckStockSearchTerm(checkStockBarcodeInput);
    // Don't clear the input so user sees what they searched
  }

  function handleLossScanSubmit(event) {
    event.preventDefault();
    const didAdd = addLossItemFromCode(lossBarcodeInput, 'them');

    if (didAdd) {
      setLossBarcodeInput('');
    }
  }

  function handleLossStockChange(itemId, field, value) {
    const safeValue = normaliseCountInput(value);

    setLossDraftItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: safeValue,
              lossQuantity: computeLossValue(
                field === 'systemStock' ? safeValue : item?.systemStock,
                field === 'actualStock' ? safeValue : item?.actualStock,
              ),
            }
          : item,
      ),
    );
  }

  function handleLossRemoveItem(itemId) {
    setLossDraftItems((current) => current.filter((item) => item.id !== itemId));
  }

  function resetLossDraft() {
    setLossDraftItems([]);
    setLossBarcodeInput('');
    setLossPeriodName(makeLossPeriodLabel());
    closeBarcodeScanner();
  }

  async function exportLossExcel(sourceAudit = null) {
    const exportItems = sourceAudit?.items || lossDraftItems;

    if (!Array.isArray(exportItems) || exportItems.length === 0) {
      setToast(buildToast('error', t('errNoDataToExport')));
      return;
    }

    const periodName = sourceAudit?.periodName || lossPeriodName || makeLossPeriodLabel();
    const safePeriod = makeSafeFileNameSegment(periodName) || 'loss';
    const createdAt = sourceAudit?.createdAt || new Date().toISOString();
    const exportStamp = createdAt.slice(0, 10);
    const fileName = `loss-${safePeriod}-${exportStamp}.xlsx`;
    const totals = exportItems.reduce(
      (summary, item) => {
        const metrics = getLossItemMetrics(item);

        return {
          totalSystemStock: summary.totalSystemStock + metrics.systemStock,
          totalActualStock: summary.totalActualStock + metrics.actualStock,
          totalLoss: summary.totalLoss + metrics.lossQuantity,
        };
      },
      {
        totalSystemStock: 0,
        totalActualStock: 0,
        totalLoss: 0,
      },
    );
    const summaryRows = [
      { field: 'Kỳ kiểm', value: periodName },
      {
        field: 'Người tạo',
        value: sourceAudit?.createdByName || authUser?.displayName || authUser?.username || 'Guest',
      },
      { field: 'Thời gian', value: createdAt },
      { field: 'Tổng SKU', value: exportItems.length },
      { field: 'Tổng stock hệ thống', value: totals.totalSystemStock },
      { field: 'Tổng stock thực tế', value: totals.totalActualStock },
      { field: 'Tổng loss', value: totals.totalLoss },
    ];
    const detailRows = exportItems.map((item, index) => {
      const stockMeta = getStockMeta(item?.stockStatus);
      const metrics = getLossItemMetrics(item);
      return {
        stt: index + 1,
        barcode: item?.barcode || '',
        productId: item?.productId || '',
        sku: item?.sku || '',
        productName: item?.name || '',
        line: item?.lineKey || '',
        locId: item?.locId || '',
        systemStock: metrics.systemStock,
        actualStock: metrics.actualStock,
        quantityLoss: metrics.lossQuantity,
        linkedStockStatus: stockMeta.label,
      };
    });

    setIsExportingLossFile(true);

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);

      XLSX.utils.book_append_sheet(workbook, summarySheet, LOSS_SUMMARY_SHEET_NAME);
      XLSX.utils.book_append_sheet(workbook, detailSheet, LOSS_EXPORT_SHEET_NAME);
      XLSX.writeFile(workbook, fileName);

      setToast(buildToast('success', t('successExportExcel', fileName)));
    } catch (error) {
      setToast(buildToast('error', error.message || t('errExportExcelFailed')));
    } finally {
      setIsExportingLossFile(false);
    }
  }

  async function handleSaveLossAudit() {
    if (!requireFeatureAccess(canUseLossTools, 'loss')) {
      return;
    }

    if (lossDraftItems.length === 0) {
      setToast(buildToast('error', t('errEmptyLossAudit')));
      return;
    }

    const periodName = lossPeriodName.trim() || makeLossPeriodLabel();
    const nowIso = new Date().toISOString();
    const payloadItems = lossDraftItems.map((item) => {
      const linkedProduct = productCodeLookup.get(
        normaliseProductCode(item?.barcode || item?.productId || item?.sku),
      );
      const metrics = getLossItemMetrics(item);

      return {
        barcode: item?.barcode || '',
        productId: item?.productId || '',
        sku: item?.sku || '',
        name: item?.name || '',
        lineKey: item?.lineKey || '',
        locId: item?.locId || '',
        systemStock: metrics.systemStock,
        actualStock: metrics.actualStock,
        lossQuantity: metrics.lossQuantity,
        stockStatus: getStockMeta(linkedProduct?.stockStatus || item?.stockStatus).id,
        scannedAt: item?.scannedAt || nowIso,
        lastScannedAt: item?.lastScannedAt || nowIso,
      };
    });
    const nextAudit = {
      id: `loss-audit-${Date.now()}`,
      periodName,
      createdAt: nowIso,
      createdByName: authUser?.displayName || authUser?.username || 'Unknown',
      createdByUsername: authUser?.username || '',
      itemCount: payloadItems.length,
      totalSystemStock: payloadItems.reduce((total, item) => total + getCountValue(item?.systemStock), 0),
      totalActualStock: payloadItems.reduce((total, item) => total + getCountValue(item?.actualStock), 0),
      totalLossQuantity: payloadItems.reduce((total, item) => total + getCountValue(item?.lossQuantity), 0),
      items: payloadItems,
    };
    const nextLossAudits = [nextAudit, ...lossAudits].slice(0, 200);

    setIsSavingLossAudit(true);

    try {
      await saveSharedState(aisleProducts, nextLossAudits, 'loss');
      setLossPeriodName(makeLossPeriodLabel());
      setLossBarcodeInput('');
      setLossDraftItems([]);
      setToast(
        buildToast(
          'success',
          t('msgSaveLossComplete', periodName, nextAudit.itemCount, nextAudit.totalLossQuantity),
        ),
      );
    } catch (error) {
      setToast(buildToast('error', error.message || t('errSaveLossFailed')));
    } finally {
      setIsSavingLossAudit(false);
    }
  }

  async function exportStockExcel() {
    if (!Array.isArray(filteredStockProducts) || filteredStockProducts.length === 0) {
      setToast(buildToast('error', t('errNoDataToExport')));
      return;
    }

    const exportStamp = new Date().toISOString().slice(0, 10);
    const fileName = `stock-check-${exportStamp}.xlsx`;

    const detailRows = filteredStockProducts.map((product, index) => {
      return {
        'STT': index + 1,
        'SKU': product?.sku || '',
        'Tên sản phẩm': product?.name || '',
        'Barcode sản phẩm': product?.barcodeView || product?.barcode || '',
        'Barcode AEON': product?.productId || '',
        'Số lượng thực tế': product?.actualStockFromLoss !== '--' ? product.actualStockFromLoss : 0,
        'Hệ thống': product?.systemStock ?? 0,
        'Line': product?.lineKey || '',
        'Nhãn (Loc)': product?.locId || '',
        'Bộ phận': product?.divisionName || product?.division || '',
        'Phòng ban': product?.departmentName || product?.department || ''
      };
    });

    setIsExportingStockFile(true);

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);

      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Stock Check');
      XLSX.writeFile(workbook, fileName);

      setToast(buildToast('success', t('successExportExcel', fileName)));
    } catch (error) {
      setToast(buildToast('error', error.message || t('errExportExcelFailed')));
    } finally {
      setIsExportingStockFile(false);
    }
  }

  async function handleStockImportExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingStockFile(true);

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Use header: 1 to get raw array of arrays (rows)
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

          if (rows.length === 0) {
            throw new Error('File Excel trống.');
          }

          // Search for the header row (look through first 20 rows)
          const skuRegex = /sku|barcode|mahang|masanpham|mavach|code/;
          const headerRowIndex = rows.slice(0, 20).findIndex(row => 
            Array.isArray(row) && row.some(cell => skuRegex.test(normaliseSearchText(String(cell)).replace(/\s+/g, '')))
          );

          if (headerRowIndex === -1) {
            throw new Error('Không tìm thấy cột SKU hoặc Barcode trong file. Vui lòng đảm bảo file có tiêu đề "SKU" hoặc "Barcode".');
          }

          const rawHeaders = rows[headerRowIndex];
          const jsonDataRows = rows.slice(headerRowIndex + 1);

          // Identify column indices using normalized headers
          const findIndex = (regex) => rawHeaders.findIndex(h => regex.test(normaliseSearchText(String(h)).replace(/\s+/g, '')));

          const lineIdx = findIndex(/line|aisle|khuvuc|day/);
          const locIdx = findIndex(/loc|stt|vitri|sothutu/);
          const skuIdx = findIndex(skuRegex);
          const nameIdx = findIndex(/ten|name|sanpham|mota|description/);
          const stockIdx = findIndex(/hethong|system|ton|stock|soluong/);

          let updateCount = 0;
          let addedCount = 0;
          let lineUpdateCount = 0;
          const nextAisleProducts = { ...aisleProducts };
          
          // Group data by line 
          const rowsByLine = {};
          jsonDataRows.forEach(row => {
            if (!Array.isArray(row) || row.length === 0) return;
            
            const skuVal = String(row[skuIdx] || '').trim();
            if (!skuVal) return; // Skip rows without SKU

            let lineId = selectedId;
            if (lineIdx >= 0 && row[lineIdx]) {
              const lineVal = String(row[lineIdx]).trim().toUpperCase();
              if (lineVal) lineId = lineVal;
            }

            if (!lineId) return;

            if (!rowsByLine[lineId]) rowsByLine[lineId] = [];
            rowsByLine[lineId].push(row);
          });

          if (Object.keys(rowsByLine).length === 0) {
            throw new Error('Không tìm thấy dữ liệu hợp lệ trong file.');
          }

          Object.entries(rowsByLine).forEach(([lineId, lineRows]) => {
            const currentProducts = nextAisleProducts[lineId] || [];
            const updatedProducts = [...currentProducts];
            lineUpdateCount++;

            // Optimization: Create a lookup map for existing products in this line
            const productLookup = new Map();
            updatedProducts.forEach((p, idx) => {
              if (p.sku) productLookup.set(String(p.sku).trim(), idx);
              if (p.barcode) productLookup.set(String(p.barcode).trim(), idx);
              if (p.productId) productLookup.set(String(p.productId).trim(), idx);
            });

            lineRows.forEach(row => {
              const skuVal = String(row[skuIdx] || '').trim();
              if (!skuVal) return;
              
              const matchedIndex = productLookup.has(skuVal) ? productLookup.get(skuVal) : -1;

              const newProductData = {
                locId: locIdx >= 0 ? (Number(row[locIdx]) || 1) : 1,
                sku: skuVal,
                name: nameIdx >= 0 ? String(row[nameIdx] || '').trim() : (matchedIndex >= 0 ? updatedProducts[matchedIndex].name : ''),
                systemStock: stockIdx >= 0 ? (Number(row[stockIdx]) || 0) : (matchedIndex >= 0 ? updatedProducts[matchedIndex].systemStock : 0),
                verified: true
              };

              if (matchedIndex >= 0) {
                updateCount++;
                updatedProducts[matchedIndex] = {
                  ...updatedProducts[matchedIndex],
                  ...newProductData,
                  barcode: updatedProducts[matchedIndex].barcode || updatedProducts[matchedIndex].sku || skuVal,
                  productId: updatedProducts[matchedIndex].productId || updatedProducts[matchedIndex].sku || skuVal
                };
              } else {
                addedCount++;
                const newIdx = updatedProducts.push({
                  ...newProductData,
                  barcode: skuVal,
                  productId: skuVal,
                  stockStatus: 'unchecked'
                }) - 1;
                // Update lookup map with new product
                productLookup.set(skuVal, newIdx);
              }
            });

            // Sort by Loc ID descending
            updatedProducts.sort((a, b) => (Number(b.locId) || 0) - (Number(a.locId) || 0));
            nextAisleProducts[lineId] = updatedProducts;
          });

          setAisleProducts(nextAisleProducts);
          await saveSharedState(nextAisleProducts, lossAudits, 'stock');
          
          setToast(buildToast('success', 
            `Đã cập nhật ${lineUpdateCount} line. (Cập nhật: ${updateCount}, Thêm mới: ${addedCount})`
          ));
        } catch (error) {
          setToast(buildToast('error', error.message));
        } finally {
          setIsImportingStockFile(false);
          event.target.value = '';
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      setToast(buildToast('error', error.message));
      setIsImportingStockFile(false);
    }
  }

  async function handleMasterImportExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!requireFeatureAccess(canEditPog, 'pog')) {
      event.target.value = '';
      return;
    }

    setToast(buildToast('success', 'Đang xóa dữ liệu cũ & chuẩn bị nhập Master mới...'));
    setIsImportingMaster(true);
    setMasterProducts([]); // clear current UI state immediately

    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const result = extractMasterProductsFromWorkbook(workbook, XLSX);
      const nextMaster = result.products;

      if (nextMaster.length === 0) {
        throw new Error('Không tìm thấy dữ liệu sản phẩm hợp lệ trong file Master.');
      }

      setMasterProducts(nextMaster);
      await saveSharedState(aisleProducts, lossAudits, 'pog', {
        masterProducts: nextMaster,
      });
      
      setToast(buildToast('success', `Đã xóa Master cũ & cập nhật hoàn toàn ${nextMaster.length} sản phẩm mới. ${result.info || ''}`));
      setIsImportingMaster(false);
      event.target.value = '';
    } catch (error) {
      console.error('Import Error:', error);
      setToast(buildToast('error', 'Lỗi khi import: ' + (error.message || 'Không xác định')));
      setIsImportingMaster(false);
      event.target.value = '';
    }
  }

  async function handleClearMasterData() {
    if (!requireFeatureAccess(isAdminAccount, 'admin')) return;
    
    if (!window.confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu Master? Thao tác này không thể hoàn tác.')) {
      return;
    }
    
    setIsImportingMaster(true);
    try {
      await saveSharedState(aisleProducts, lossAudits, 'pog', {
        masterProducts: [],
      });
      setMasterProducts([]);
      setToast(buildToast('success', 'Đã xóa toàn bộ dữ liệu Master.'));
    } catch (error) {
      setToast(buildToast('error', error.message || 'Lỗi khi xóa dữ liệu.'));
    } finally {
      setIsImportingMaster(false);
    }
  }

  async function handleDeleteMasterItem(sku) {
    if (!requireFeatureAccess(canEditPog, 'pog')) return;

    if (!window.confirm(`Xóa sản phẩm SKU ${sku}?`)) {
      return;
    }
    
    const nextMaster = masterProducts.filter(p => p.sku !== sku);
    try {
      await saveSharedState(aisleProducts, lossAudits, 'pog', {
        masterProducts: nextMaster,
      });
      setMasterProducts(nextMaster);
      setToast(buildToast('success', `Đã xóa sản phẩm ${sku}.`));
    } catch (error) {
      setToast(buildToast('error', error.message || 'Lỗi khi xóa sản phẩm.'));
    }
  }

  async function exportMasterExcel() {
    if (masterProducts.length === 0) {
      setToast(buildToast('error', t('errNoDataToExport')));
      return;
    }

    setIsExportingMaster(true);
    try {
      const XLSX = await import('xlsx');
      const data = masterProducts.map((p, idx) => ({
        STT: idx + 1,
        SKU: p.sku,
        Barcode: p.barcode,
        'Product ID': p.productId || '',
        'Tên sản phẩm': p.name,
        Division: p.division,
        'Division Name': p.divisionName,
        Department: p.department,
        'Department Name': p.departmentName
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Items');
      XLSX.writeFile(workbook, `MasterItems_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      setToast(buildToast('error', error.message));
    } finally {
      setIsExportingMaster(false);
    }
  }

  function renderAisleCard(item, rowType) {
    const isSelectedLine = selectedId ? selectedId.split('-')[0] === item.id : false;
    const isCategorySelected = highlightedCategory === item.cat;
    const containerClass = [
      'aisle-card',
      rowType === 'secondary' ? 'aisle-card-muted' : '',
      isSelectedLine ? 'aisle-card-selected' : '',
      isCategorySelected ? 'aisle-card-category-highlight' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <article key={item.id} id={`aisle-${item.id}`} className={containerClass}>
        <div className="aisle-card-tooltip">
          <strong>{item.name}</strong>
          <span>{item.cat}</span>
        </div>
        <header className="aisle-card-header">{item.id}</header>
        <div className="aisle-card-sides">
          {['A', 'B'].map((side) => {
            const sideSelected = selectedId === `${item.id}-${side}`;

            return (
              <button
                key={`${item.id}-${side}`}
                type="button"
                className={`aisle-side-button ${sideSelected ? 'is-active' : ''}`}
                onClick={() => handleAisleSelect(item.id, side)}
              >
                {side}
              </button>
            );
          })}
        </div>
      </article>
    );
  }

  function renderAisleSummary(groupedAisles) {
    if (!groupedAisles || Object.keys(groupedAisles).length === 0) {
      return null;
    }

    return (
      <div className="aisle-summary-container">
        {Object.entries(groupedAisles).map(([cat, aisles]) => (
          <button
            key={cat}
            type="button"
            className={`aisle-summary-cat-chip ${highlightedCategory === cat ? 'is-active' : ''}`}
            onClick={() => {
              if (highlightedCategory === cat) {
                setHighlightedCategory(null);
              } else {
                setHighlightedCategory(cat);
                const firstAisle = aisles[0];
                if (firstAisle) {
                  const el = document.getElementById(`aisle-${firstAisle.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }
              }
            }}
          >
            <span>{cat}</span>
            <small>{aisles.length} Line</small>
          </button>
        ))}
      </div>
    );
  }

  const selectedCount = selectedShelf?.data.products.length || 0;
  const selectedFontOption = FONT_OPTIONS.find((fontOption) => fontOption.family === selectedFont);
  const settingsAccountName = authUser?.displayName || authUser?.username || t('settingsAccount');
  const settingsAccountRole = authUser
    ? t(authUser.role === 'admin' ? 'roleAdmin' : 'rolePicker')
    : '';
  const topbarModuleLabel =
    activeModule === 'pog'
      ? t('pogWorkspace')
      : activeModule === 'loss'
        ? t('lossWorkspace')
        : t('stockWorkspace');
  const moduleSummaryItems =
    activeModule === 'pog'
      ? [
          {
            label: t('linesWithData'),
            value: totalLineWithData,
          },
          {
            label: t('totalSku'),
            value: totalSkuCount,
          },
          {
            label: t('currentOpen'),
            value: selectedShelf ? `${selectedShelf.id}-${selectedShelf.side}` : t('notSelected'),
          },
          ...(searchKeyword
            ? [
                {
                  label: t('searchResults'),
                  value: globalMatches.length,
                  highlight: true,
                },
              ]
            : []),
        ]
      : activeModule === 'stock'
        ? [
            {
              label: 'Tổng sản phẩm',
              value: filteredStockProducts.length,
            },
            {
              label: 'Đã khớp',
              value: filteredStockProducts.filter(p => p.stockStatus === 'ok').length,
            },
            {
              label: 'Sai lệch',
              value: filteredStockProducts.filter(p => p.stockStatus === 'warning').length,
            },
            {
              label: 'Lỗi/Thiếu',
              value: filteredStockProducts.filter(p => p.stockStatus === 'error').length,
            },
          ]
        : [
            {
              label: t('savedPeriods'),
              value: lossAudits.length,
            },
            {
              label: t('scanningSkus'),
              value: lossDraftSummary.totalItems,
          },
          {
            label: t('systemStock'),
            value: lossDraftSummary.totalSystemStock,
          },
          {
            label: t('totalLoss'),
            value: lossDraftSummary.totalLoss,
            highlight: true,
          },
        ];

  const drawerPanel = selectedShelf ? (
    <aside className={`drawer ${isCompactView ? 'drawer-mobile' : ''}`}>
      <div className={`drawer-header ${selectedShelf.cat === 'HBC' ? 'drawer-header-hbc' : ''}`}>
        <div className="drawer-header-info">
          <p className="drawer-overline">
            L{selectedShelf.id} | Side {selectedShelf.side}
          </p>
          <div className="drawer-header-title-row">
            {isRenamingAisle ? (
              <div className="aisle-rename-form">
                <input
                  type="text"
                  value={tempAisleName}
                  onChange={(e) => setTempAisleName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameAisle(selectedShelf.id, tempAisleName);
                    if (e.key === 'Escape') setIsRenamingAisle(false);
                  }}
                />
                <button
                  type="button"
                  className="primary-button btn-xs"
                  onClick={() => handleRenameAisle(selectedShelf.id, tempAisleName)}
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  className="secondary-button btn-xs"
                  onClick={() => setIsRenamingAisle(false)}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <h2>
                  <Target size={16} />
                  <span>{selectedShelf.name}</span>
                </h2>
                {canEditPog ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="icon-button icon-button-ghost btn-xs"
                      onClick={() => {
                        if (!isAdminAccount) {
                          setToast(buildToast('error', 'Chỉ tài khoản Quản lý mới được đổi tên line.'));
                          return;
                        }
                        setTempAisleName(selectedShelf.name);
                        setIsRenamingAisle(true);
                      }}
                      title="Đổi tên line"
                    >
                      <Settings size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button-ghost btn-xs"
                      style={{ color: '#ef4444' }}
                      onClick={() => {
                        if (!isAdminAccount) {
                          setToast(buildToast('error', 'Chỉ tài khoản Quản lý mới được xóa dữ liệu line.'));
                          return;
                        }
                        deletePogData(selectedId);
                      }}
                      title="Xóa toàn bộ dữ liệu Line này"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ marginLeft: '0.5rem', opacity: 0.5, fontSize: '0.8rem' }}>
                    <ShieldCheck size={12} /> View Only
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className="icon-button icon-button-light"
          onClick={() => setSelectedId(null)}
        >
          <X size={22} />
        </button>
      </div>

      <div className="drawer-content">
        <div className="drawer-static-zone">
          {isSharedLoading ? (
            <div className="shared-loading">
              <span className="shared-loading-dot"></span>
              <p>Đang đồng bộ dữ liệu line từ máy chủ...</p>
            </div>
          ) : null}

          {isCompactView ? (
            <div className="mobile-selected-summary">
              <span className="mobile-selected-pill">
                {t('productCount', selectedCount)}
              </span>
              <span className="mobile-selected-pill">
                {selectedShelf.cat}
              </span>
            </div>
          ) : null}

          {loadingVisualKey === selectedId ? (
            <div className="shared-loading shared-loading-inline">
              <span className="shared-loading-dot"></span>
              <p>Dang tai anh line...</p>
            </div>
          ) : null}

          <PlanogramPreview
            visual={selectedShelf.data.visual}
            highlightedLọcIds={highlightedLọcIds}
            enableMagnifier={!isCompactView}
          />

          <section className="stock-panel">
            <div className="stock-panel-head">
              <div>
                <strong>{t('stockTitle')}</strong>
                <p>
                  {t('stockUpdated', selectedStockSummary.checked, selectedStockSummary.total)}
                </p>
              </div>
              {savingStockKey ? <span className="stock-saving-chip">{t('savingStock')}</span> : null}
            </div>

            <div className="stock-summary-inline">
              {STOCK_OPTIONS.map((option) => (
                <span
                  key={option.id}
                  className={`stock-summary-pill stock-summary-pill-${option.tone}`}
                >
                  <span>{option.shortLabel}</span>
                  <strong>{selectedStockSummary[option.id]}</strong>
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="drawer-products-scroll">
          {visibleProducts.length > 0 ? (
            <div className="product-list">
              {visibleProducts.map((product, index) => {
                const isMatch =
                  searchKeyword && getProductSearchableText(product).includes(searchKeyword);
                const isFocused =
                  normaliseLọcIdValue(focusedLọcId) === normaliseLọcIdValue(product.locId);
                const stockMeta = getStockMeta(product.stockStatus);
                const productIndex = selectedShelf.data.products.findIndex((item) => item === product);
                const stockSaveKey = `${selectedId}-${product.locId}-${product.sku || 'na'}-${productIndex}`;
                const isSavingStock = savingStockKey === stockSaveKey;

                return (
                  <article
                    key={`${product.locId}-${product.sku}-${index}`}
                    className={`product-card ${isMatch ? 'product-card-match' : ''} ${
                      isFocused ? 'product-card-focused' : ''
                    }`}
                    onMouseEnter={() => setFocusedLọcId(product.locId)}
                    onMouseLeave={() => setFocusedLọcId(null)}
                    onFocus={() => setFocusedLọcId(product.locId)}
                    onBlur={() => setFocusedLọcId(null)}
                    onClick={() => setFocusedLọcId(product.locId)}
                    tabIndex={0}
                  >
                    <div className="product-topline">
                      <div className="product-meta">
                        <span className={`product-badge ${isMatch ? 'product-badge-match' : ''}`}>
                          {t('labelLoc')} {product.locId}
                        </span>
                        {product.sku ? <span className="product-sku">{product.sku}</span> : null}
                      </div>

                      <select
                        className={`stock-select stock-select-${stockMeta.tone}`}
                        value={stockMeta.id}
                        disabled={isSavingStock}
                        onClick={(event) => event.stopPropagation()}
                        onFocus={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation();
                          handleStockUpdate(product, event.target.value);
                        }}
                      >
                        {STOCK_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {product.displayName ? (
                      <div className="product-name">
                        <HighlightText text={product.displayName} highlight={searchTerm} />
                      </div>
                    ) : (
                      <div className="product-placeholder" />
                    )}

                    <div className="product-footline">
                      {product.verified ? (
                        <div className="verified-pill">
                          <Check size={12} strokeWidth={4} />
                          <span>Đã khớp</span>
                        </div>
                      ) : (
                        <span className="stock-timestamp stock-timestamp-empty">Chưa đối chiếu</span>
                      )}

                      {product.stockCheckedAt ? (
                        <p className="stock-timestamp">
                          Cập nhật: {formatStockCheckedAt(product.stockCheckedAt)}
                        </p>
                      ) : (
                        <p className="stock-timestamp stock-timestamp-empty">Chưa kiểm tra tồn kho</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Database size={42} strokeWidth={1.4} />
              <p>Line này chưa có dữ liệu hàng hóa</p>
              {!canEditPog ? (
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => {
                    if (!authUser) {
                      setShowLoginModal(true);
                    } else {
                      setToast(buildToast('error', 'Tai khoan nay chua duoc cap quyen POG.'));
                    }
                  }}
                >
                  {!authUser ? 'Đăng nhập để cập nhật POG' : 'Tài khoản này chỉ có quyền xem'}
                </button>
              ) : (
                <button type="button" className="inline-link" onClick={openSyncModal}>
                  Đồng bộ từ PDF ngay
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  ) : null;

  const stockPanel = (
    <section className="loss-layout stock-layout-modern">
      <section className="stock-top-controls">
        <div className="stock-hero-card">
          <div className="stock-hero-content">
            <div className="stock-hero-copy">
              <p className="section-label">Inventory Check</p>
              <h2>{t('stockTitle')}</h2>
              <p>{t('stockScanHint')}</p>
            </div>
            <div className="stock-hero-actions">
              <button
                type="button"
                className="action-pill-btn"
                onClick={() => stockImportInputRef.current?.click()}
              >
                <FileUp size={16} />
                <span>Nhập Excel</span>
              </button>
              <button
                type="button"
                className="action-pill-btn"
                disabled={filteredStockProducts.length === 0}
                onClick={exportStockExcel}
              >
                <Download size={16} />
                <span>Xuất báo cáo</span>
              </button>
              <input
                type="file"
                ref={stockImportInputRef}
                style={{ display: 'none' }}
                accept=".xlsx, .xls, .csv"
                onChange={handleStockImportExcel}
              />
            </div>
          </div>
          
          <form className="stock-main-search" onSubmit={handleStockScanSubmit}>
            <div className="stock-search-field">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                value={checkStockBarcodeInput}
                onChange={(event) => setCheckStockBarcodeInput(event.target.value)}
                placeholder="Tìm sản phẩm / Quét Barcode..."
                autoComplete="off"
              />
              <button type="button" className="barcode-trigger" onClick={openBarcodeScanner}>
                <Camera size={20} />
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="stock-content-area">
        {!checkStockSearchTerm ? (
          <div className="stock-empty-welcome">
            <div className="welcome-icon">
              <PackageSearch size={48} strokeWidth={1.5} />
            </div>
            <h3>Sẵn sàng kiểm tra kho</h3>
            <p>Nhập mã SKU hoặc sử dụng máy quét để xem thông tin chi tiết sản phẩm.</p>
          </div>
        ) : (
          <div className="stock-results-grid">
            {filteredStockProducts.length > 0 ? (
              filteredStockProducts.map((product, idx) => {
                const skuCode = normaliseProductCode(product.sku);
                const bcViewCode = normaliseProductCode(product.barcodeView);
                const bcCode = normaliseProductCode(product.barcode);
                const masterInfo = product.masterInfo || (masterLookup.get(skuCode) || masterLookup.get(bcViewCode) || masterLookup.get(bcCode));
                const stockMeta = getStockMeta(product.stockStatus);
                
                return (
                  <article key={`${product.locId}-${product.sku}-${idx}`} className="stock-result-card">
                    <div className="card-top-info">
                      <div className="main-details">
                        <div className="category-path">
                          {masterInfo?.division || '-'} <span>/</span> {masterInfo?.department || '-'}
                        </div>
                        <h3>
                           <HighlightText text={resolveProductName(product) || 'Không có tên'} highlight={checkStockSearchTerm} />
                        </h3>
                        <div className="stock-id-row">
                          <div className="id-item">
                            <Hash size={12} />
                            <span>SKU: {product.sku || '--'}</span>
                          </div>
                          <div className="id-item">
                            <Barcode size={12} />
                            <span>{product.barcodeView || product.barcode || '--'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {!product.isFromMasterOnly && (
                        <div className={`status-badge status-${stockMeta.tone}`}>
                          <CheckCircle2 size={12} />
                          <span>{stockMeta.shortLabel}</span>
                        </div>
                      )}
                    </div>

                    <div className="card-master-details stock-brief-details">
                      <div className="master-grid">
                        <div className="master-col">
                          <label>Division</label>
                          <p>{masterInfo?.division || '-'}</p>
                        </div>
                        <div className="master-col">
                          <label>Department</label>
                          <p>{masterInfo?.department || '-'}</p>
                        </div>
                         <div className="master-col">
                          <label>Vị trí</label>
                          <p>{product.lineKey} | {product.locId}</p>
                        </div>
                      </div>
                    </div>

                    <div className="card-footer-metrics stock-prime-metrics">
                       <div className="metrics-label">Tồn kho hiện tại</div>
                       <div className="metrics-group">
                          <div className="metric-item">
                            <label>Hệ thống</label>
                            <span className="val-system">{product.systemStock ?? '--'}</span>
                          </div>
                          <div className="metric-divider"></div>
                          <div className={`metric-item highlight-${product.actualStockFromLoss > 0 ? 'success' : 'neutral'}`}>
                            <label>Thực tế</label>
                            <span className="val-actual">{product.actualStockFromLoss ?? 0}</span>
                          </div>
                       </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="stock-no-results">
                <SearchX size={42} strokeWidth={1.5} />
                <h4>Không tìm thấy kết quả</h4>
                <p>Thử tìm kiếm theo SKU hoặc Barcode khác.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  );


  const lossPanel = (
    <section className="loss-layout">
      <section className="loss-toolbar-card">
        <div className="loss-toolbar-copy">
          <p className="section-label">Kiểm loss sản phẩm</p>
          <h2>
            <PackageX size={18} />
            <span>Quét barcode, đối chiếu stock và lưu kỳ kiểm</span>
          </h2>
          <p>Giao diện ưu tiên quét nhanh, nhập nhanh và xem lịch sử ở cùng một màn hình.</p>
        </div>

        <div className="summary-strip summary-strip-inline" aria-label="Tổng quan check loss">
          {moduleSummaryItems.map((item) => (
            <article
              key={`loss-summary-${item.label}`}
              className={`summary-card ${item.highlight ? 'summary-card-highlight' : ''}`}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="loss-workspace-grid">
        <article className="loss-card loss-entry-card">
          <div className="loss-card-head">
            <div>
              <h3>
                <Barcode size={18} />
                <span>{t('currentScanSheet')}</span>
              </h3>
              <p>{t('currentScanHint')}</p>
            </div>
          </div>

          <form className="loss-entry-form" onSubmit={handleLossScanSubmit}>
            <label className="field">
              <span>{t('periodName')}</span>
              <input
                type="text"
                value={lossPeriodName}
                onChange={(event) => setLossPeriodName(event.target.value)}
                placeholder={t('periodPlaceholder')}
              />
            </label>

            <label className="field">
              <span>{t('barcodeLabel')}</span>
              <div className="loss-scan-row">
                <input
                  type="text"
                  value={lossBarcodeInput}
                  onChange={(event) => setLossBarcodeInput(event.target.value)}
                  placeholder={t('barcodePlaceholder')}
                  autoComplete="off"
                />
                <button type="button" className="secondary-button loss-scan-button" onClick={openBarcodeScanner}>
                  <Camera size={16} />
                  <span>{t('btnScan')}</span>
                </button>
                <button type="submit" className="primary-button">
                  <ListChecks size={16} />
                  <span>{t('btnAdd')}</span>
                </button>
              </div>
            </label>
          </form>

          <div className="loss-entry-actions">
            <button type="button" className="secondary-button" onClick={resetLossDraft}>
              {t('btnResetDraft')}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={isExportingLossFile || lossDraftItems.length === 0}
              onClick={() => exportLossExcel(null)}
            >
              <Download size={15} />
              <span>{isExportingLossFile ? t('btnExporting') : t('btnExportExcelCurrent')}</span>
            </button>
            <button
              type="button"
              className="success-button"
              disabled={isSavingLossAudit || lossDraftItems.length === 0}
              onClick={handleSaveLossAudit}
            >
              <ClipboardList size={16} />
              <span>{isSavingLossAudit ? t('btnSaving') : t('btnSavePeriod')}</span>
            </button>
          </div>

          {canUseLossTools ? null : (
            <p className="helper-text loss-readonly-note">
              {authUser ? 'Tai khoan nay chi co quyen xem module loss.' : t('readOnlyNote')}
            </p>
          )}

          <div className="loss-draft-list">
            {filteredLossDraftItems.length > 0 ? (
              filteredLossDraftItems.map((item) => {
                const linkedProduct = productCodeLookup.get(
                  normaliseProductCode(item?.barcode || item?.productId || item?.sku),
                );
                const stockMeta = getStockMeta(linkedProduct?.stockStatus || item?.stockStatus);
                const metrics = getLossItemMetrics(item);

                return (
                  <article key={item.id} className="loss-item-row">
                    <div className="loss-item-main">
                      <h4>
                        <HighlightText text={resolveProductName(item) || t('unlabeledProduct')} highlight={lossSearchTerm} />
                      </h4>
                      <p>
                        {item.lineKey} | {t('labelLoc')} {item.locId} | SKU {item.sku || '--'}
                      </p>
                      <p>
                        Barcode: {item.barcode || '--'} | Product ID: {item.productId || '--'}
                      </p>
                      {(item.division || item.department) && (
                        <p style={{ marginTop: '0.1rem', color: 'var(--accent-primary)', fontSize: '0.62rem', fontWeight: 800 }}>
                          {[item.divisionName || item.division, item.departmentName || item.department].filter(Boolean).join(' » ')}
                        </p>
                      )}
                    </div>

                    <div className="loss-item-controls">
                      <span className={`stock-summary-pill stock-summary-pill-${stockMeta.tone}`}>
                        <span>Stock</span>
                        <strong>{stockMeta.shortLabel}</strong>
                      </span>

                      <label className="loss-qty-field">
                        <span>{t('systemStockLabel')}</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item?.systemStock ?? ''}
                          onChange={(event) => handleLossStockChange(item.id, 'systemStock', event.target.value)}
                        />
                      </label>

                      <label className="loss-qty-field">
                        <span>{t('actualStockLabel')}</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item?.actualStock ?? ''}
                          onChange={(event) => handleLossStockChange(item.id, 'actualStock', event.target.value)}
                        />
                      </label>

                      <div className="loss-delta-pill" title="Stock he thong tru stock thuc te">
                        <span>Loss</span>
                        <strong>{metrics.lossQuantity}</strong>
                      </div>

                      <button
                        type="button"
                        className="icon-button loss-remove-button"
                        onClick={() => handleLossRemoveItem(item.id)}
                        title="Xóa khỏi phiếu"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state loss-empty-state">
                <Database size={34} strokeWidth={1.4} />
                <p>{t('emptyLossDraft')}</p>
              </div>
            )}
          </div>
        </article>

        <article className="loss-card loss-history-card">
          <div className="loss-card-head">
            <div>
              <h3>
                <History size={18} />
                <span>{t('lossHistory')}</span>
              </h3>
              <p>{t('lossHistoryHint')}</p>
            </div>
          </div>

          <div className="loss-history-list">
            {filteredLossAudits.length > 0 ? (
              filteredLossAudits.map((audit) => {
                const createdAt = new Date(audit?.createdAt || '');
                const createdLabel = Number.isNaN(createdAt.getTime())
                  ? '--'
                  : createdAt.toLọcaleString('vi-VN');

                return (
                  <article key={audit.id || `${audit.periodName}-${audit.createdAt}`} className="loss-history-row">
                    <div className="loss-history-main">
                      <h4>{audit.periodName || t('historyPeriodTitle')}</h4>
                      <p>
                        {createdLabel} | {audit.createdByName || t('unknownCreator')}
                      </p>
                      <p>
                        {t('totalItems', audit.itemCount || (audit.items || []).length)} | {t('totalLossVal', audit.totalLossQuantity || audit.totalQuantity || 0)}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isExportingLossFile}
                      onClick={() => exportLossExcel(audit)}
                    >
                      <Download size={15} />
                      <span>{t('btnExportExcel')}</span>
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="empty-state loss-empty-state">
                <History size={34} strokeWidth={1.4} />
                <p>{t('noLossHistory')}</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </section>
  );

  const mapPanel = (
    <section className="map-panel">
      {isCompactView ? (
        <>
          <div className="map-panel-head">
            <div>
              <div className="section-label">{t('mapTitle')}</div>
              <p className="map-help-text">{t('mapHint')}</p>
            </div>
            {selectedShelf ? (
              <span className="mobile-selected-pill">
                {selectedShelf.id}-{selectedShelf.side}
              </span>
            ) : null}
          </div>

          <div className="map-panel-body">
            <div className="map-switcher">
              <button
                type="button"
                className={mobileMapSection === 'main' ? 'is-active' : ''}
                onClick={() => setMobileMapSection('main')}
              >
                Line chính
              </button>
              <button
                type="button"
                className={mobileMapSection === 'secondary' ? 'is-active' : ''}
                onClick={() => setMobileMapSection('secondary')}
              >
                Line phụ
              </button>
            </div>

            <div className="aisle-grid aisle-grid-mobile">
              {(mobileMapSection === 'secondary' ? SECONDARY_AISLES : MAIN_AISLES).map((item) => {
                const displayAisle = allLines.find(a => a.id === item.id) || item;
                return renderAisleCard(displayAisle, mobileMapSection === 'secondary' ? 'secondary' : 'primary');
              })}
            </div>
          </div>

          <div className="map-panel-footer">
            {renderAisleSummary(mobileMapSection === 'secondary' ? groupedSecondaryAisles : groupedMainAisles)}
          </div>
        </>
      ) : (
        <>
          <div className="map-panel-head">
            <div className="section-label">Bản đồ line hàng</div>
          </div>

          <div className="map-panel-body">
            <div className="section-label">Bản đồ line phụ</div>
            <div className="aisle-grid">
              {SECONDARY_AISLES.map((item) => {
                const displayAisle = allLines.find(a => a.id === item.id) || item;
                return renderAisleCard(displayAisle, 'secondary');
              })}
            </div>

            <div className="walkway">Lối đi chính | Picker Path</div>

            <div className="section-label">Bản đồ line chính</div>
            <div className="aisle-grid">
              {MAIN_AISLES.map((item) => {
                const displayAisle = allLines.find(a => a.id === item.id) || item;
                return renderAisleCard(displayAisle, 'primary');
              })}
            </div>
          </div>

          <div className="map-panel-footer">
            {renderAisleSummary(groupedSecondaryAisles)}
            {renderAisleSummary(groupedMainAisles)}
          </div>
        </>
      )}
    </section>
  );

  const canResizeDesktopLayout = !isCompactView && isWideDesktopView && Boolean(selectedShelf);
  const workspaceClassName = `workspace ${selectedShelf ? 'has-drawer' : 'no-drawer'} ${
    isCompactView ? 'is-compact' : 'is-desktop'
  } ${canResizeDesktopLayout ? 'has-desktop-resizer' : ''} ${isDesktopResizing ? 'is-resizing' : ''}`;
  const workspaceStyle = canResizeDesktopLayout
    ? {
        '--drawer-width': `${desktopDrawerWidth}px`,
      }
    : undefined;

  return (
    <div className="app-shell">
      {toast ? (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          <div className="toast-title">
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span>Thông báo hệ thống</span>
          </div>
          <p>{toast.message}</p>
        </div>
      ) : null}

      <header className="topbar">
        <div className="topbar-inner">
          {/* Logo - click để reset về màn hình chính */}
          {!mobileSearchOpen && (
            <div
              className="brand"
              role="button"
              tabIndex={0}
              title="Về trang chủ"
              onClick={() => {
                setSelectedId('L12-A');
                setActiveModule('pog');
                setSearchTerm('');
                setSearchInput('');
                setFocusedLọcId(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && setActiveModule('pog')}
            >
              <div className="brand-mark">
                <PackageSearch size={18} />
              </div>
              <div className="brand-text">
                <p className="brand-title">{isCompactView ? 'Picker' : 'Picker Assistant'}</p>
                {!isCompactView && <p className="brand-subtitle">{topbarModuleLabel}</p>}
              </div>
            </div>
          )}

          {!isCompactView && <div className="topbar-divider" />}

          {/* Module Switcher - Hide on mobile, moved to bottom nav */}
          {!isCompactView && (
            <div className="topbar-module-switch" role="tablist" aria-label="Chọn module">
              <button
                type="button"
                className={activeModule === 'pog' ? 'is-active' : ''}
                onClick={() => setActiveModule('pog')}
                title="Planogram (POG)"
              >
                <LayoutGrid size={18} />
                <span>POG</span>
              </button>
              <button
                type="button"
                className={activeModule === 'loss' ? 'is-active' : ''}
                onClick={() => setActiveModule('loss')}
                title={t('moduleLoss')}
              >
                <ClipboardList size={18} />
                <span>{t('moduleLoss')}</span>
              </button>
              <button
                type="button"
                className={activeModule === 'stock' ? 'is-active' : ''}
                onClick={() => setActiveModule('stock')}
                title={t('moduleStock')}
              >
                <CheckCircle2 size={18} />
                <span>{t('moduleStock')}</span>
              </button>
              <button
                type="button"
                className={activeModule === 'master' ? 'is-active' : ''}
                onClick={() => setActiveModule('master')}
                title="Master Data"
              >
                <Database size={18} />
                <span>Master</span>
              </button>
            </div>
          )}

          {/* Searchbox */}
          <label className={`searchbox ${mobileSearchOpen ? 'is-mobile-open' : ''}`}>
            <Search size={14} />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={topbarSearchPlaceholder}
              autoFocus={mobileSearchOpen}
            />
            {mobileSearchOpen && (
              <button 
                type="button" 
                className="mobile-search-close" 
                onClick={() => setMobileSearchOpen(false)}
              >
                <X size={14} />
              </button>
            )}
          </label>

          {/* Quick Actions */}
          <div className="topbar-quick-actions">
            {activeModule === 'pog' && (
              <button
                type="button"
                className="primary-button with-primary-importance"
                disabled={!canEditPog}
                onClick={openSyncModal}
                title={isReadOnly ? t('btnLogin') + ' để cập nhật POG' : t('btnUpdatePog')}
              >
                <Sparkles size={14} />
                <span className="hide-mobile">{t('btnUpdatePog')}</span>
              </button>
            )}

            {isReadOnly ? (
              <button
                type="button"
                className="secondary-button topbar-auth-btn"
                onClick={() => setShowLoginModal(true)}
                title={t('btnLogin')}
              >
                <LogIn size={14} />
                <span className="hide-mobile">{t('btnLogin')}</span>
              </button>
            ) : (
              <div className="topbar-auth-group">
                {authUser && (
                  <div className="topbar-user-chip hide-mobile">
                    <UserRound size={14} />
                    <span>{authUser.username || authUser.name || 'User'}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="secondary-button topbar-auth-btn btn-danger-mobile hide-mobile"
                  onClick={handleLogout}
                  title={t('btnLogout')}
                >
                  <LogOut size={14} />
                  <span className="hide-mobile">{t('btnLogout')}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className="topbar-icon-btn with-label hide-mobile"
              onClick={() => setIsDarkMode((prev) => !prev)}
              title={isDarkMode ? t('themeLight') : t('themeDark')}
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
              <span>{isDarkMode ? t('themeLight') : t('themeDark')}</span>
            </button>

            <button
              type="button"
              className="topbar-icon-btn with-label hide-mobile"
              onClick={() => setLanguage((l) => l === 'vi' ? 'en' : 'vi')}
              title="Switch language"
            >
              <Users size={14} />
              <span>{language === 'vi' ? 'English' : 'Tiếng Việt'}</span>
            </button>

            <button
              type="button"
              className="topbar-icon-btn mobile-search-toggle desktop-search-toggle"
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              title="Tìm kiếm"
            >
              <Search size={14} />
            </button>

            <button
              type="button"
              className="topbar-settings-btn"
              onClick={() => setShowSettings(true)}
              title={t('btnSettings')}
            >
              <Settings size={15} />
              <span>{t('settingsTitle')}</span>
            </button>
          </div>
        </div>
      </header>


      {!isCompactView && (
        <section className="summary-strip" aria-label="Tổng quan vận hành">
          {moduleSummaryItems.map((item) => (
            <article
              key={`top-summary-${item.label}`}
              className={`summary-card ${item.highlight ? 'summary-card-highlight' : ''}`}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>
      )}

      {activeModule === 'pog' ? (
        <main className={workspaceClassName} style={workspaceStyle}>
          {isCompactView ? (
            <>
              {drawerPanel}
              {mapPanel}
            </>
          ) : (
            canResizeDesktopLayout ? (
              <>
                {mapPanel}
                <div
                  className="workspace-divider"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize POG panel"
                  onPointerDown={handleDesktopResizeStart}
                />
                {drawerPanel}
              </>
            ) : (
              <>
                {mapPanel}
                {drawerPanel}
              </>
            )
          )}
        </main>
      ) : activeModule === 'loss' ? (
        <main className="workspace workspace-loss">
          {lossPanel}
        </main>
      ) : activeModule === 'stock' ? (
        <main className="workspace workspace-stock">
          {stockPanel}
        </main>
      ) : activeModule === 'master' ? (
        <main className="workspace workspace-master" style={{ padding: '0', background: '#f8fafc', height: '100%', overflow: 'hidden' }}>
          <div className="master-standalone-panel" style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            background: 'var(--bg-surface)',
            color: 'var(--text-main)'
          }}>
            <header className="panel-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-bright)', margin: 0 }}>Master Database</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Quản lý dữ liệu gốc toàn hệ thống</p>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  className="action-pill-btn"
                  style={{ background: 'var(--accent-primary)', color: 'white', border: 'none' }}
                  onClick={() => masterImportRef.current?.click()}
                >
                  <FileUp size={16} />
                  <span>Nhập Excel</span>
                </button>
                <button className="action-pill-btn" onClick={exportMasterExcel}>
                  <Download size={16} />
                  <span>Xuất Excel</span>
                </button>
                {canEditPog && (
                  <button 
                    className="action-pill-btn btn-danger-link" 
                    disabled={masterProducts.length === 0}
                    onClick={() => {
                        if (!window.confirm('CẢNH BÁO: Xóa toàn bộ dữ liệu Master? Thao tác này không thể hoàn tác.')) return;
                        handleClearMasterData();
                    }}
                  >
                    <Trash2 size={16} />
                    <span>Xóa Database</span>
                  </button>
                )}
              </div>
            </header>

            <div className="panel-subhead" style={{ padding: '0.75rem 1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)' }}>
               <div className="stock-search-field" style={{ maxWidth: '600px', boxShadow: 'none', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                  <Search className="search-icon" size={18} />
                  <input 
                    type="text" 
                    placeholder="Tìm theo SKU, Barcode, Tên, Bộ phận..."
                    value={masterSearchInput}
                    onChange={e => {
                        setMasterSearchInput(e.target.value);
                        setMasterPage(1);
                    }}
                  />
               </div>
            </div>

            <div className="panel-content" style={{ flex: 1, overflow: 'auto' }}>
                <table className="master-grid-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-app)' }}>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>SKU</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>Tên sản phẩm</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>Barcode</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>Division</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>Department</th>
                      {isAdminAccount && <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right' }}>Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {isMasterLoading ? (
                      [...Array(6)].map((_, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '1rem' }}><div className="skeleton" style={{ width: '80px', height: '1.2rem', background: 'var(--border-subtle)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div></td>
                          <td style={{ padding: '1rem' }}><div className="skeleton" style={{ width: '200px', height: '1.2rem', background: 'var(--border-subtle)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div></td>
                          <td style={{ padding: '1rem' }}><div className="skeleton" style={{ width: '120px', height: '1.2rem', background: 'var(--border-subtle)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div></td>
                          <td style={{ padding: '1rem' }}><div className="skeleton" style={{ width: '60px', height: '1.2rem', background: 'var(--border-subtle)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div></td>
                          <td style={{ padding: '1rem' }}><div className="skeleton" style={{ width: '100px', height: '1.2rem', background: 'var(--border-subtle)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div></td>
                          {isAdminAccount && <td></td>}
                        </tr>
                      ))
                    ) : (
                      filteredMasterProducts.slice((masterPage - 1) * ITEMS_PER_MASTER_PAGE, masterPage * ITEMS_PER_MASTER_PAGE).map(p => (
                        <tr key={p.sku} className="master-row-hover" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                             {p.sku}
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
                             {p.name}
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                             {p.barcode || '--'}
                          </td>
                          <td style={{ padding: '1rem' }}>
                             <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)', background: 'var(--accent-highlight)', padding: '0.2rem 0.5rem', borderRadius: '0.3rem', display: 'inline-block' }}>{p.division}</div>
                             <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{p.divisionName}</div>
                          </td>
                          <td style={{ padding: '1rem' }}>
                             <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-bright)' }}>{p.department}</div>
                             <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{p.departmentName}</div>
                          </td>
                          {isAdminAccount && (
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                              <button 
                                className="icon-button" 
                                style={{ color: '#ef4444' }}
                                onClick={() => handleDeleteMasterItem(p.sku)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {filteredMasterProducts.length === 0 && (
                   <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                      <PackageSearch size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                      <p style={{ color: '#94a3b8' }}>Không tìm thấy dữ liệu Master phù hợp</p>
                   </div>
                )}
            </div>

            <footer className="panel-pagination" style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-app)' }}>
               <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                 Tổng: <strong>{filteredMasterProducts.length}</strong> sản phẩm
               </div>
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                 <button 
                   className="action-pill-btn" 
                   disabled={masterPage === 1}
                   onClick={() => setMasterPage(p => p - 1)}
                   style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                 >
                   Trước
                 </button>
                 <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 0.5rem' }}>{masterPage}</span>
                 <button 
                   className="action-pill-btn"
                   disabled={masterPage * ITEMS_PER_MASTER_PAGE >= filteredMasterProducts.length}
                   onClick={() => setMasterPage(p => p + 1)}
                   style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                 >
                   Sau
                 </button>
               </div>
            </footer>
          </div>
        </main>
      ) : null}

      {showLoginModal ? (
        <div className="modal-backdrop" role="presentation">
          <section className="auth-card auth-form auth-modal-card login-modal">
            <div className="auth-brand">
              <div className="brand-mark">
                <PackageSearch size={22} />
              </div>
              <div>
                <p className="brand-title">Picker Assistant</p>
                <p className="brand-subtitle">Đăng nhập để tiếp tục</p>
              </div>
            </div>

            <div className="login-copy">
              <h1>{t('loginTitle')}</h1>
              <p>{t('loginSubtitle')}</p>
            </div>

            <div className="login-access-note">
              <strong>{t('loginNoteTitle')}</strong>
              <span>
                {t('loginNoteDesc')}
              </span>
            </div>

            <form className="auth-modal-form" onSubmit={handleLoginSubmit}>
              <label className="auth-field">
                <span>
                  <UserRound size={14} />
                  {t('usernameLabel')}
                </span>
                <input
                  type="text"
                  value={loginUsername}
                  autoComplete="username"
                  autoFocus
                  onChange={(event) => setLoginUsername(event.target.value)}
                  placeholder="Nhập tên đăng nhập"
                />
              </label>

              <label className="auth-field">
                <span>
                  <LogIn size={14} />
                  {t('passwordLabel')}
                </span>
                <input
                  type="password"
                  value={loginPassword}
                  autoComplete="current-password"
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                />
              </label>

              <div className="auth-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowLoginModal(false)}
                >
                  {t('btnCancel')}
                </button>

                <button type="submit" className="primary-button" disabled={isLoggingIn}>
                  {isLoggingIn ? <Loader2 size={16} className="auth-spinner" /> : <LogIn size={16} />}
                  <span>{isLoggingIn ? t('signingIn') : t('btnSignIn')}</span>
                </button>
              </div>
            </form>

          </section>
        </div>
      ) : null}

      {showBarcodeScanner ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal scanner-modal">
            <header className="modal-header">
              <div className="modal-title">
                <Camera size={28} />
                <span>{t('scannerTitle')}</span>
              </div>

              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button 
                  type="button" 
                  className={`icon-button ${isTorchOn ? 'is-active' : ''}`} 
                  onClick={toggleTorch}
                  style={{ color: isTorchOn ? 'var(--accent-primary)' : 'inherit', background: isTorchOn ? 'var(--accent-highlight)' : 'transparent' }}
                  title="Bat/Tat den flash"
                >
                  <Sun size={22} fill={isTorchOn ? "currentColor" : "none"} />
                </button>
                <button type="button" className="icon-button icon-button-light" onClick={closeBarcodeScanner}>
                  <X size={22} />
                </button>
              </div>
            </header>

            <div className="modal-body scanner-modal-body">
              <div className="scanner-render-area" style={{ display: scanResult ? 'none' : 'block' }}>
                <div className="scanner-stage">
                  <video ref={scannerVideoRef} className="scanner-video" muted playsInline autoPlay />
                  <div className="scanner-frame" aria-hidden="true" />
                </div>

                <div className="scanner-copy">
                  <strong>{t('scannerHint')}</strong>
                  <p>{t('scannerDescription')}</p>
                </div>

                {isScannerStarting ? (
                  <div className="shared-loading scanner-loading">
                    <span className="shared-loading-dot"></span>
                    <p>{t('scannerStarting')}</p>
                  </div>
                ) : null}

                {scannerError ? (
                  <div className="scanner-error">
                    <AlertTriangle size={16} />
                    <span>{scannerError}</span>
                  </div>
                ) : null}

                <div className="scanner-actions">
                  <button type="button" className="secondary-button" onClick={closeBarcodeScanner}>
                    {t('btnClose')}
                  </button>
                </div>
              </div>

              {scanResult && (
                <div className="scan-result-card">
                  <div className={`scan-result-status ${scanResult.found ? 'found' : 'not-found'}`}>
                    {scanResult.found ? (
                      <><CheckCircle2 size={20} /><span>Tìm thấy sản phẩm</span></>
                    ) : (
                      <><AlertTriangle size={20} /><span>Không tìm thấy sản phẩm</span></>
                    )}
                  </div>

                  <div className="scan-result-barcode">
                    <Barcode size={14} />
                    <span>{scanResult.barcode}</span>
                  </div>

                  {scanResult.found ? (
                    <table className="scan-result-table">
                      <tbody>
                        <tr>
                          <th>SKU</th>
                          <td>{scanResult.sku || '--'}</td>
                        </tr>
                        <tr>
                          <th>Tên sản phẩm</th>
                          <td>{scanResult.name || '--'}</td>
                        </tr>
                        <tr>
                          <th>Tồn kho (HT)</th>
                          <td className={`stock-val ${Number(scanResult.systemStock) > 0 ? 'in-stock' : ''}`}>
                            {scanResult.systemStock}
                          </td>
                        </tr>
                        <tr>
                          <th>Division</th>
                          <td>{scanResult.division || '--'}</td>
                        </tr>
                        <tr>
                          <th>Department</th>
                          <td>{scanResult.department || '--'}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <p className="scan-result-hint">
                      Mã <strong>{scanResult.barcode}</strong> chưa có trong Master Data. Hãy kiểm tra lại hoặc nhập Master Data trước.
                    </p>
                  )}

                  <div className="scan-result-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setScanResult(null);
                        lastScannedBarcodeRef.current = '';
                        startBarcodeScannerSession().catch(err => setScannerError(err.message));
                      }}
                    >
                      <Camera size={16} /> Quét tiếp
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => { setScanResult(null); closeBarcodeScanner(); }}
                    >
                      <CheckCircle2 size={16} /> Xong
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {showManagePogModal ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal">
            <header className="modal-header">
              <div className="modal-title">
                <Database size={24} />
                <span>{t('managePogTitle')}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                {canEditPog && Object.values(aisleProducts).some(items => items && items.length > 0) && (
                  <button 
                    type="button" 
                    className="secondary-button" 
                    onClick={async () => {
                      if (!isAdminAccount) {
                        setToast(buildToast('error', 'Chỉ tài khoản Quản lý mới có quyền xóa tất cả POG.'));
                        return;
                      }
                      if (!window.confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu POG của TẤT CẢ các line?')) return;
                      try {
                        await saveSharedState({}, lossAudits, 'pog');
                        setAisleProducts({});
                        setToast(buildToast('success', 'Đã xóa toàn bộ dữ liệu POG.'));
                      } catch (error) {
                        setToast(buildToast('error', 'Lỗi khi xóa: ' + error.message));
                      }
                    }}
                    style={{ color: '#dc2626', borderColor: '#fee2e2', background: '#fef2f2', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                  >
                    <Trash2 size={14} />
                    Xóa tất cả POG
                  </button>
                )}
                <button type="button" className="icon-button icon-button-light" onClick={() => setShowManagePogModal(false)}>
                  <X size={24} />
                </button>
              </div>
            </header>

            <div className="modal-body">
              <div className="extract-list">
                {Object.entries(aisleProducts).filter(([_, items]) => items && items.length > 0).sort((a, b) => a[0].localeCompare(b[0])).length > 0 ? (
                  Object.entries(aisleProducts)
                    .filter(([_, items]) => items && items.length > 0)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([lineKey, items]) => (
                      <div key={lineKey} className="extract-card">
                        <div className="extract-column-head">
                          <strong>Line {lineKey}</strong>
                          <span style={{marginLeft: '0.4rem'}}>{t('msgItems', items.length)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                          <button type="button" className="secondary-button" onClick={() => downloadPogData(lineKey)}>
                            <Download size={15} />
                            {t('btnDownloadExcel')}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ color: '#dc2626' }}
                            title={!canEditPog ? 'Tai khoan nay chi co quyen xem POG' : 'Xóa POG Line này'}
                            disabled={!canEditPog}
                            onClick={() => deletePogData(lineKey)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="empty-state">
                    <Database size={42} strokeWidth={1.4} />
                    <p>{t('emptyPogStorage')}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {showAiModal ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal">
            <header className="modal-header">
              <div className="modal-title">
                <TableProperties size={30} />
                <span>{t('aiModalTitle')}</span>
              </div>

              <button type="button" className="icon-button icon-button-light" onClick={closeSyncModal}>
                <X size={24} />
              </button>
            </header>

            <div className="modal-body">
              {aiStep === 1 ? (
                <div className="flow-step">
                  <div className="settings-grid">
                    <label className="field">
                      <span>{t('aiTargetLine')}</span>
                      <select value={targetLine} onChange={(event) => setTargetLine(event.target.value)}>
                        {allLines.map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.id} - {line.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="field">
                      <span>{t('aiTargetSide')}</span>
                      <div className="segment-control">
                        {['A', 'B'].map((side) => (
                          <button
                            key={side}
                            type="button"
                            className={targetSide === side ? 'is-active' : ''}
                            onClick={() => setTargetSide(side)}
                          >
                            {t('aiSideLabel', side)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label className="upload-zone">
                    <input type="file" accept="application/pdf" onChange={handleFileChange} />
                    <FileUp size={56} />
                    <strong>{t('aiUploadPrimary', uploadFile?.name)}</strong>
                    <span>{t('aiUploadSecondary')}</span>
                  </label>

                  <div className="step-actions">
                    <button
                      type="button"
                      className="primary-button primary-button-wide"
                      disabled={!uploadFile || isAiProcessing}
                      onClick={processUploadedPdf}
                    >
                      <Sparkles size={18} />
                      <span>{t('btnAnalyse')}</span>
                    </button>
                    <p className="helper-text">
                      Phân tích cục bộ trên máy. Nếu PDF có trang line và nhãn locId, app sẽ khoanh vị trí san pham tren hinh.
                    </p>
                  </div>
                </div>
              ) : null}

              {aiStep === 2 ? (
                <div className="processing-state">
                  <div className="spinner-ring">
                    <Target size={38} />
                  </div>
                  <div>
                    <h3>{t('aiAnalysing')}</h3>
                    <p>{t('aiAnalysingDesc')}</p>
                  </div>
                </div>
              ) : null}

              {aiStep === 3 ? (
                <div className="review-step">
                  {isAiProcessing && (
                    <div className="processing-overlay">
                      <div className="spinner-ring">
                        <Loader2 className="animate-spin" size={38} />
                      </div>
                      <p>{t('btnSaving')}</p>
                    </div>
                  )}
                  <div className="result-banner">
                    <div className="result-icon">
                      <Check size={22} strokeWidth={4} />
                    </div>
                    <div>
                      <strong>{t('aiSuccess')}</strong>
                      <p>
                        {t('aiFoundItems', extractedData.length)}
                        {extractedVisual?.src ? ` ${t('aiGeneratedLine')}` : '.'}
                      </p>
                    </div>
                  </div>

                  <div className="review-grid">
                    <PlanogramPreview
                      visual={extractedVisual}
                      highlightedLọcIds={[]}
                      showAllMarkers
                      enableMagnifier={!isCompactView}
                    />

                    <div className="extract-column">
                      <div className="extract-column-head">
                        <strong>{t('aiExtractedList')}</strong>
                        <span>{t('totalItems', extractedData.length)}</span>
                      </div>

                      <div className="extract-list">
                        {extractedData.map((product, index) => (
                          <article key={`${product.locId}-${product.sku}-${index}`} className="extract-card">
                            <div>
                              <span className="product-badge">{t('labelLoc')} {product.locId}</span>
                              <h4>{String(product.name)}</h4>
                            </div>
                            <span className="extract-sku">{String(product.sku)}</span>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="review-actions">
                    <button type="button" className="secondary-button" disabled={isAiProcessing} onClick={() => setAiStep(1)}>
                      {t('btnScanAgain')}
                    </button>
                    <button type="button" className="success-button" disabled={isAiProcessing} onClick={confirmUpdate}>
                      <Check size={18} />
                      <span>{t('btnApply')}</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {/* ===== ACCOUNT CENTER MODAL (REWORKED) ===== */}
      {showManageUsersModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowManageUsersModal(false)}>
          <section className="modal account-center-modal" onClick={(e) => e.stopPropagation()}>
            <header className="account-center-header">
              <div className="account-center-header-copy">
                <p className="account-center-kicker">{manageAccountsLabel}</p>
                <h2>{manageAccountsLabel}</h2>
                <p className="account-center-subtitle">{t('accountCenterSubtitle')}</p>
              </div>
              <button
                type="button"
                className="icon-button account-center-close-button"
                onClick={() => setShowManageUsersModal(false)}
              >
                <X size={24} />
              </button>
            </header>

            <div className="account-center-tabs">
              <button 
                className={`tab-btn ${accountTab === 'profile' ? 'is-active' : ''}`}
                onClick={() => setAccountTab('profile')}
              >
                <UserRound size={16} />
                <span>{t('tabProfile')}</span>
              </button>
              {canManageAccounts && (
                <button 
                  className={`tab-btn ${accountTab === 'members' ? 'is-active' : ''}`}
                  onClick={() => setAccountTab('members')}
                >
                  <Users size={16} />
                  <span>{accountsTabLabel}</span>
                </button>
              )}
            </div>

            <div className="modal-body account-center-body">
              {accountTab === 'profile' ? (
                <div className="account-tab-shell">
                  <section className="account-section-card">
                    <div className="account-section-head">
                      <div>
                        <p className="account-section-kicker">{t('tabProfile')}</p>
                        <h3>{t('profileSectionTitle')}</h3>
                        <p>{t('profileSectionHint')}</p>
                      </div>
                    </div>

                    <div className="account-profile-hero">
                      <div className="account-profile-avatar">
                        <UserRound size={18} />
                      </div>
                      <div className="account-profile-meta">
                        <strong>{settingsAccountName}</strong>
                        <span>@{authUser?.username}</span>
                      </div>
                      <span className="account-profile-role">{settingsAccountRole}</span>
                    </div>

                    {isAdminAccount ? (
                      <p className="helper-text user-admin-note">
                        Tai khoan admin luon co day du quyen va chi doi duoc mat khau.
                      </p>
                    ) : null}

                  <form 
                    className="account-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const displayName = fd.get('displayName');
                      const password = fd.get('password');
                      const patch = {};
                      if (!isAdminAccount) {
                        patch.displayName = displayName;
                      }
                      if (password) patch.password = password;
                      
                      await handleUpdateUser(authUser.id, patch);
                      // Update local user info if needed
                      if (!isAdminAccount) {
                        setAuthUser(prev => ({ ...prev, displayName }));
                      }
                      e.currentTarget.reset();
                    }}
                  >
                    <div className="form-grid">
                      <div className="form-field">
                        <label>{t('lblUsername')}</label>
                        <input type="text" value={authUser?.username} disabled className="readonly-input" />
                      </div>
                      <div className="form-field">
                        <label>{t('lblDisplayName')}</label>
                        <input
                          name="displayName"
                          type="text"
                          defaultValue={authUser?.displayName}
                          required={!isAdminAccount}
                          disabled={isAdminAccount}
                          className={isAdminAccount ? 'readonly-input' : ''}
                        />
                      </div>
                      <div className="form-field">
                        <label>{t('lblPassword')} ({t('btnChangePassword')})</label>
                        <input name="password" type="password" placeholder="••••••" />
                      </div>
                    </div>
                    <button type="submit" className="primary-button save-profile-btn">
                      <Check size={18} />
                      <span>{t('btnSave')}</span>
                    </button>
                  </form>
                  </section>
                </div>
              ) : (
                <div className="account-tab-shell">
                  <section className="account-section-card">
                    <div className="account-section-head">
                      <div>
                        <p className="account-section-kicker">{accountsTabLabel}</p>
                        <h3>{createAccountLabel}</h3>
                        <p>{t('membersSectionHint')}</p>
                      </div>
                    </div>

                  <form 
                    className="add-user-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const payload = Object.fromEntries(fd.entries());
                      const ok = await handleCreateUser(payload);
                      if (ok) e.currentTarget.reset();
                    }}
                  >
                    <div className="form-grid compact-grid">
                      <div className="form-field">
                        <label>{t('lblDisplayName')}</label>
                        <input name="displayName" type="text" required placeholder="Nguyen Van A" />
                      </div>
                      <div className="form-field">
                        <label>{t('lblUsername')}</label>
                        <input name="username" type="text" required placeholder="user01" />
                      </div>
                      <div className="form-field">
                        <label>{t('lblPassword')}</label>
                        <input name="password" type="password" required placeholder="••••" />
                      </div>
                      <div className="form-field">
                        <label>{t('lblRole')}</label>
                        <select name="role" defaultValue="picker">
                          <option value="picker">{t('rolePicker')}</option>
                          <option value="admin">{t('roleAdmin')}</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="primary-button add-user-btn">
                      <UserPlus size={18} />
                      <span>{t('btnCreateUser')}</span>
                    </button>
                  </form>
                  </section>

                  <section className="account-section-card">
                    <div className="account-section-head">
                      <div>
                        <p className="account-section-kicker">{manageAccountsLabel}</p>
                        <h3>{accountListLabel}</h3>
                        <p>{t('membersListHint')}</p>
                      </div>
                    </div>

                  <div className="user-card-list">
                    {usersList.map((u) => {
                      const isLockedAdminUser = u.role === 'admin';

                      return (
                      <div key={u.id} className={`user-card ${u.enabled === false ? 'is-disabled' : ''} ${isLockedAdminUser ? 'is-admin-card' : ''}`}>
                        <div className="user-card-top">
                          <div className="user-card-avatar">
                            <UserRound size={22} />
                          </div>
                          <div className="user-card-meta">
                            <h3>{u.displayName || u.username}</h3>
                            <p>@{u.username}</p>
                          </div>
                          <div className="user-card-status">
                            {isLockedAdminUser ? (
                              <span className="settings-account-role-badge">Admin</span>
                            ) : null}
                            <div className="switch-ui" title={u.enabled !== false ? t('statusEnabled') : t('statusDisabled')}>
                              <input 
                                type="checkbox" 
                                id={`enabled-${u.id}`}
                                checked={u.enabled !== false} 
                                disabled={isLockedAdminUser}
                                onChange={(e) => handleUpdateUser(u.id, { enabled: e.target.checked })}
                              />
                              <label htmlFor={`enabled-${u.id}`} className="switch-slider"></label>
                            </div>
                          </div>
                        </div>

                        <div className="user-card-body">
                          <div className="user-card-roles">
                            <div className="form-field-compact">
                              <label>{t('lblRole')}</label>
                              <select 
                                className="inline-select"
                                value={u.role}
                                disabled={isLockedAdminUser}
                                onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                              >
                                <option value="picker">{t('rolePicker')}</option>
                                <option value="admin">{t('roleAdmin')}</option>
                              </select>
                            </div>

                            <div className="perm-switch-group">
                              {['pog', 'loss', 'stock'].map(p => (
                                <div key={p} className="perm-switch-item" title={t(`module${p.charAt(0).toUpperCase() + p.slice(1)}`)}>
                                  <div className="switch-ui">
                                    <input 
                                      type="checkbox" 
                                      id={`perm-${u.id}-${p}`}
                                      checked={!!u.permissions?.[p]} 
                                      disabled={isLockedAdminUser}
                                      onChange={() => {
                                        const nextPerms = { ...u.permissions, [p]: !u.permissions?.[p] };
                                        handleUpdateUser(u.id, { permissions: nextPerms });
                                      }}
                                    />
                                    <label htmlFor={`perm-${u.id}-${p}`} className="switch-slider"></label>
                                  </div>
                                  <span>{p}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {isLockedAdminUser ? (
                          <p className="helper-text user-admin-note">
                            Tai khoan admin luon dung duoc tat ca chuc nang va chi reset mat khau.
                          </p>
                        ) : null}

                        <div className="user-card-actions">
                          <button 
                            type="button" 
                            className="action-btn-pill"
                            onClick={() => {
                              const newPass = window.prompt(`${t('btnResetPassword')} for ${u.username}:`);
                              if (newPass && newPass.length >= 4) {
                                handleUpdateUser(u.id, { password: newPass });
                              }
                            }}
                          >
                            <Key size={14} />
                            <span>{t('btnResetPassword')}</span>
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                  </section>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}


      {/* ===== SETTINGS PANEL ===== */}
      {showSettings ? (
        <div className="settings-backdrop" role="dialog" aria-modal="true" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <div className="settings-header-copy">
                <p className="settings-kicker">{t('settingsTitle')}</p>
                <h2>{t('settingsTitle')}</h2>
                <p className="settings-subtitle">{t('settingsSubtitle')}</p>
              </div>

              <button
                type="button"
                className="icon-button settings-close-button"
                onClick={() => setShowSettings(false)}
                aria-label={t('btnClose')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="settings-body">
              <section className="settings-section-card">
                <div className="settings-section-head">
                  <div>
                    <p className="settings-section-eyebrow">{t('settingsDisplayTitle')}</p>
                    <h3 className="settings-card-title">{t('settingsDisplayTitle')}</h3>
                    <p className="settings-card-description">{t('settingsDisplayHint')}</p>
                  </div>
                </div>

                <div className="settings-compact-grid">
                  <div className="settings-cell">
                    <label className="settings-label">{t('settingsTheme')}</label>
                    <div className="compact-toggle">
                      <button type="button" className={!isDarkMode ? 'active' : ''} onClick={() => setIsDarkMode(false)}>
                        <div className="icon-box mini">
                          <Sun size={12} />
                        </div>
                        <span>{t('themeLight')}</span>
                      </button>
                      <button type="button" className={isDarkMode ? 'active' : ''} onClick={() => setIsDarkMode(true)}>
                        <div className="icon-box mini">
                          <Moon size={12} />
                        </div>
                        <span>{t('themeDark')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="settings-cell">
                    <label className="settings-label">{t('settingsLanguage')}</label>
                    <div className="compact-toggle">
                      <button type="button" className={language === 'vi' ? 'active' : ''} onClick={() => setLanguage('vi')}>
                        <div className="icon-box mini">
                          <span className="compact-toggle-code">VI</span>
                        </div>
                        <span>{t('langVi')}</span>
                      </button>
                      <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
                        <div className="icon-box mini">
                          <span className="compact-toggle-code">EN</span>
                        </div>
                        <span>{t('langEn')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="settings-cell wide">
                    <label className="settings-label">{t('settingsAccentColor')}</label>
                    <div className="accent-pills-row">
                      {ACCENT_COLORS.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          className={`accent-pill ${accentColor === color.hex ? 'active' : ''}`}
                          style={{ background: color.hex }}
                          onClick={() => setAccentColor(color.hex)}
                          aria-label={color.id}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="settings-cell wide">
                    <label className="settings-label">{t('settingsFont')}</label>
                    <select
                      className="compact-select"
                      value={selectedFont}
                      onChange={(event) => setSelectedFont(event.target.value)}
                    >
                      {FONT_OPTIONS.map((fontOption) => (
                        <option key={fontOption.family} value={fontOption.family}>
                          {fontOption.name}
                        </option>
                      ))}
                    </select>

                    <div className="settings-font-preview" style={{ fontFamily: `'${selectedFont}', system-ui, sans-serif` }}>
                      <span className="settings-font-preview-title">{selectedFontOption?.name || selectedFont}</span>
                      <span className="settings-font-preview-sample">Aa Bb 123</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="settings-section-card settings-section-account-card">
                <div className="settings-section-head">
                  <div>
                    <p className="settings-section-eyebrow">{t('settingsAccount')}</p>
                    <h3 className="settings-card-title">{t('settingsAccount')}</h3>
                    <p className="settings-card-description">{t('settingsAccountHint')}</p>
                  </div>
                </div>

                <div className="settings-account-minimal">
                  {authUser ? (
                    <div className="settings-account-shell">
                      <div className="settings-account-identity">
                        <div className="mini-avatar settings-account-avatar">
                          <UserRound size={18} />
                        </div>

                        <div className="settings-account-meta">
                          <span className="settings-account-name">{settingsAccountName}</span>
                          <span className="settings-account-subtitle">
                            {t('settingsSignedInAs')} {authUser.username}
                          </span>
                        </div>

                        <span className="settings-account-role-badge">{settingsAccountRole}</span>
                      </div>

                      <div className="settings-account-actions">
                        <button
                          type="button"
                          className="action-btn manage with-text"
                          onClick={() => {
                            setShowSettings(false);
                            setAccountTab('profile');
                            if (canManageAccounts) {
                              fetchUsersList();
                            }
                            setShowManageUsersModal(true);
                          }}
                        >
                          <Settings size={14} />
                          <span>{manageAccountsLabel}</span>
                        </button>

                        <button
                          type="button"
                          className="action-btn logout with-text"
                          onClick={() => {
                            setShowSettings(false);
                            handleLogout();
                          }}
                        >
                          <LogOut size={14} />
                          <span>{t('btnLogout')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="settings-guest-card">
                      <div className="settings-guest-copy">
                        <span className="settings-account-name">{t('settingsGuestTitle')}</span>
                        <span className="settings-account-subtitle">{t('settingsGuestHint')}</span>
                      </div>

                      <button
                        type="button"
                        className="login-btn-minimal"
                        onClick={() => {
                          setShowSettings(false);
                          setShowLoginModal(true);
                        }}
                      >
                        <LogIn size={15} />
                        <span>{t('btnLogin')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}


      {isCompactView && (
        <nav className="mobile-navigation">
          <button
            type="button"
            className={activeModule === 'pog' ? 'is-active' : ''}
            onClick={() => setActiveModule('pog')}
          >
            <div className="icon-wrapper">
              <LayoutGrid size={22} strokeWidth={activeModule === 'pog' ? 2.8 : 2} />
            </div>
            <span>POG</span>
          </button>
          <button
            type="button"
            className={activeModule === 'stock' ? 'is-active' : ''}
            onClick={() => setActiveModule('stock')}
          >
            <div className="icon-wrapper">
              <CheckCircle2 size={22} strokeWidth={activeModule === 'stock' ? 2.8 : 2} />
            </div>
            <span>{t('moduleStock')}</span>
          </button>
          <button
            type="button"
            className={activeModule === 'loss' ? 'is-active' : ''}
            onClick={() => setActiveModule('loss')}
          >
            <div className="icon-wrapper">
              <ClipboardList size={22} strokeWidth={activeModule === 'loss' ? 2.8 : 2} />
            </div>
            <span>{t('moduleLoss')}</span>
          </button>
          <button
            type="button"
            className={activeModule === 'master' ? 'is-active' : ''}
            onClick={() => setActiveModule('master')}
          >
            <div className="icon-wrapper">
              <TableProperties size={22} strokeWidth={activeModule === 'master' ? 2.8 : 2} />
            </div>
            <span>Master</span>
          </button>
        </nav>
      )}

      {/* Import Loading Overlay */}
      {isImportingMaster && (
        <div className="modal-backdrop" style={{ zIndex: 30000, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.8rem', color: 'white', textAlign: 'center', padding: '2rem' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }}></div>
              <Database size={32} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--accent-primary)' }} />
            </div>
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>Đang xử lý Master Data</h2>
              <p style={{ opacity: 0.85, fontSize: '1.05rem', maxWidth: '300px', margin: '0 auto', lineHeight: '1.5' }}>
                Vui lòng đợi trong giây lát. Hệ thống đang đồng bộ dữ liệu...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Global Hidden Inputs */}
      <input type="file" ref={masterImportRef} hidden accept=".xlsx,.xls,.csv" onChange={handleMasterImportExcel} />
    </div>
  );
}
