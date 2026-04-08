import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  History,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  PackageSearch,
  PackageX,
  Search,
  Trash2,
  Sparkles,
  TableProperties,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import { MAIN_AISLES, SECONDARY_AISLES } from './data';
import {
  buildToast,
  formatStockCheckedAt,
  getStockControlOptions,
  getStockMeta,
  mergeProductStockState,
  normaliseExtractedItems,
  normaliseSearchText,
} from './utils';

const STOCK_OPTIONS = getStockControlOptions();
const AUTH_TOKEN_STORAGE_KEY = 'picker-assistant-auth-token';
const LOSS_EXPORT_SHEET_NAME = 'Loss Details';
const LOSS_SUMMARY_SHEET_NAME = 'Summary';

function normaliseLocIdValue(value) {
  const asNumber = Number(value);

  if (Number.isFinite(asNumber) && asNumber > 0) {
    return String(Math.trunc(asNumber));
  }

  return String(value || '')
    .trim()
    .toLowerCase();
}

function getProductSearchableText(product) {
  const sku = String(product?.sku || '')
    .replace(/\s/g, '')
    .trim();
  const barcode = String(product?.barcode || product?.productId || product?.ean || '')
    .replace(/\s/g, '')
    .trim();

  return normaliseSearchText(
    `${product?.name || ''} ${product?.locId || ''} ${sku} ${barcode}`,
  );
}

function normaliseProductCode(value) {
  return String(value || '')
    .replace(/\s/g, '')
    .trim()
    .toLowerCase();
}

