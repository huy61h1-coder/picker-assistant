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
  LayoutGrid,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  PackageSearch,
  PackageX,
  Search,
  Settings,
  Trash2,
  Sparkles,
  TableProperties,
  Target,
  UserRound,
  UserPlus,
  Users,
  ShieldCheck,
  X,
  Moon,
  Sun,
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [lossAudits, setLossAudits] = useState([]);
  const [isSharedLoading, setIsSharedLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [language, setLanguage] = useState(() => localStorage.getItem('lang') || 'vi');
  const [selectedFont, setSelectedFont] = useState(() => localStorage.getItem('appFont') || 'Nunito');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('appAccentColor') || '#6366f1');
  const [showSettings, setShowSettings] = useState(false);

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
  const [focusedLọcId, setFocusedLọcId] = useState(null);
  const [lossSearchTerm, setLossSearchTerm] = useState('');
  const [lossBarcodeInput, setLossBarcodeInput] = useState('');
  const [checkStockSearchTerm, setCheckStockSearchTerm] = useState('');
  const [checkStockBarcodeInput, setCheckStockBarcodeInput] = useState('');
  const [lossPeriodName, setLossPeriodName] = useState(() => makeLossPeriodLabel());
  const [lossDraftItems, setLossDraftItems] = useState([]);
  const [isSavingLossAudit, setIsSavingLossAudit] = useState(false);
  const [isExportingLossFile, setIsExportingLossFile] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isScannerStarting, setIsScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState('');
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

  // Translation helper
  const t = (key) => translations[language]?.[key] ?? translations['vi']?.[key] ?? key;

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

  const allStockProducts = useMemo(() => {
    const productsList = [];
    Object.entries(aisleProducts).forEach(([lineKey, products]) => {
      (products || []).forEach((product) => {
        const sku = String(product?.sku || '').trim();
        const barcode = String(product?.barcode || product?.productId || product?.sku || '').trim();
        
        const matchingDraft = lossDraftItems.find(
          (item) =>
            (item.sku && String(item.sku).trim() === sku) ||
            (item.barcode && String(item.barcode).trim() === barcode)
        );

        const actualStockFromLoss = matchingDraft ? matchingDraft.actualStock : '--';
        
        productsList.push({
          ...product,
          lineKey,
          barcodeView: barcode,
          actualStockFromLoss
        });
      });
    });

    productsList.sort((a, b) => {
      const nameA = String(a.name || '').toLowerCase();
      const nameB = String(b.name || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    return productsList;
  }, [aisleProducts, lossDraftItems]);

  const filteredStockProducts = useMemo(() => {
    const keyword = normaliseSearchText(checkStockSearchTerm);
    if (!keyword) return allStockProducts;
    
    return allStockProducts.filter((product) => {
      const text = normaliseSearchText(`${product.sku} ${product.barcodeView} ${product.name}`);
      return text.includes(keyword);
    });
  }, [allStockProducts, checkStockSearchTerm]);

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

  const downloadPogData = (lineKey) => {
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
      'Product Name': item.name
    }));

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

  function openSyncModal() {
    if (isReadOnly) {
      setShowLoginModal(true);
      setToast(buildToast('error', t('errLoginRequired')));
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
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
    const nextVisuals = extractedVisual?.src
      ? {
          ...aisleVisuals,
          [key]: extractedVisual,
        }
      : aisleVisuals;

    setIsAiProcessing(true);
    try {
      await saveSharedState(nextProducts, nextVisuals, lossAudits);
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
    if (isReadOnly) {
      setShowLoginModal(true);
      setToast(buildToast('error', t('errLoginRequired')));
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
    const barcodeInput = normaliseProductCode(rawCode);

    if (!barcodeInput) {
      setToast(buildToast('error', t('errNeedInputBeforeScan')));
      return false;
    }

    setLossBarcodeInput(String(rawCode || '').trim());
    setLossSearchTerm(String(rawCode || '').trim());

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
        t('msgScanned', sourceLabel, matched.name || matched.sku || matched.barcode || 'sản phẩm'),
      ),
    );

    return true;
  }

  function handleDetectedBarcode(scannedCode) {
    const didVibrate = triggerBarcodeScanFeedback();

    if (!didVibrate) {
      playScannerFeedbackTone();
    }

    if (activeModule === 'stock') {
      setCheckStockSearchTerm(scannedCode);
      setCheckStockBarcodeInput(scannedCode);
    } else {
      addLossItemFromCode(scannedCode, 'quet');
    }
    closeBarcodeScanner();
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
    if (isReadOnly) {
      setShowLoginModal(true);
      setToast(buildToast('error', t('errLoginRequired')));
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
      await saveSharedState(aisleProducts, aisleVisuals, nextLossAudits);
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
          <h2>
            <Target size={16} />
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
              <p>Đang đồng bộ dữ liệu line từ máy chủ...</p>
            </div>
          ) : null}

          {isCompactView ? (
            <div className="mobile-selected-summary">
              <span className="mobile-selected-pill">
                {t('productCount')(selectedCount)}
              </span>
              <span className="mobile-selected-pill">
                {selectedShelf.cat}
              </span>
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
                  {t('stockUpdated')(selectedStockSummary.checked, selectedStockSummary.total)}
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
              {isReadOnly ? (
                <button type="button" className="inline-link" onClick={() => setShowLoginModal(true)}>
                  Đăng nhập để cập nhật POG
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
    <section className="loss-layout">
      <section className="loss-toolbar-card">
        <div className="loss-toolbar-copy">
          <p className="section-label">{t('stockTitle')}</p>
          <h2>
            <Database size={18} />
            <span>{t('stockSubtitle')}</span>
          </h2>
          <p>{t('stockDescription')}</p>
        </div>
      </section>

      <section className="loss-workspace-grid">
        <article className="loss-card loss-entry-card" style={{ gridColumn: '1 / -1' }}>
          <div className="loss-card-head">
            <div>
              <h3>
                <Barcode size={18} />
                <span>{t('stockScanTitle')}</span>
              </h3>
              <p>{t('stockScanHint')}</p>
            </div>
          </div>

          <form className="loss-entry-form" onSubmit={handleStockScanSubmit}>
            <label className="field">
              <span>Barcode / SKU / Product ID</span>
              <div className="loss-scan-row">
                <input
                  type="text"
                  value={checkStockBarcodeInput}
                  onChange={(event) => setCheckStockBarcodeInput(event.target.value)}
                  placeholder="Nhập mã và nhấn Enter"
                  autoComplete="off"
                />
                <button type="button" className="secondary-button loss-scan-button" onClick={openBarcodeScanner}>
                  <Camera size={16} />
                  <span>Quét barcode</span>
                </button>
                <button type="submit" className="primary-button">
                  <Search size={16} />
                  <span>Lọc tìm</span>
                </button>
              </div>
            </label>
          </form>

          {checkStockSearchTerm ? (
             <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--accent-primary)', borderRadius: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span>{t('filteringBy')} <strong>{checkStockSearchTerm}</strong></span>
               <button className="secondary-button" onClick={() => { setCheckStockSearchTerm(''); setCheckStockBarcodeInput(''); }}>{t('btnClearFilter')}</button>
             </div>
          ) : null}
          
          <div className="loss-draft-list" style={{ marginTop: '2rem' }}>
            {filteredStockProducts.length > 0 ? (
              filteredStockProducts.map((product, idx) => {
                const stockMeta = getStockMeta(product.stockStatus);
                return (
                  <article key={`${product.locId}-${product.sku}-${idx}`} className="loss-item-row" style={{ padding: '1.2rem', gap: '1.2rem' }}>
                    <div className="loss-item-main">
                      <h4>
                         <HighlightText text={product.name || 'Sản phẩm chưa có tên'} highlight={checkStockSearchTerm} />
                      </h4>
                      <p>{product.lineKey} | Nhãn {product.locId} | SKU {product.sku || '--'}</p>
                      <p>Barcode: {product.barcodeView || '--'}</p>
                    </div>

                    <div className="loss-item-controls" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', gap: '1rem' }}>
                      <span className={`stock-summary-pill stock-summary-pill-${stockMeta.tone}`}>
                        <span>Stock</span>
                        <strong>{stockMeta.shortLabel}</strong>
                      </span>
                      <div className="loss-delta-pill" style={{ background: '#f1f5f9', color: '#0f172a' }}>
                        <span>Hệ thống</span>
                        <strong>{product.systemStock ?? '--'}</strong>
                      </div>
                      <div className="loss-delta-pill" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
                        <span>Thực tế</span>
                        <strong>{product.actualStockFromLoss}</strong>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state loss-empty-state">
                <PackageSearch size={34} strokeWidth={1.4} />
                <p>{t('noProductFound')}</p>
              </div>
            )}
          </div>
        </article>
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

          {!isReadOnly ? null : (
            <p className="helper-text loss-readonly-note">
              {t('readOnlyNote')}
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
                        <HighlightText text={item.name || t('unlabeledProduct')} highlight={lossSearchTerm} />
                      </h4>
                      <p>
                        {item.lineKey} | {t('labelLoc')} {item.locId} | SKU {item.sku || '--'}
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
                        {t('totalItems')(audit.itemCount || (audit.items || []).length)} | {t('totalLossVal')(audit.totalLossQuantity || audit.totalQuantity || 0)}
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
            {(mobileMapSection === 'secondary' ? SECONDARY_AISLES : MAIN_AISLES).map((item) =>
              renderAisleCard(item, mobileMapSection === 'secondary' ? 'secondary' : 'primary'),
            )}
          </div>
        </>
      ) : (
        <>
          <div className="section-label">Bản đồ line phụ</div>
          <div className="aisle-grid">{SECONDARY_AISLES.map((item) => renderAisleCard(item, 'secondary'))}</div>

          <div className="walkway">Lối đi chính | Picker Path</div>

          <div className="section-label">Bản đồ line chính</div>
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
            <span>Thông báo hệ thống</span>
          </div>
          <p>{toast.message}</p>
        </div>
      ) : null}

      <header className="topbar">
        <div className="topbar-inner">
          {/* Logo - click để reset về màn hình chính */}
          <div
            className="brand"
            role="button"
            tabIndex={0}
            title="Về trang chủ"
            onClick={() => {
              setSelectedId('L12-A');
              setActiveModule('pog');
              setSearchTerm('');
              setFocusedLọcId(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && setActiveModule('pog')}
          >
            <div className="brand-mark">
              <PackageSearch size={18} />
            </div>
            <div className="brand-text">
              <p className="brand-title">Picker Assistant</p>
              <p className="brand-subtitle">{topbarModuleLabel}</p>
            </div>
          </div>

          <div className="topbar-divider" />

          {/* Module Switcher */}
          <div className="topbar-module-switch" role="tablist" aria-label="Chọn module">
            <button
              type="button"
              className={activeModule === 'pog' ? 'is-active' : ''}
              onClick={() => setActiveModule('pog')}
            >
              <LayoutGrid size={18} />
              <span>POG</span>
            </button>
            <button
              type="button"
              className={activeModule === 'loss' ? 'is-active' : ''}
              onClick={() => setActiveModule('loss')}
            >
              <ClipboardList size={18} />
              <span>{t('moduleLoss')}</span>
            </button>
            <button
              type="button"
              className={activeModule === 'stock' ? 'is-active' : ''}
              onClick={() => setActiveModule('stock')}
            >
              <CheckCircle2 size={18} />
              <span>{t('moduleStock')}</span>
            </button>
          </div>

          {/* Searchbox */}
          <label className={`searchbox ${mobileSearchOpen ? 'is-mobile-open' : ''}`}>
            <Search size={14} />
            <input
              type="text"
              value={topbarSearchValue}
              onChange={(event) => handleTopbarSearchChange(event.target.value)}
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
            {activeModule === 'pog' ? (
              <>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowManagePogModal(true)}
                >
                  <Database size={14} />
                  <span>{t('btnManagePog')}</span>
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={isReadOnly}
                  onClick={openSyncModal}
                  title={isReadOnly ? t('btnLogin') + ' để cập nhật POG' : t('btnUpdatePog')}
                >
                  <Sparkles size={14} />
                  <span>{t('btnUpdatePog')}</span>
                </button>
              </>
            ) : null}

            {isReadOnly ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowLoginModal(true)}
                title={t('btnLogin')}
              >
                <LogIn size={14} />
                <span>{t('btnLogin')}</span>
              </button>
            ) : (
              <>
                {authUser ? (
                  <div className="topbar-user-chip">
                    <UserRound size={14} />
                    <span>{authUser.username || authUser.name || 'User'}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleLogout}
                  title={t('btnLogout')}
                >
                  <LogOut size={14} />
                  <span>{t('btnLogout')}</span>
                </button>
              </>
            )}

            <button
              type="button"
              className="topbar-icon-btn with-label"
              onClick={() => setIsDarkMode((prev) => !prev)}
              title={isDarkMode ? t('themeLight') : t('themeDark')}
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
              <span>{isDarkMode ? t('themeLight') : t('themeDark')}</span>
            </button>

            <button
              type="button"
              className="topbar-icon-btn with-label"
              onClick={() => setLanguage((l) => l === 'vi' ? 'en' : 'vi')}
              title="Switch language"
            >
              <Users size={14} />
              <span>{language === 'vi' ? 'English' : 'Tiếng Việt'}</span>
            </button>

            <button
              type="button"
              className="topbar-icon-btn mobile-search-toggle"
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
        <section className="mobile-action-dock" aria-label="Tác vụ nhanh">
          <button
            type="button"
            className="mobile-action-button mobile-action-secondary"
            onClick={() => setShowManagePogModal(true)}
            title="Dữ liệu POG"
          >
            <div className="icon-box">
              <Database size={18} />
            </div>
            <span>Dữ liệu POG</span>
          </button>
          
          <button
            type="button"
            className="mobile-action-button mobile-action-primary"
            onClick={openSyncModal}
            title={isReadOnly ? 'Đăng nhập để cập nhật POG' : 'Cập nhật POG'}
          >
            <div className="icon-box">
              <Sparkles size={18} />
            </div>
            <span>Cập nhật POG</span>
          </button>

          {isReadOnly ? (
            <button
              type="button"
              className="mobile-action-button mobile-action-secondary"
              onClick={() => setShowLoginModal(true)}
              title="Đăng nhập để chỉnh sửa"
            >
              <div className="icon-box">
                <LogIn size={18} />
              </div>
              <span>Đăng nhập</span>
            </button>
          ) : (
            <button
              type="button"
              className="mobile-action-button mobile-action-secondary"
              onClick={handleLogout}
              title="Đăng xuất"
            >
              <div className="icon-box">
                <LogOut size={18} />
              </div>
              <span>Đăng xuất</span>
            </button>
          )}
        </section>
      ) : null}
        </>
      ) : activeModule === 'loss' ? (
        <main className="workspace workspace-loss">
          {lossPanel}
        </main>
      ) : activeModule === 'stock' ? (
        <main className="workspace workspace-stock">
          {stockPanel}
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
              <button type="button" className="icon-button icon-button-light" onClick={() => setShowManagePogModal(false)}>
                <X size={24} />
              </button>
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
                          <button type="button" className="secondary-button" style={{ color: '#dc2626' }} title="Xóa POG Line này" onClick={() => deletePogData(lineKey)}>
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
                            {t('aiSideLabel')(side)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label className="upload-zone">
                    <input type="file" accept="application/pdf" onChange={handleFileChange} />
                    <FileUp size={56} />
                    <strong>{t('aiUploadPrimary')(uploadFile?.name)}</strong>
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
                        {t('aiFoundItems')(extractedData.length)}
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
                        <span>{t('totalItems')(extractedData.length)}</span>
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
            <header className="modal-header">
              <div className="modal-title">
                <UserRound size={24} />
                <span>{t('accountCenterTitle')}</span>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowManageUsersModal(false)}>
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
              {authUser?.role === 'admin' && (
                <button 
                  className={`tab-btn ${accountTab === 'members' ? 'is-active' : ''}`}
                  onClick={() => setAccountTab('members')}
                >
                  <Users size={16} />
                  <span>{t('tabMembers')}</span>
                </button>
              )}
            </div>

            <div className="modal-body">
              {accountTab === 'profile' ? (
                <div className="profile-tab-content">
                  <form 
                    className="account-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const displayName = fd.get('displayName');
                      const password = fd.get('password');
                      const patch = { displayName };
                      if (password) patch.password = password;
                      
                      await handleUpdateUser(authUser.id, patch);
                      // Update local user info if needed
                      setAuthUser(prev => ({ ...prev, displayName }));
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
                        <input name="displayName" type="text" defaultValue={authUser?.displayName} required />
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
                </div>
              ) : (
                <div className="members-tab-content">
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

                  <div className="user-table-wrapper">
                    <table className="user-table">
                      <thead>
                        <tr>
                          <th>{t('lblUsername')}</th>
                          <th>{t('lblDisplayName')}</th>
                          <th>{t('lblRole')}</th>
                          <th>{t('lblPermissions')}</th>
                          <th>{t('btnResetPassword')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.map((u) => (
                          <tr key={u.id} className={u.enabled === false ? 'is-disabled' : ''}>
                            <td>
                              <div className="user-cell-main">
                                <strong>{u.username}</strong>
                                <div className="toggle-switch mini">
                                  <input 
                                    type="checkbox" 
                                    checked={u.enabled !== false} 
                                    onChange={(e) => handleUpdateUser(u.id, { enabled: e.target.checked })}
                                  />
                                  <span className="toggle-slider"></span>
                                </div>
                              </div>
                            </td>
                            <td>{u.displayName}</td>
                            <td>
                              <select 
                                className="inline-select"
                                value={u.role}
                                onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                              >
                                <option value="picker">{t('rolePicker')}</option>
                                <option value="admin">{t('roleAdmin')}</option>
                              </select>
                            </td>
                            <td>
                              <div className="permission-pills">
                                {['pog', 'loss', 'stock'].map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    className={`perm-pill ${u.permissions?.[p] ? 'is-active' : ''}`}
                                    disabled={u.role === 'admin'}
                                    onClick={() => {
                                      const nextPerms = { ...u.permissions, [p]: !u.permissions?.[p] };
                                      handleUpdateUser(u.id, { permissions: nextPerms });
                                    }}
                                  >
                                    {p.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td>
                              <button 
                                type="button" 
                                className="icon-button"
                                title={t('btnResetPassword')}
                                onClick={() => {
                                  const newPass = window.prompt(`${t('btnResetPassword')} for ${u.username}:`);
                                  if (newPass && newPass.length >= 4) {
                                    handleUpdateUser(u.id, { password: newPass });
                                  }
                                }}
                              >
                                <Sparkles size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
              <h2>{t('settingsTitle')}</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowSettings(false)}
                aria-label={t('btnClose')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="settings-body">
              <div className="settings-compact-grid">
                <div className="settings-cell">
                  <label className="settings-label">{t('settingsTheme')}</label>
                  <div className="compact-toggle">
                    <button className={!isDarkMode ? 'active' : ''} onClick={() => setIsDarkMode(false)}>
                      <div className="icon-box mini">
                        <Sun size={12} />
                      </div>
                      <span>{t('themeLight')}</span>
                    </button>
                    <button className={isDarkMode ? 'active' : ''} onClick={() => setIsDarkMode(true)}>
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
                    <button className={language === 'vi' ? 'active' : ''} onClick={() => setLanguage('vi')}>
                      <div className="icon-box mini">
                         <span style={{ fontSize: '10px' }}>VI</span>
                      </div>
                      <span>{t('langVi')}</span>
                    </button>
                    <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
                      <div className="icon-box mini">
                         <span style={{ fontSize: '10px' }}>EN</span>
                      </div>
                      <span>{t('langEn')}</span>
                    </button>
                  </div>
                </div>
                <div className="settings-cell wide">
                  <label className="settings-label">{t('settingsAccentColor')}</label>
                  <div className="accent-pills-row">
                    {ACCENT_COLORS.map(c => (
                      <button 
                        key={c.id} 
                        className={`accent-pill ${accentColor === c.hex ? 'active' : ''}`}
                        style={{ background: c.hex }}
                        onClick={() => setAccentColor(c.hex)}
                      />
                    ))}
                  </div>
                </div>
                <div className="settings-cell wide">
                  <label className="settings-label">{t('settingsFont')}</label>
                  <select 
                    className="compact-select" 
                    value={selectedFont} 
                    onChange={(e) => setSelectedFont(e.target.value)}
                  >
                    {FONT_OPTIONS.map(f => <option key={f.family} value={f.family}>{f.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="settings-account-minimal">
                {authUser ? (
                  <div className="account-row-compact">
                    <div className="user-mini-info">
                      <div className="mini-avatar"><UserRound size={16} /></div>
                      <div className="mini-meta">
                        <span className="name">{authUser.displayName || authUser.username}</span>
                        <span className="role">{t(authUser.role === 'admin' ? 'roleAdmin' : 'rolePicker')}</span>
                      </div>
                    </div>
                    <div className="account-mini-actions">
                      <button 
                        className="action-btn manage with-text"
                        onClick={() => {
                          setShowSettings(false);
                          setAccountTab('profile');
                          if (authUser.role === 'admin') fetchUsersList();
                          setShowManageUsersModal(true);
                        }}
                      >
                        <Settings size={14} />
                        <span>{t('accountCenterTitle')}</span>
                      </button>
                      <button className="action-btn logout with-text" onClick={() => { setShowSettings(false); handleLogout(); }}>
                        <LogOut size={14} />
                        <span>{t('btnLogout')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="login-btn-minimal" onClick={() => { setShowSettings(false); setShowLoginModal(true); }}>
                    <LogIn size={15} />
                    <span>{t('btnLogin')}</span>
                  </button>
                )}
              </div>
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
            className={activeModule === 'stock' ? 'is-active' : ''}
            onClick={() => setActiveModule('stock')}
          >
            <div className="icon-wrapper">
              <CheckCircle2 size={22} strokeWidth={activeModule === 'stock' ? 2.8 : 2} />
            </div>
            <span>{t('moduleStock')}</span>
          </button>
        </nav>
      )}

    </div>
  );
}