function makeLossPeriodLabel(date = new Date()) {
  const safeDate = date instanceof Date ? date : new Date(date);
  const stamp = Number.isNaN(safeDate.getTime())
    ? new Date()
    : safeDate;

  return `Ky kiem loss ${new Intl.DateTimeFormat('vi-VN', {
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
  highlightedLocIds,
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

  const highlighted = new Set((highlightedLocIds || []).map(normaliseLocIdValue));
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
      const markerLocKey = normaliseLocIdValue(marker.locId);
      const isHighlighted = highlighted.has(markerLocKey);

      return {
        marker,
        markerLocKey,
        normalizedY,
        x: rawX,
        isHighlighted,
        emphasis: marker.emphasis || 1,
        key: `${markerLocKey}-${rawX}-${rawY}-${index}`,
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
                  title={`Loc ${entry.markerLocKey}`}
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
                title={`Loc ${entry.markerLocKey}`}
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
  const [lossAudits, setLossAudits] = useState([]);
  const [isSharedLoading, setIsSharedLoading] = useState(true);
  const [isCompactView, setIsCompactView] = useState(() => window.innerWidth <= 760);
  const [isWideDesktopView, setIsWideDesktopView] = useState(() => window.innerWidth > 1180);
  const [activeModule, setActiveModule] = useState('pog');
  const [mobileMapSection, setMobileMapSection] = useState('main');
  const [selectedId, setSelectedId] = useState('L12-A');
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedLocId, setFocusedLocId] = useState(null);
  const [lossSearchTerm, setLossSearchTerm] = useState('');
  const [lossBarcodeInput, setLossBarcodeInput] = useState('');
  const [lossPeriodName, setLossPeriodName] = useState(() => makeLossPeriodLabel());
  const [lossDraftItems, setLossDraftItems] = useState([]);
  const [isSavingLossAudit, setIsSavingLossAudit] = useState(false);
  const [isExportingLossFile, setIsExportingLossFile] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isScannerStarting, setIsScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [cameraPermissionState, setCameraPermissionState] = useState('unknown');
  const [toast, setToast] = useState(null);
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '');
  const [authUser, setAuthUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [savingStockKey, setSavingStockKey] = useState('');

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiStep, setAiStep] = useState(1);
  const [targetLine, setTargetLine] = useState('L17');
  const [targetSide, setTargetSide] = useState('A');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const [extractedVisual, setExtractedVisual] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const scannerVideoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const scannerReaderRef = useRef(null);
  const scannerStreamRef = useRef(null);
  const scannerFrameRef = useRef(0);
  const scannerTimeoutRef = useRef(0);
  const lastScannedBarcodeRef = useRef('');
  const scannerFeedbackAudioContextRef = useRef(null);
  const [desktopDrawerWidth, setDesktopDrawerWidth] = useState(() => {
    const preferredWidth = Math.round(window.innerWidth * 0.38);
    return Math.min(Math.max(preferredWidth, 420), 780);
  });
  const [isDesktopResizing, setIsDesktopResizing] = useState(false);

  const allLines = useMemo(() => [...MAIN_AISLES, ...SECONDARY_AISLES], []);
  const searchKeyword = useMemo(() => normaliseSearchText(searchTerm), [searchTerm]);
  const lossSearchKeyword = useMemo(() => normaliseSearchText(lossSearchTerm), [lossSearchTerm]);
  const userLabel = authUser?.displayName || authUser?.username || 'Tài khoản';
  const isReadOnly = !authUser;
  const topbarSearchValue = activeModule === 'pog' ? searchTerm : lossSearchTerm;
  const topbarSearchPlaceholder =
    activeModule === 'pog'
      ? 'Tim ten, ma vach hoac vi tri...'
      : 'Tim SKU, barcode, ten san pham hoac ky kiem...';

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
        products: aisleProducts[selectedId] || [],
        visual: aisleVisuals[selectedId] || null,
      },
    };
  }, [aisleProducts, aisleVisuals, allLines, selectedId]);

  const globalMatches = useMemo(() => {
    if (!searchKeyword) {
      return [];
    }

    return Object.entries(aisleProducts).flatMap(([lineKey, products]) =>
      (products || [])
        .filter((product) => {
          return getProductSearchableText(product).includes(searchKeyword);
        })
        .map((product) => ({
          lineKey,
          product,
        })),
    );
  }, [aisleProducts, searchKeyword]);

  const matchedProducts = useMemo(() => {
    if (!selectedShelf || !searchKeyword) {
      return [];
    }

    return selectedShelf.data.products.filter((product) => {
      return getProductSearchableText(product).includes(searchKeyword);
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
      if (getProductSearchableText(product).includes(searchKeyword)) {
        matched.push(product);
      } else {
        unmatched.push(product);
      }
    });

    return [...matched, ...unmatched];
  }, [searchKeyword, selectedShelf]);

  const highlightedLocIds = useMemo(() => {
    const locIds = new Map();

    matchedProducts.forEach((product) => {
      const key = normaliseLocIdValue(product.locId);

      if (key) {
        locIds.set(key, product.locId);
      }
    });

    if (focusedLocId) {
      const focusedKey = normaliseLocIdValue(focusedLocId);

      if (focusedKey) {
        locIds.set(focusedKey, focusedLocId);
      }
    }

    return Array.from(locIds.values());
  }, [focusedLocId, matchedProducts]);

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

    Object.entries(aisleProducts).forEach(([lineKey, products]) => {
      (products || []).forEach((product) => {
        const sku = normaliseProductCode(product?.sku);
        const barcode = normaliseProductCode(
          product?.barcode || product?.productId || product?.ean || product?.sku,
        );
        const productId = normaliseProductCode(
          product?.productId || product?.barcode || product?.ean || product?.sku,
        );
        const entry = {
          lineKey,
          locId: product?.locId,
          name: String(product?.name || ''),
          sku: String(product?.sku || barcode || productId || ''),
          barcode: String(product?.barcode || product?.productId || product?.ean || product?.sku || ''),
          productId: String(product?.productId || product?.barcode || product?.ean || product?.sku || ''),
          stockStatus: getStockMeta(product?.stockStatus).id,
        };

        [sku, barcode, productId].forEach((code) => {
          if (code && !lookup.has(code)) {
            lookup.set(code, entry);
          }
        });
      });
    });

    return lookup;
  }, [aisleProducts]);

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
    setFocusedLocId(null);
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
        setToast(buildToast('error', error.message || 'Phiên đăng nhập đã hết hạn.'));
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

        const response = await fetch('/api/state', {
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
              setToast(buildToast('error', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'));
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
        setAisleVisuals(
          sharedState?.aisleVisuals && typeof sharedState.aisleVisuals === 'object'
            ? sharedState.aisleVisuals
            : {},
        );
        setLossAudits(Array.isArray(sharedState?.lossAudits) ? sharedState.lossAudits : []);
      } catch (error) {
        if (!active || silent) {
          return;
        }

        setToast(buildToast('error', error.message || 'Khong ket noi duoc kho du lieu dung chung.'));
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
    if (matchedProducts.length === 0) {
      return;
    }

    setFocusedLocId((current) => {
      if (!current) {
        return matchedProducts[0].locId;
      }

      const currentKey = normaliseLocIdValue(current);
      const hasCurrentLoc = matchedProducts.some((product) => {
        return normaliseLocIdValue(product.locId) === currentKey;
      });

      return hasCurrentLoc ? current : matchedProducts[0].locId;
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

  function openSyncModal() {
    if (isReadOnly) {
      setShowLoginModal(true);
      setToast(buildToast('error', 'Vui lòng đăng nhập để sử dụng tính năng cập nhật POG.'));
      return;
    }

    if (selectedId) {
      const [lineId, side] = selectedId.split('-');
      setTargetLine(lineId);
      setTargetSide(side || 'A');
    }

    setShowAiModal(true);
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    const username = loginUsername.trim();
    const password = loginPassword;

    if (!username || !password) {
      setToast(buildToast('error', 'Vui lòng nhập đầy đủ tài khoản và mật khẩu.'));
      return;
    }

    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.token) {
        throw new Error(payload?.error || `Đăng nhập thất bại (${response.status}).`);
      }

      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, payload.token);
      setAuthToken(payload.token);
      setAuthUser(payload.user || null);
      setLoginPassword('');
      setShowLoginModal(false);
      setToast(buildToast('success', `Xin chao ${payload?.user?.displayName || payload?.user?.username || username}.`));
    } catch (error) {
      setToast(buildToast('error', error.message || 'Đăng nhập thất bại.'));
    } finally {
      setIsLoggingIn(false);
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

  async function saveSharedState(nextProducts, nextVisuals, nextLossAudits = lossAudits) {
    if (!authToken || !authUser) {
      throw new Error('Vui lòng đăng nhập để chỉnh sửa dữ liệu.');
    }

    const response = await fetch('/api/state', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        aisleProducts: nextProducts,
        aisleVisuals: nextVisuals,
        lossAudits: Array.isArray(nextLossAudits) ? nextLossAudits : [],
      }),
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
    setAisleVisuals(savedState?.aisleVisuals || {});
    setLossAudits(Array.isArray(savedState?.lossAudits) ? savedState.lossAudits : []);

    return savedState;
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
      setToast(buildToast('error', 'Vui long tai len tep PDF truoc khi phan tich.'));
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
      setToast(buildToast('error', error.message || 'Khong the phan tich tep PDF.'));
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
      setToast(buildToast('error', 'Khong co du lieu hop le de cap nhat.'));
      return;
    }

    const nextProducts = {
      ...aisleProducts,
      [key]: cleanedItems,
    };
    const nextVisuals = extractedVisual?.src
      ? {
          ...aisleVisuals,
          [key]: extractedVisual,
        }
      : aisleVisuals;

    try {
      await saveSharedState(nextProducts, nextVisuals, lossAudits);
      setSelectedId(key);
      closeSyncModal();
      setToast(
        buildToast(
          'success',
          `Dong bo hoan tat: da nap ${cleanedItems.length} san pham vao ${key}${
            extractedVisual?.src ? ' kem hinh line.' : '.'
          }`,
        ),
      );
    } catch (error) {
      setToast(buildToast('error', error.message || 'Khong the luu du lieu dung chung.'));
    }
  }

  async function handleStockUpdate(product, nextStatus) {
    if (isReadOnly) {
      setShowLoginModal(true);
      setToast(buildToast('error', 'Vui lòng đăng nhập để cập nhật tồn kho.'));
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
      await saveSharedState(nextProducts, aisleVisuals, lossAudits);
    } catch (error) {
      setAisleProducts(previousProducts);
      setToast(buildToast('error', error.message || 'Khong luu duoc thong tin ton kho.'));
    } finally {
      setSavingStockKey((current) => (current === saveKey ? '' : current));
    }
  }

  function handleTopbarSearchChange(value) {
    if (activeModule === 'pog') {
      setSearchTerm(value);
      return;
    }

    setLossSearchTerm(value);
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
      }, 120);
    };

    scannerFrameRef.current = window.requestAnimationFrame(scanFrame);
    return true;
  }

  async function startZxingBarcodeDetection(videoElement) {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
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
        throw new Error('Trinh duyet nay khong ho tro camera barcode.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      scannerStreamRef.current = stream;

      const videoElement = scannerVideoRef.current;
      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.muted = true;
      await videoElement.play();
      setCameraPermissionState('granted');

      let hasActiveDetector = false;

      try {
        hasActiveDetector = await startNativeBarcodeDetection(videoElement);
      } catch {}

      try {
        await startZxingBarcodeDetection(videoElement);
        hasActiveDetector = true;
      } catch (error) {
        if (!hasActiveDetector) {
          throw error;
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
    setScannerError('');
    lastScannedBarcodeRef.current = '';
  }

  function openBarcodeScanner() {
    if (cameraPermissionState === 'unsupported') {
      setToast(buildToast('error', 'Thiet bi/trinh duyet nay khong ho tro camera barcode.'));
      return;
    }

    if (cameraPermissionState === 'denied') {
      setToast(buildToast('error', 'Camera dang bi chan. Hay cap quyen camera trong trinh duyet.'));
      return;
    }

    setScannerError('');
    ensureScannerFeedbackAudioReady().catch(() => {});
    setShowBarcodeScanner(true);
  }

  function addLossItemFromCode(rawCode, sourceLabel = 'scan') {
    const barcodeInput = normaliseProductCode(rawCode);

    if (!barcodeInput) {
      setToast(buildToast('error', 'Vui long nhap barcode hoac SKU truoc khi quet.'));
      return false;
    }

    setLossBarcodeInput(String(rawCode || '').trim());
    setLossSearchTerm(String(rawCode || '').trim());

    const matched = productCodeLookup.get(barcodeInput);

    if (!matched) {
      setToast(buildToast('error', `Khong tim thay san pham cho ma ${String(rawCode || '').trim()}.`));
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
                barcode: matched.barcode || matched.productId || matched.sku,
                productId: matched.productId || matched.barcode || matched.sku,
                sku: matched.sku || matched.barcode || matched.productId,
                name: matched.name || item.name || '',
                lineKey: matched.lineKey || item.lineKey,
                locId: matched.locId || item.locId,
                stockStatus: matched.stockStatus || item.stockStatus || 'unchecked',
                lastScannedAt: nowIso,
                lossQuantity: computeLossValue(item.systemStock, item.actualStock),
              }
            : item,
        );
      }

      return [
        {
          id: `loss-item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          barcode: matched.barcode || matched.productId || matched.sku,
          productId: matched.productId || matched.barcode || matched.sku,
          sku: matched.sku || matched.barcode || matched.productId,
          name: matched.name || '',
          lineKey: matched.lineKey,
          locId: matched.locId,
          systemStock: '',
          actualStock: '',
          lossQuantity: 0,
          stockStatus: matched.stockStatus || 'unchecked',
          scannedAt: nowIso,
          lastScannedAt: nowIso,
        },
        ...current,
      ];
    });

    setToast(
      buildToast(
        'success',
        `Da ${sourceLabel} ${matched.name || matched.sku || matched.barcode || 'san pham'} thanh cong.`,
      ),
    );

    return true;
  }

  function handleDetectedBarcode(scannedCode) {
    const didVibrate = triggerBarcodeScanFeedback();

    if (!didVibrate) {
      playScannerFeedbackTone();
    }

    addLossItemFromCode(scannedCode, 'quet');
    closeBarcodeScanner();
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
      setToast(buildToast('error', 'Khong co du lieu de xuat Excel.'));
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
      { field: 'Ky kiem', value: periodName },
      {
        field: 'Nguoi tao',
        value: sourceAudit?.createdByName || authUser?.displayName || authUser?.username || 'Guest',
      },
      { field: 'Thoi gian', value: createdAt },
      { field: 'Tong SKU', value: exportItems.length },
      { field: 'Tong stock he thong', value: totals.totalSystemStock },
      { field: 'Tong stock thuc te', value: totals.totalActualStock },
      { field: 'Tong loss', value: totals.totalLoss },
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

      setToast(buildToast('success', `Da xuat file ${fileName}.`));
    } catch (error) {
      setToast(buildToast('error', error.message || 'Khong the xuat file Excel.'));
    } finally {
      setIsExportingLossFile(false);
    }
  }

  async function handleSaveLossAudit() {
    if (isReadOnly) {
      setShowLoginModal(true);
      setToast(buildToast('error', 'Vui long dang nhap de luu ky kiem loss dung chung.'));
      return;
    }

    if (lossDraftItems.length === 0) {
      setToast(buildToast('error', 'Ky kiem loss dang rong. Hay quet barcode truoc khi luu.'));
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
      await saveSharedState(aisleProducts, aisleVisuals, nextLossAudits);
      setLossPeriodName(makeLossPeriodLabel());
      setLossBarcodeInput('');
      setLossDraftItems([]);
      setToast(
        buildToast(
          'success',
          `Da luu ky ${periodName}: ${nextAudit.itemCount} SKU, tong loss ${nextAudit.totalLossQuantity}.`,
        ),
      );
    } catch (error) {
      setToast(buildToast('error', error.message || 'Khong luu duoc ky kiem loss.'));
    } finally {
      setIsSavingLossAudit(false);
    }
  }

  function renderAisleCard(item, rowType) {
    const isSelectedLine = selectedId ? selectedId.split('-')[0] === item.id : false;
    const containerClass = [
      'aisle-card',
      rowType === 'secondary' ? 'aisle-card-muted' : '',
      isSelectedLine ? 'aisle-card-selected' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <article key={item.id} className={containerClass}>
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

  const selectedCount = selectedShelf?.data.products.length || 0;
  const topbarModuleLabel = activeModule === 'pog' ? 'POG workspace' : 'Check Loss workspace';
  const moduleSummaryItems =
    activeModule === 'pog'
      ? [
          {
            label: 'Line co du lieu',
            value: totalLineWithData,
          },
          {
            label: 'Tong SKU',
            value: totalSkuCount,
          },
          {
            label: 'Dang mo',
            value: selectedShelf ? `${selectedShelf.id}-${selectedShelf.side}` : 'Chua chon',
          },
          ...(searchKeyword
            ? [
                {
                  label: 'Ket qua tim',
                  value: globalMatches.length,
                  highlight: true,
                },
              ]
            : []),
        ]
      : [
          {
            label: 'Ky da luu',
            value: lossAudits.length,
          },
          {
            label: 'SKU dang quet',
            value: lossDraftSummary.totalItems,
          },
          {
            label: 'Stock he thong',
            value: lossDraftSummary.totalSystemStock,
          },
          {
            label: 'Tong loss',
            value: lossDraftSummary.totalLoss,
            highlight: true,
          },
        ];

  const drawerPanel = selectedShelf ? (
    <aside className={`drawer ${isCompactView ? 'drawer-mobile' : ''}`}>
      <div className={`drawer-header ${selectedShelf.cat === 'HBC' ? 'drawer-header-hbc' : ''}`}>
        <div>
          <p className="drawer-overline">
            Line {selectedShelf.id} | Side {selectedShelf.side}
          </p>
          <h2>
            <Target size={18} />
            <span>{selectedShelf.name}</span>
          </h2>
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
              <p>Dang dong bo du lieu line tu may chu...</p>
            </div>
          ) : null}

          {isCompactView ? (
            <div className="mobile-selected-summary">
              <span className="mobile-selected-pill">
                {selectedCount} san pham
              </span>
              <span className="mobile-selected-pill">
                {selectedShelf.cat}
              </span>
            </div>
          ) : null}

          <PlanogramPreview
            visual={selectedShelf.data.visual}
            highlightedLocIds={highlightedLocIds}
            enableMagnifier={!isCompactView}
          />

          <section className="stock-panel">
            <div className="stock-panel-head">
              <div>
                <strong>Kiem tra ton kho</strong>
                <p>
                  {selectedStockSummary.checked}/{selectedStockSummary.total} san pham da cap nhat stock
                </p>
              </div>
              {savingStockKey ? <span className="stock-saving-chip">Dang luu</span> : null}
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
                  normaliseLocIdValue(focusedLocId) === normaliseLocIdValue(product.locId);
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
                    onMouseEnter={() => setFocusedLocId(product.locId)}
                    onMouseLeave={() => setFocusedLocId(null)}
                    onFocus={() => setFocusedLocId(product.locId)}
                    onBlur={() => setFocusedLocId(null)}
                    onClick={() => setFocusedLocId(product.locId)}
                    tabIndex={0}
                  >
                    <div className="product-topline">
                      <div className="product-meta">
                        <span className={`product-badge ${isMatch ? 'product-badge-match' : ''}`}>
                          Nhan {product.locId}
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

                    {product.name ? (
                      <div className="product-name">
                        <HighlightText text={product.name} highlight={searchTerm} />
                      </div>
                    ) : (
                      <div className="product-placeholder" />
                    )}

                    <div className="product-footline">
                      {product.verified ? (
                        <div className="verified-pill">
                          <Check size={12} strokeWidth={4} />
                          <span>Da khop</span>
                        </div>
                      ) : (
                        <span className="stock-timestamp stock-timestamp-empty">Chua doi chieu</span>
                      )}

                      {product.stockCheckedAt ? (
                        <p className="stock-timestamp">
                          Cap nhat: {formatStockCheckedAt(product.stockCheckedAt)}
                        </p>
                      ) : (
                        <p className="stock-timestamp stock-timestamp-empty">Chua kiem tra ton kho</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Database size={42} strokeWidth={1.4} />
              <p>Line nay chua co du lieu hang hoa</p>
              {isReadOnly ? (
                <button type="button" className="inline-link" onClick={() => setShowLoginModal(true)}>
                  Đăng nhập để cập nhật POG
                </button>
              ) : (
                <button type="button" className="inline-link" onClick={openSyncModal}>
                  Dong bo tu PDF ngay
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  ) : null;

  const lossPanel = (
    <section className="loss-layout">
      <section className="loss-toolbar-card">
        <div className="loss-toolbar-copy">
          <p className="section-label">Kiem loss san pham</p>
          <h2>
            <PackageX size={18} />
            <span>Quet barcode, doi chieu stock va luu ky kiem</span>
          </h2>
          <p>Giao dien uu tien quet nhanh, nhap nhanh va xem lich su o cung mot man hinh.</p>
        </div>

        <div className="summary-strip summary-strip-inline" aria-label="Tong quan check loss">
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
                <span>Phieu quet hien tai</span>
              </h3>
              <p>Nhap hoac quet barcode de them san pham, sau do dien stock he thong va stock thuc te.</p>
            </div>
          </div>

          <form className="loss-entry-form" onSubmit={handleLossScanSubmit}>
            <label className="field">
              <span>Ten ky kiem</span>
              <input
                type="text"
                value={lossPeriodName}
                onChange={(event) => setLossPeriodName(event.target.value)}
                placeholder="VD: Ky kiem loss tuan 1"
              />
            </label>

            <label className="field">
              <span>Barcode / SKU / Product ID</span>
              <div className="loss-scan-row">
                <input
                  type="text"
                  value={lossBarcodeInput}
                  onChange={(event) => setLossBarcodeInput(event.target.value)}
                  placeholder="Nhap ma va nhan Enter"
                  autoComplete="off"
                />
                <button type="button" className="secondary-button loss-scan-button" onClick={openBarcodeScanner}>
                  <Camera size={16} />
                  <span>Quet</span>
                </button>
                <button type="submit" className="primary-button">
                  <ListChecks size={16} />
                  <span>Them</span>
                </button>
              </div>
            </label>
          </form>

          <div className="loss-entry-actions">
            <button type="button" className="secondary-button" onClick={resetLossDraft}>
              Lam moi phieu
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={isExportingLossFile || lossDraftItems.length === 0}
              onClick={() => exportLossExcel(null)}
            >
              <Download size={15} />
              <span>{isExportingLossFile ? 'Dang xuat...' : 'Xuat Excel phieu hien tai'}</span>
            </button>
            <button
              type="button"
              className="success-button"
              disabled={isSavingLossAudit || lossDraftItems.length === 0}
              onClick={handleSaveLossAudit}
            >
              <ClipboardList size={16} />
              <span>{isSavingLossAudit ? 'Dang luu...' : 'Luu ky loss'}</span>
            </button>
          </div>

          {!isReadOnly ? null : (
            <p className="helper-text loss-readonly-note">
              Dang o che do xem. Dang nhap de luu ky loss dung chung.
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
                        <HighlightText text={item.name || 'San pham chua co ten'} highlight={lossSearchTerm} />
                      </h4>
                      <p>
                        {item.lineKey} | Nhan {item.locId} | SKU {item.sku || '--'}
                      </p>
                      <p>
                        Barcode: {item.barcode || '--'} | Product ID: {item.productId || '--'}
                      </p>
                    </div>

                    <div className="loss-item-controls">
                      <span className={`stock-summary-pill stock-summary-pill-${stockMeta.tone}`}>
                        <span>Stock</span>
                        <strong>{stockMeta.shortLabel}</strong>
                      </span>

                      <label className="loss-qty-field">
                        <span>He thong</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item?.systemStock ?? ''}
                          onChange={(event) => handleLossStockChange(item.id, 'systemStock', event.target.value)}
                        />
                      </label>

                      <label className="loss-qty-field">
                        <span>Thuc te</span>
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
                        title="Xoa khoi phieu"
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
                <p>Phieu loss dang rong. Bat dau quet barcode de tao danh sach.</p>
              </div>
            )}
          </div>
        </article>

        <article className="loss-card loss-history-card">
          <div className="loss-card-head">
            <div>
              <h3>
                <History size={18} />
                <span>Lich su cac ky kiem loss</span>
              </h3>
              <p>Luu tru cac ky truoc do va xuat lai Excel bat cu luc nao.</p>
            </div>
          </div>

          <div className="loss-history-list">
            {filteredLossAudits.length > 0 ? (
              filteredLossAudits.map((audit) => {
                const createdAt = new Date(audit?.createdAt || '');
                const createdLabel = Number.isNaN(createdAt.getTime())
                  ? '--'
                  : createdAt.toLocaleString('vi-VN');

                return (
                  <article key={audit.id || `${audit.periodName}-${audit.createdAt}`} className="loss-history-row">
                    <div className="loss-history-main">
                      <h4>{audit.periodName || 'Ky kiem loss'}</h4>
                      <p>
                        {createdLabel} | {audit.createdByName || 'Khong ro nguoi tao'}
                      </p>
                      <p>
                        {audit.itemCount || (audit.items || []).length} SKU | Tong loss:{' '}
                        {audit.totalLossQuantity || audit.totalQuantity || 0}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isExportingLossFile}
                      onClick={() => exportLossExcel(audit)}
                    >
                      <Download size={15} />
                      <span>Xuat Excel</span>
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="empty-state loss-empty-state">
                <History size={34} strokeWidth={1.4} />
                <p>Chua co ky kiem loss nao duoc luu.</p>
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
              <div className="section-label">Ban do line</div>
              <p className="map-help-text">Chon nhom line, sau do cham vao mat ke A/B de xem chi tiet.</p>
            </div>
            {selectedShelf ? (
              <span className="mobile-selected-pill">
                {selectedShelf.id}-{selectedShelf.side}
              </span>
            ) : null}
          </div>

          <div className="map-switcher">
            <button
              type="button"
              className={mobileMapSection === 'main' ? 'is-active' : ''}
              onClick={() => setMobileMapSection('main')}
            >
              Line chinh
            </button>
            <button
              type="button"
              className={mobileMapSection === 'secondary' ? 'is-active' : ''}
              onClick={() => setMobileMapSection('secondary')}
            >
              Line phu
            </button>
          </div>

          <div className="aisle-grid aisle-grid-mobile">
            {(mobileMapSection === 'secondary' ? SECONDARY_AISLES : MAIN_AISLES).map((item) =>
              renderAisleCard(item, mobileMapSection === 'secondary' ? 'secondary' : 'primary'),
            )}
          </div>
        </>
      ) : (
        <>
          <div className="section-label">Ban do line phu</div>
          <div className="aisle-grid">{SECONDARY_AISLES.map((item) => renderAisleCard(item, 'secondary'))}</div>

          <div className="walkway">Loi di chinh | Picker Path</div>

          <div className="section-label">Ban do line chinh</div>
          <div className="aisle-grid">{MAIN_AISLES.map((item) => renderAisleCard(item, 'primary'))}</div>
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
            <span>Thong bao he thong</span>
          </div>
          <p>{toast.message}</p>
        </div>
      ) : null}

      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              <PackageSearch size={22} />
            </div>
            <div>
              <p className="brand-title">Picker Assistant</p>
              <p className="brand-subtitle">{topbarModuleLabel}</p>
            </div>
          </div>

          <div className="topbar-console">
            <div className="topbar-console-row topbar-console-row-meta">
              <div className="topbar-module-switch" role="tablist" aria-label="Chon module">
                <button
                  type="button"
                  className={activeModule === 'pog' ? 'is-active' : ''}
                  onClick={() => setActiveModule('pog')}
                >
                  POG
                </button>
                <button
                  type="button"
                  className={activeModule === 'loss' ? 'is-active' : ''}
                  onClick={() => setActiveModule('loss')}
                >
                  Check Loss
                </button>
              </div>

              <span className="topbar-user-chip">
                <UserRound size={14} />
                <span>{userLabel}</span>
              </span>
            </div>

            <div className="topbar-console-row topbar-console-row-actions">
              <label className="searchbox">
                <Search size={16} />
                <input
                  type="text"
                  value={topbarSearchValue}
                  onChange={(event) => handleTopbarSearchChange(event.target.value)}
                  placeholder={topbarSearchPlaceholder}
                />
              </label>

              <div className="topbar-quick-actions">
                {activeModule === 'pog' ? (
                  <button
                    type="button"
                    className="primary-button topbar-sync-button"
                    onClick={openSyncModal}
                    title={isReadOnly ? 'Dang nhap de cap nhat POG' : 'Cap nhat POG'}
                  >
                    <Sparkles size={16} />
                    <span>Cap nhat POG</span>
                  </button>
                ) : null}

                {isReadOnly ? (
                  <button
                    type="button"
                    className="secondary-button topbar-logout-button"
                    onClick={() => setShowLoginModal(true)}
                    title="Dang nhap"
                  >
                    <LogIn size={15} />
                    <span>Dang nhap</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary-button topbar-logout-button"
                    onClick={handleLogout}
                    title="Dang xuat"
                  >
                    <LogOut size={15} />
                    <span>Dang xuat</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="summary-strip" aria-label="Tong quan van hanh">
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

      {activeModule === 'pog' ? (
        <>
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

      {isCompactView ? (
        <section className="mobile-action-dock" aria-label="Tac vu nhanh">
          <button
            type="button"
            className="mobile-action-button mobile-action-primary"
            onClick={openSyncModal}
            title={isReadOnly ? 'Đăng nhập để cập nhật POG' : 'Cập nhật POG'}
          >
            <Sparkles size={16} />
            <span>Cap nhat POG</span>
          </button>

          {isReadOnly ? (
            <button
              type="button"
              className="mobile-action-button mobile-action-secondary"
              onClick={() => setShowLoginModal(true)}
              title="Đăng nhập để chỉnh sửa"
            >
              <LogIn size={16} />
              <span>Đăng nhập</span>
            </button>
          ) : (
            <button
              type="button"
              className="mobile-action-button mobile-action-secondary"
              onClick={handleLogout}
              title="Dang xuat"
            >
              <LogOut size={16} />
              <span>Dang xuat</span>
            </button>
          )}
        </section>
      ) : null}
        </>
      ) : (
        <main className="workspace workspace-loss">
          {lossPanel}
        </main>
      )}

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
              <h1>Đăng nhập tài khoản</h1>
              <p>Vui lòng đăng nhập để cập nhật POG và chỉnh sửa tồn kho.</p>
            </div>

            <div className="login-access-note">
              <strong>Không cần đăng nhập để xem dữ liệu</strong>
              <span>
                Bạn vẫn có thể xem line và tìm kiếm sản phẩm. Đăng nhập để cập nhật dữ liệu dùng chung.
              </span>
            </div>

            <form className="auth-modal-form" onSubmit={handleLoginSubmit}>
              <label className="auth-field">
                <span>
                  <UserRound size={14} />
                  Tài khoản
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
                  Mật khẩu
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
                  Hủy
                </button>

                <button type="submit" className="primary-button" disabled={isLoggingIn}>
                  {isLoggingIn ? <Loader2 size={16} className="auth-spinner" /> : <LogIn size={16} />}
                  <span>{isLoggingIn ? 'Đang xử lý...' : 'Đăng nhập'}</span>
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
                <span>Quet barcode bang camera</span>
              </div>

              <button type="button" className="icon-button icon-button-light" onClick={closeBarcodeScanner}>
                <X size={22} />
              </button>
            </header>

            <div className="modal-body scanner-modal-body">
              <div className="scanner-stage">
                <video ref={scannerVideoRef} className="scanner-video" muted playsInline autoPlay />
                <div className="scanner-frame" aria-hidden="true" />
              </div>

              <div className="scanner-copy">
                <strong>Huong camera vao barcode cua san pham</strong>
                <p>App se tu dong nhan barcode, doi chieu voi du lieu POG va them vao phieu loss.</p>
              </div>

              {isScannerStarting ? (
                <div className="shared-loading scanner-loading">
                  <span className="shared-loading-dot"></span>
                  <p>Dang khoi dong camera...</p>
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
                  Dong
                </button>
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
                <span>Cap nhat POG va hinh line</span>
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
                      <span>Line dich</span>
                      <select value={targetLine} onChange={(event) => setTargetLine(event.target.value)}>
                        {allLines.map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.id} - {line.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="field">
                      <span>Mat ke</span>
                      <div className="segment-control">
                        {['A', 'B'].map((side) => (
                          <button
                            key={side}
                            type="button"
                            className={targetSide === side ? 'is-active' : ''}
                            onClick={() => setTargetSide(side)}
                          >
                            Mat {side}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label className="upload-zone">
                    <input type="file" accept="application/pdf" onChange={handleFileChange} />
                    <FileUp size={56} />
                    <strong>{uploadFile ? uploadFile.name : 'Tai len PDF planogram'}</strong>
                    <span>App se doc text, tim hinh line, va map cac vi tri locId ngay tren may</span>
                  </label>

                  <div className="step-actions">
                    <button
                      type="button"
                      className="primary-button primary-button-wide"
                      disabled={!uploadFile || isAiProcessing}
                      onClick={processUploadedPdf}
                    >
                      <Sparkles size={18} />
                      <span>Phan tich tep tin</span>
                    </button>
                    <p className="helper-text">
                      Phan tich cuc bo tren may. Neu PDF co trang line va nhan locId, app se khoanh vi tri san pham tren hinh.
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
                    <h3>Dang phan tich PDF...</h3>
                    <p>App dang tach bang SKU va tim trang hinh line de map vi tri san pham.</p>
                  </div>
                </div>
              ) : null}

              {aiStep === 3 ? (
                <div className="review-step">
                  <div className="result-banner">
                    <div className="result-icon">
                      <Check size={22} strokeWidth={4} />
                    </div>
                    <div>
                      <strong>Phan tich thanh cong</strong>
                      <p>
                        Tim thay {extractedData.length} san pham hop le
                        {extractedVisual?.src ? ' va da tao preview line.' : '.'}
                      </p>
                    </div>
                  </div>

                  <div className="review-grid">
                    <PlanogramPreview
                      visual={extractedVisual}
                      highlightedLocIds={[]}
                      showAllMarkers
                      enableMagnifier={!isCompactView}
                    />

                    <div className="extract-column">
                      <div className="extract-column-head">
                        <strong>Danh sach san pham trich xuat</strong>
                        <span>{extractedData.length} SKU</span>
                      </div>

                      <div className="extract-list">
                        {extractedData.map((product, index) => (
                          <article key={`${product.locId}-${product.sku}-${index}`} className="extract-card">
                            <div>
                              <span className="product-badge">Nhan {product.locId}</span>
                              <h4>{String(product.name)}</h4>
                            </div>
                            <span className="extract-sku">{String(product.sku)}</span>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="review-actions">
                    <button type="button" className="secondary-button" onClick={() => setAiStep(1)}>
                      Quet lai file
                    </button>
                    <button type="button" className="success-button" onClick={confirmUpdate}>
                      Xac nhan dong bo
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
