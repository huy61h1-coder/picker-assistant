"use client";

import {
  AlertOctagon,
  AlertTriangle,
  Box,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleUserRound,
  Cpu,
  Database,
  Download,
  FileText,
  History,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Minus,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBasket,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ParsedPlanogram } from "../lib/pdf-parser";

type Tab = "DASHBOARD" | "MAP" | "MASTER_DATA" | "STOCK" | "LOSS" | "DATE" | "SUGGEST";
type ThemeKey = "blue" | "indigo" | "emerald" | "rose";

type MasterProduct = {
  id?: string;
  sku: string;
  barcode: string;
  name: string;
  line: string;
  locId: number | null;
  price: number;
  stock: number;
  loss: number;
  expDate: string;
  updatedAt?: string;
};

type Product = MasterProduct & {
  planogramId?: string;
  aisle: string;
  side: string;
  verified?: boolean;
  category?: string;
  markerX?: number | null;
  markerY?: number | null;
  visualUrl?: string;
  visualWidth?: number;
  visualHeight?: number;
  pageNumber?: number;
  pdfUrl?: string;
};

type ImportedProduct = {
  planogramId?: string;
  sku: string;
  name: string;
  aisle: string;
  lineId?: string;
  side?: string;
  locId: number;
  markerX?: number | null;
  markerY?: number | null;
  visualUrl?: string;
  visualWidth?: number;
  visualHeight?: number;
  pageNumber?: number;
  pdfUrl?: string;
  verified?: boolean;
  category?: string;
};

type PlanogramRecord = {
  id: string;
  aisleKey: string;
  lineId: string;
  side: string;
  fileName: string;
  pageNumber: number;
  pageCount: number;
  visualUrl: string;
  pdfUrl: string;
};

type Activity = { id: string; action: string; time: number };
type Suggestion = { id: string; name: string; line: string; reason: string; sku?: string };
type LineTheme = "grey" | "yellow" | "pink";
type LineSpec = { line: number; name: string; tone?: LineTheme; logo?: boolean };

const initialProducts: MasterProduct[] = [
  { sku: "10531914", barcode: "45497410531914", name: "HC TẤM TRẢI LÀM MÁT ICECOLD 160X200GY", line: "12", locId: 1, price: 450000, stock: 5, loss: 0, expDate: "2026-12-31" },
  { sku: "10763049", barcode: "45497410763049", name: "HC GỐI MOCHI PILLOW BE", line: "12", locId: 5, price: 185000, stock: 45, loss: 2, expDate: "2026-06-15" },
  { sku: "8969583", barcode: "8801260418800", name: "BVS SOONSOOHANMYEON 23CM 18 MIẾNG", line: "16", locId: 18, price: 45000, stock: 0, loss: 0, expDate: "2027-01-10" },
];

const themes: Record<ThemeKey, { text: string; bg: string; light: string; ring: string; gradient: string }> = {
  blue: { text: "text-blue-600", bg: "bg-blue-600", light: "bg-blue-50", ring: "ring-blue-500", gradient: "from-blue-600 to-indigo-600" },
  indigo: { text: "text-indigo-600", bg: "bg-indigo-600", light: "bg-indigo-50", ring: "ring-indigo-500", gradient: "from-indigo-600 to-purple-600" },
  emerald: { text: "text-emerald-600", bg: "bg-emerald-600", light: "bg-emerald-50", ring: "ring-emerald-500", gradient: "from-emerald-500 to-teal-600" },
  rose: { text: "text-rose-600", bg: "bg-rose-600", light: "bg-rose-50", ring: "ring-rose-500", gradient: "from-rose-500 to-pink-600" },
};

const upperLeft: LineSpec[] = [
  { line: 17, name: "BEER\nLIQUOR" },
  { line: 18, name: "TEA\nDRINKS", tone: "yellow" },
  { line: 19, name: "COFFEE", tone: "yellow" },
  { line: 20, name: "TOPVALU", tone: "pink", logo: true },
  { line: 21, name: "TOPVALU", tone: "pink", logo: true },
];
const upperRight: LineSpec[] = [
  { line: 22, name: "ASIA" }, { line: 23, name: "ASIA" }, { line: 24, name: "NOODLES" },
  { line: 25, name: "RICE,\nFLOUR" }, { line: 26, name: "SAUCES" }, { line: 27, name: "SPICES" },
  { line: 28, name: "DRIED\nSEA\nFOOD\nEGG" },
];
const lowerLeft: LineSpec[] = [
  { line: 16, name: "NON\nFOOD\n& HBC" }, { line: 15, name: "NON\nFOOD\n& HBC" },
  { line: 14, name: "NON\nFOOD\n& HBC" }, { line: 13, name: "HOUSE\nWARE" },
  { line: 12, name: "HOUSE\nWARE" }, { line: 11, name: "HOMECOORDY", logo: true },
  { line: 10, name: "HOMECOORDY", logo: true }, { line: 9, name: "NON\nFOOD\n& HBC" },
];
const lowerRight: LineSpec[] = [
  { line: 8, name: "KID" }, { line: 7, name: "KID" }, { line: 6, name: "MILK" }, { line: 5, name: "MILK" },
  { line: 4, name: "CONFEC-\nTIONERY", tone: "pink" }, { line: 3, name: "DRIED\nFRUIT\nNUTS", tone: "pink" },
  { line: 2, name: "CHOCO-\nLATE", tone: "pink" }, { line: 1, name: "SOUVENIR", tone: "yellow" },
];
const allLineSpecs = [...upperLeft, ...upperRight, ...lowerLeft, ...lowerRight];

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function lineNumber(value: unknown) {
  return Number(String(value ?? "").match(/\d{1,2}/)?.[0] ?? 0);
}

function lineLabel(value: unknown) {
  const number = lineNumber(value);
  return number ? String(number).padStart(2, "0") : "DAILY";
}

function aisleSide(value: string) {
  return value.split("-")[1] || "A";
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value) + " đ";
}

function expiryStatus(dateValue: string) {
  if (!dateValue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateValue + "T00:00:00");
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: "Đã hết hạn", classes: "bg-red-100 text-red-700 border-red-200", urgent: true };
  if (days <= 30) return { label: "Còn " + days + " ngày", classes: "bg-amber-100 text-amber-700 border-amber-200", urgent: true };
  return { label: "An toàn", classes: "bg-emerald-100 text-emerald-700 border-emerald-200", urgent: false };
}

async function readApiResponse(response: Response): Promise<{ error?: string; [key: string]: unknown }> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { error?: string; [key: string]: unknown };
  } catch {
    return {
      error: response.status === 413
        ? "File vượt giới hạn tải lên. Hãy chọn PDF không quá 50 MB."
        : text.slice(0, 300),
    };
  }
}

function StoreLayout({
  activeLine,
  highlightedLines,
  onSelectLine,
}: {
  activeLine: number;
  highlightedLines: number[];
  onSelectLine: (line: number) => void;
}) {
  const bay = (spec: LineSpec, left: number, keyPrefix: string) => {
    const highlighted = activeLine === spec.line || highlightedLines.includes(spec.line);
    const activate = () => onSelectLine(spec.line);
    return (
      <div
        key={keyPrefix + "-" + spec.line}
        className={"map-line " + (spec.tone ?? "grey") + (highlighted ? " is-active" : "")}
        style={{ left: left + "%" }}
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") activate();
        }}
        aria-label={"Mở Line " + spec.line + ": " + spec.name.replaceAll("\n", " ")}
      >
        <div className="line-cap">LINE {String(spec.line).padStart(2, "0")}</div>
        <div className="line-name">
          {spec.logo ? (
            <span className={"map-brand " + (spec.name === "HOMECOORDY" ? "homecoordy" : "topvalu")}>
              <b>TOPVALU</b>{spec.name === "HOMECOORDY" && <small>HOMECOORDY</small>}
            </span>
          ) : spec.name.split("\n").map((part, index) => <span key={index}>{part}</span>)}
        </div>
        <div className="line-cap"><span>A</span>&nbsp;&nbsp;|&nbsp;&nbsp;<span>B</span></div>
        {highlighted && <div className="active-flag">{activeLine === spec.line ? "LINE ĐANG CHỌN" : "CẦN ĐI QUA"}</div>}
      </div>
    );
  };

  return (
    <div className="redrawn-map" role="img" aria-label="Sơ đồ line hàng AEON SmartOps">
      <div className="map-zone top-zone daily-top">DAILY &amp; DAIRY</div>
      <div className="map-zone top-zone meat-top">MEAT</div>
      <div className="map-zone top-zone fish-top">FISH</div>
      <div className="map-zone left-daily">DAILY<br />&amp;<br />DAIRY</div>
      <div className="map-zone left-bottled">BOTTLED<br />DRINKS</div>
      <div className="map-zone left-nonfood">NON<br />FOOD<br />&amp; HBC</div>
      <div className="map-zone dairy-block">DAILY<br />&amp; DAIRY</div>
      {upperLeft.map((spec, index) => bay(spec, 21.9 + index * 5.15, "upper-left"))}
      <div className="map-zone promotion-vertical">PROMOTION</div>
      {upperRight.map((spec, index) => bay(spec, 53.75 + index * 5.08, "upper-right"))}
      <div className="map-zone daily-block">DAILY<br />&amp; DAIRY</div>
      <div className="map-zone fish-side fish-one">FISH</div>
      <div className="map-zone fish-side fish-two">FISH</div>
      <div className="map-zone fish-side ready-cook">READY<br />TO<br />COOK</div>
      <div className="lower-lines left-row">{lowerLeft.map((spec, index) => bay(spec, 6.65 + index * 5.08, "lower-left"))}</div>
      <div className="lower-lines right-row">{lowerRight.map((spec, index) => bay(spec, 53.75 + index * 5.02, "lower-right"))}</div>
      <div className="map-zone bottom-zone nonfood-bottom">NON-FOOD &amp; HBC</div>
      <div className="map-zone bottom-zone cashier-bottom">CASHIER COUNTER</div>
      <div className="map-zone bottom-zone promotion-bottom">PROMOTION</div>
      <div className="map-zone bottom-zone tissue-bottom">TISSUE &amp; DIAPERS</div>
      <div className="map-zone bottom-blank blank-one" />
      <div className="map-zone bottom-blank blank-two" />
      <div className="map-zone bottom-blank blank-three" />
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("DASHBOARD");
  const [themeKey, setThemeKey] = useState<ThemeKey>("blue");
  const [fontClass, setFontClass] = useState("font-sans");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [masterData, setMasterData] = useState<MasterProduct[]>(initialProducts);
  const [importedProducts, setImportedProducts] = useState<ImportedProduct[]>([]);
  const [planograms, setPlanograms] = useState<PlanogramRecord[]>([]);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedSku, setSelectedSku] = useState(initialProducts[0].sku);
  const [selectedLine, setSelectedLine] = useState(12);
  const [selectedModalLine, setSelectedModalLine] = useState<number | null>(null);
  const [activeSide, setActiveSide] = useState("A");
  const [pogSearchQuery, setPogSearchQuery] = useState("");
  const [markerEditMode, setMarkerEditMode] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "error" } | null>(null);
  const [insightProduct, setInsightProduct] = useState<Product | null>(null);
  const [dishInput, setDishInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [checkedSuggestions, setCheckedSuggestions] = useState<Record<string, boolean>>({});

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadLine, setUploadLine] = useState("12");
  const [uploadSide, setUploadSide] = useState("A");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDraft, setUploadDraft] = useState<ParsedPlanogram | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [draftMarkerIndex, setDraftMarkerIndex] = useState<number | null>(null);

  const theme = themes[themeKey];

  const showToast = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const addActivity = useCallback((action: string) => {
    setActivities((current) => [{ id: crypto.randomUUID(), action, time: Date.now() }, ...current].slice(0, 50));
  }, []);

  const refreshData = useCallback(async () => {
    const [masterResult, pogResult] = await Promise.allSettled([
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/planograms", { cache: "no-store" }),
    ]);
    if (masterResult.status === "fulfilled" && masterResult.value.ok) {
      const payload = await masterResult.value.json() as { products?: MasterProduct[] };
      if (payload.products?.length) setMasterData(payload.products);
    }
    if (pogResult.status === "fulfilled" && pogResult.value.ok) {
      const payload = await pogResult.value.json() as { products?: ImportedProduct[]; planograms?: PlanogramRecord[] };
      setImportedProducts(payload.products ?? []);
      setPlanograms(payload.planograms ?? []);
    }
  }, []);

  useEffect(() => {
    refreshData();
    try {
      const savedTheme = localStorage.getItem("smartops_theme") as ThemeKey | null;
      const savedFont = localStorage.getItem("smartops_font");
      if (savedTheme && themes[savedTheme]) setThemeKey(savedTheme);
      if (savedFont) setFontClass(savedFont);
    } catch {}
  }, [refreshData]);

  const products = useMemo<Product[]>(() => {
    const masterBySku = new Map(masterData.map((item) => [item.sku, item]));
    const importedBySku = new Map(importedProducts.map((item) => [item.sku, item]));
    const merged = masterData.map((master) => {
      const imported = importedBySku.get(master.sku);
      const line = imported ? lineLabel(imported.aisle) : lineLabel(master.line);
      const side = imported ? aisleSide(imported.aisle) : "A";
      return {
        ...master,
        line,
        locId: imported?.locId ?? master.locId,
        aisle: imported?.aisle ?? ("L" + line + "-A"),
        side,
        planogramId: imported?.planogramId,
        markerX: imported?.markerX,
        markerY: imported?.markerY,
        visualUrl: imported?.visualUrl,
        visualWidth: imported?.visualWidth,
        visualHeight: imported?.visualHeight,
        pageNumber: imported?.pageNumber,
        pdfUrl: imported?.pdfUrl,
        verified: imported?.verified,
        category: imported?.category ?? "Master Data",
      };
    });
    importedProducts.forEach((imported) => {
      if (masterBySku.has(imported.sku)) return;
      const line = lineLabel(imported.aisle);
      merged.push({
        sku: imported.sku,
        barcode: "",
        name: imported.name,
        line,
        locId: imported.locId,
        price: 0,
        stock: 0,
        loss: 0,
        expDate: "",
        aisle: imported.aisle,
        side: aisleSide(imported.aisle),
        planogramId: imported.planogramId,
        markerX: imported.markerX,
        markerY: imported.markerY,
        visualUrl: imported.visualUrl,
        visualWidth: imported.visualWidth,
        visualHeight: imported.visualHeight,
        pageNumber: imported.pageNumber,
        pdfUrl: imported.pdfUrl,
        verified: imported.verified,
        category: imported.category ?? "Dữ liệu nhập từ PDF",
      });
    });
    return merged;
  }, [masterData, importedProducts]);

  const selectedProduct = useMemo(
    () => products.find((item) => item.sku === selectedSku) ?? products[0] ?? null,
    [products, selectedSku],
  );

  const searchResults = useMemo(() => {
    const needle = normalize(query.trim());
    if (needle.length < 2) return [];
    return products.filter((item) => normalize(item.name + " " + item.sku + " " + item.barcode + " " + item.line).includes(needle)).slice(0, 8);
  }, [products, query]);

  const totalProducts = masterData.length;
  const lowStockCount = masterData.filter((item) => item.stock > 0 && item.stock < 10).length;
  const outOfStockCount = masterData.filter((item) => item.stock === 0).length;
  const totalLossItems = masterData.reduce((total, item) => total + (item.loss || 0), 0);
  const expiringCount = masterData.filter((item) => expiryStatus(item.expDate)?.urgent).length;

  const highlightedSuggestionLines = useMemo(
    () => suggestions.filter((item) => !checkedSuggestions[item.id]).map((item) => lineNumber(item.line)).filter(Boolean),
    [suggestions, checkedSuggestions],
  );

  const activePlanogram = useMemo(
    () => planograms.find((item) => item.aisleKey === "L" + String(selectedModalLine ?? selectedLine) + "-" + activeSide),
    [planograms, selectedModalLine, selectedLine, activeSide],
  );

  const lineProducts = useMemo(() => {
    const line = selectedModalLine ?? selectedLine;
    const needle = normalize(pogSearchQuery.trim());
    const exactAisle = "L" + line + "-" + activeSide;
    const importedSkus = new Set(importedProducts.filter((item) => item.aisle === exactAisle).map((item) => item.sku));
    return products
      .filter((item) => item.aisle === exactAisle || (!importedSkus.size && lineNumber(item.line) === line && item.side === activeSide))
      .filter((item) => !needle || normalize(item.name + " " + item.sku + " " + (item.locId ?? "")).includes(needle))
      .sort((a, b) => Number(a.locId ?? 9999) - Number(b.locId ?? 9999));
  }, [products, importedProducts, selectedModalLine, selectedLine, activeSide, pogSearchQuery]);

  const modalSelected = lineProducts.find((item) => item.sku === selectedSku) ?? lineProducts[0] ?? null;
  const modalVisual = activePlanogram?.visualUrl ?? modalSelected?.visualUrl ?? null;

  function openLine(line: number, side = "A", sku?: string) {
    setSelectedLine(line);
    setSelectedModalLine(line);
    setActiveSide(side);
    setPogSearchQuery("");
    setMarkerEditMode(false);
    const first = products.find((item) => lineNumber(item.line) === line && item.side === side);
    if (sku) setSelectedSku(sku);
    else if (first) setSelectedSku(first.sku);
  }

  function chooseProduct(product: Product) {
    setSelectedSku(product.sku);
    setQuery(product.name);
    setSearchFocused(false);
    setActiveTab("MAP");
    openLine(lineNumber(product.line), product.side || "A", product.sku);
    addActivity("Tìm SKU " + product.sku + " tại Line " + lineLabel(product.line) + ", Mặt " + (product.side || "A"));
  }

  function selectMapLine(line: number) {
    openLine(line, "A");
    addActivity("Mở POG Line " + String(line).padStart(2, "0"));
  }

  async function updateProduct(sku: string, patch: Partial<MasterProduct>, action: string) {
    const previous = masterData;
    setMasterData((current) => current.map((item) => item.sku === sku ? { ...item, ...patch } : item));
    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku, ...patch }),
      });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(payload.error || "Không thể lưu dữ liệu");
      const saved = payload.product as MasterProduct;
      setMasterData((current) => current.map((item) => item.sku === sku ? saved : item));
      addActivity(action);
      showToast("Đã lưu thay đổi", "success");
    } catch (error) {
      setMasterData(previous);
      showToast(error instanceof Error ? error.message : "Không thể lưu dữ liệu", "error");
    }
  }

  function exportCsv() {
    const rows = [
      ["SKU", "Barcode", "Name", "Line", "Price", "Stock", "Loss", "ExpDate"],
      ...masterData.map((item) => [item.sku, item.barcode, item.name, item.line, item.price, item.stock, item.loss, item.expDate]),
    ];
    const csv = "\ufeff" + rows.map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "MasterData_AEON_SmartOps.csv";
    link.click();
    URL.revokeObjectURL(url);
    addActivity("Xuất Master Data ra CSV");
  }

  function buildSuggestions() {
    const input = normalize(dishInput);
    let raw: Array<Omit<Suggestion, "id">> = [];
    if (input.includes("lau")) {
      raw = [
        { name: "Rau củ và nấm", line: "03", reason: "Nguyên liệu ăn kèm lẩu" },
        { name: "Sữa và đồ uống", line: "06", reason: "Đồ uống dùng kèm" },
        { name: "Nước chấm, gia vị", line: "26", reason: "Hoàn thiện nước lẩu" },
        { name: "Mì và bún", line: "24", reason: "Tinh bột ăn kèm" },
        { name: "Đồ uống", line: "17", reason: "Gợi ý cho bữa tiệc" },
      ];
    } else if (input.includes("bbq") || input.includes("nuong")) {
      raw = [
        { name: "Thịt tươi", line: "DAILY", reason: "Nguyên liệu chính" },
        { name: "Sốt ướp và gia vị", line: "26", reason: "Dùng để tẩm ướp" },
        { name: "Sữa và đồ uống", line: "06", reason: "Dùng kèm món nướng" },
        { name: "Rau củ", line: "03", reason: "Ăn kèm và trang trí" },
        { name: "Dụng cụ gia đình", line: "13", reason: "Chuẩn bị bàn nướng" },
      ];
    } else if (input.includes("pho") || input.includes("bun bo") || input.includes("hu tieu")) {
      raw = [
        { name: "Mì, phở, bún khô", line: "24", reason: "Nguyên liệu chính" },
        { name: "Thịt và thực phẩm tươi", line: "DAILY", reason: "Nấu nước dùng" },
        { name: "Nước mắm và gia vị", line: "26", reason: "Nêm nếm món ăn" },
        { name: "Rau thơm", line: "03", reason: "Ăn kèm" },
      ];
    } else if (input.includes("trai cay") || input.includes("trang mieng") || input.includes("che") || input.includes("banh ngot") || input.includes("an vat")) {
      raw = [
        { name: "Trái cây và hạt", line: "03", reason: "Món tráng miệng chính" },
        { name: "Sữa", line: "06", reason: "Nguyên liệu pha chế" },
        { name: "Bánh kẹo", line: "04", reason: "Đồ ăn vặt bổ sung" },
      ];
    } else {
      const words = input.split(/\s+/).filter((word) => word.length > 2);
      const matches = products.filter((product) => words.some((word) => normalize(product.name).includes(word))).slice(0, 6);
      raw = matches.map((product) => ({ name: product.name, line: product.line, reason: "Sản phẩm có sẵn trong Master Data", sku: product.sku }));
    }
    if (!raw.length) {
      raw = [
        { name: "Thực phẩm tươi", line: "DAILY", reason: "Nguyên liệu cơ bản" },
        { name: "Mì và thực phẩm khô", line: "24", reason: "Dễ kết hợp nhiều món" },
        { name: "Gia vị và nước chấm", line: "26", reason: "Hoàn thiện hương vị" },
      ];
    }
    setSuggestions(raw.map((item) => ({ ...item, id: crypto.randomUUID() })));
    setCheckedSuggestions({});
    setActiveTab("SUGGEST");
    addActivity("Tạo gợi ý mua sắm cho: " + (dishInput || "nhu cầu chung"));
  }

  async function handlePdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadDraft(null);
    setDraftMarkerIndex(null);
    setUploadError("");
    if (file.type !== "application/pdf") {
      setUploadError("Vui lòng chọn đúng file PDF.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File PDF vượt quá giới hạn 50 MB.");
      return;
    }
    setUploadBusy(true);
    try {
      const { extractPlanogramFromPdf } = await import("../lib/pdf-parser");
      const parsed = await extractPlanogramFromPdf(file);
      setUploadDraft(parsed);
      setDraftMarkerIndex(Math.max(0, parsed.products.findIndex((product) => product.markerX == null || product.markerY == null)));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Không thể phân tích PDF này.");
    } finally {
      setUploadBusy(false);
    }
  }

  function updateDraftProduct(index: number, field: "locId" | "sku" | "name", value: string) {
    setUploadDraft((current) => current ? {
      ...current,
      products: current.products.map((product, productIndex) => productIndex === index ? { ...product, [field]: field === "locId" ? Number(value) : value } : product),
    } : current);
  }

  function placeDraftMarker(event: MouseEvent<HTMLDivElement>) {
    if (!uploadDraft || draftMarkerIndex == null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const markerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const markerY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setUploadDraft((current) => current ? {
      ...current,
      products: current.products.map((product, index) => index === draftMarkerIndex ? { ...product, markerX, markerY } : product),
    } : current);
    setDraftMarkerIndex(null);
  }

  async function savePdfImport() {
    if (!uploadFile || !uploadDraft) return;
    setUploadBusy(true);
    setUploadError("");
    const uploadId = crypto.randomUUID();
    const uploadedAssets: string[] = [];
    try {
      const visualBlob = await fetch(uploadDraft.visual.src).then((response) => response.blob());
      const uploadAsset = async (asset: "pdf" | "visual", body: Blob) => {
        const response = await fetch("/api/planograms/" + uploadId + "/" + asset, {
          method: "PUT",
          headers: { "content-type": body.type },
          body,
        });
        const payload = await readApiResponse(response);
        if (!response.ok) throw new Error(payload.error || "Không thể tải file lên");
        uploadedAssets.push(asset);
      };
      await uploadAsset("pdf", uploadFile);
      await uploadAsset("visual", visualBlob);
      const response = await fetch("/api/planograms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: uploadId,
          fileName: uploadFile.name,
          lineId: "L" + uploadLine,
          side: uploadSide,
          products: uploadDraft.products,
          width: uploadDraft.visual.width,
          height: uploadDraft.visual.height,
          pageNumber: uploadDraft.visual.pageNumber,
          pageCount: uploadDraft.visual.pageCount,
        }),
      });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(payload.error || "Không thể lưu dữ liệu PDF");
      const syncResponse = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          line: uploadLine,
          products: uploadDraft.products.map((product) => ({ ...product, line: uploadLine })),
        }),
      });
      const syncPayload = await readApiResponse(syncResponse);
      if (!syncResponse.ok) throw new Error(syncPayload.error || "Không thể đồng bộ Master Data");
      await refreshData();
      const first = uploadDraft.products[0];
      if (first) setSelectedSku(first.sku);
      setSelectedLine(Number(uploadLine));
      setSelectedModalLine(Number(uploadLine));
      setActiveSide(uploadSide);
      setUploadOpen(false);
      setUploadFile(null);
      setUploadDraft(null);
      setDraftMarkerIndex(null);
      addActivity("Upload POG PDF Line " + uploadLine + ", Mặt " + uploadSide);
      showToast("Đã xử lý PDF và đồng bộ Master Data", "success");
    } catch (error) {
      await Promise.all(uploadedAssets.map((asset) => fetch("/api/planograms/" + uploadId + "/" + asset, { method: "DELETE" }).catch(() => undefined)));
      setUploadError(error instanceof Error ? error.message : "Không thể lưu dữ liệu PDF");
    } finally {
      setUploadBusy(false);
    }
  }

  async function placeSavedMarker(event: MouseEvent<HTMLDivElement>) {
    if (!markerEditMode || !modalSelected?.planogramId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const markerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const markerY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setMarkerEditMode(false);
    try {
      const response = await fetch("/api/planograms/" + modalSelected.planogramId + "/products/" + encodeURIComponent(modalSelected.sku), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locId: modalSelected.locId, markerX, markerY }),
      });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(payload.error || "Không thể lưu điểm đánh dấu");
      await refreshData();
      addActivity("Chỉnh vị trí SKU " + modalSelected.sku + " trên POG");
      showToast("Đã lưu điểm chính xác trên ảnh", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể lưu điểm đánh dấu", "error");
    }
  }

  function openUpload(line: number, side: string) {
    setUploadLine(String(line));
    setUploadSide(side);
    setUploadError("");
    setUploadDraft(null);
    setUploadFile(null);
    setUploadOpen(true);
  }

  const navItems: Array<{ id: Tab; label: string; mobile: string; icon: React.ReactNode }> = [
    { id: "DASHBOARD", label: "TỔNG QUAN", mobile: "TỔNG", icon: <LayoutDashboard size={14} /> },
    { id: "MAP", label: "BẢN ĐỒ POG", mobile: "POG", icon: <MapIcon size={14} /> },
    { id: "MASTER_DATA", label: "SẢN PHẨM", mobile: "SP", icon: <Database size={14} /> },
    { id: "STOCK", label: "CHECK STOCK", mobile: "STOCK", icon: <Box size={14} /> },
    { id: "LOSS", label: "CHECK LOSS", mobile: "LOSS", icon: <AlertOctagon size={14} /> },
    { id: "DATE", label: "CHECK DATE", mobile: "DATE", icon: <CalendarClock size={14} /> },
    { id: "SUGGEST", label: "AI MUA SẮM", mobile: "AI", icon: <Sparkles size={14} /> },
  ];

  return (
    <div className={"min-h-screen bg-slate-50 text-slate-800 pb-16 md:pb-0 " + fontClass}>
      {toast && (
        <div className={"fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl border font-bold text-sm max-w-[90vw] " + (toast.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : toast.type === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-slate-700 border-slate-200")}>
          {toast.type === "success" ? <CheckCircle2 size={18} /> : toast.type === "error" ? <AlertTriangle size={18} /> : <FileText size={18} />}
          {toast.message}
        </div>
      )}

      <header className="bg-white/90 backdrop-blur-xl shadow-sm border-b border-slate-200/80 sticky top-0 z-40 px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <button onClick={() => setActiveTab("DASHBOARD")} className="flex items-center gap-3 shrink-0">
          <span className={"bg-gradient-to-br " + theme.gradient + " p-2.5 rounded-xl text-white shadow-md"}><PackageSearch size={20} /></span>
          <span className="hidden sm:block text-left">
            <b className="block text-sm md:text-lg font-black leading-none tracking-tight">AEON SmartOps</b>
            <small className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Hệ sinh thái Quản lý &amp; POG</small>
          </span>
        </button>

        <nav className="hidden xl:flex items-center gap-1 bg-slate-100/70 p-1.5 rounded-xl border border-slate-200/60">
          {navItems.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={"px-3 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-1.5 whitespace-nowrap " + (activeTab === tab.id ? "bg-white shadow-sm " + theme.text : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/60")}>
              {tab.icon}<span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3 ml-auto relative">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
              placeholder="Tìm SKU, tên, barcode..."
              className="w-36 sm:w-56 lg:w-64 pl-9 pr-3 py-2.5 rounded-full bg-slate-100 border border-transparent text-xs font-semibold outline-none focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100/60 transition-all"
            />
            {searchFocused && query.trim().length >= 2 && (
              <div className="absolute top-full mt-2 right-0 xl:left-0 xl:right-auto w-[min(360px,88vw)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] max-h-[60vh]">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Kết quả tìm kiếm</span>
                  <span className={"text-[10px] font-black px-2 py-0.5 rounded-full " + theme.light + " " + theme.text}>{searchResults.length} SP</span>
                </div>
                {searchResults.length ? searchResults.map((item) => (
                  <button key={item.sku + item.aisle} onMouseDown={() => chooseProduct(item)} className="w-full p-3 text-left hover:bg-blue-50 border-b border-slate-50 transition-colors">
                    <b className="block text-xs text-slate-800 leading-snug">{item.name}</b>
                    <span className="mt-2 flex justify-between items-center text-[9px] font-bold text-slate-400">
                      <span>SKU {item.sku}</span>
                      <span className={"px-2 py-1 rounded " + theme.light + " " + theme.text}>Tới Line {item.line} →</span>
                    </span>
                  </button>
                )) : <div className="p-7 text-center text-xs text-slate-400 font-bold">Không tìm thấy sản phẩm</div>}
              </div>
            )}
          </div>
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-2 p-2 md:px-3 md:py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 border border-slate-200">
            <Settings size={16} /><span className="hidden md:block text-xs font-bold">Owner</span>
          </button>
        </div>
      </header>

      <main className="p-3 md:p-6 lg:p-8">
        {activeTab === "DASHBOARD" && (
          <div className="w-full max-w-7xl mx-auto">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div><p className={"text-[10px] font-black uppercase tracking-[.2em] mb-2 " + theme.text}>AEON SMARTOPS</p><h1 className="text-2xl md:text-3xl font-black tracking-tight">Bảng điều khiển Tổng quan</h1></div>
              <button onClick={() => setActiveTab("MAP")} className={"hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-black shadow-lg bg-gradient-to-r " + theme.gradient}><MapPin size={15} /> Mở bản đồ POG</button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-7">
              {[
                { label: "Tổng số SKU", value: totalProducts, icon: <Database size={20} />, classes: "bg-blue-50 text-blue-600" },
                { label: "Cạn kho", value: outOfStockCount, icon: <AlertOctagon size={20} />, classes: "bg-red-50 text-red-600" },
                { label: "Tồn kho thấp < 10", value: lowStockCount, icon: <AlertTriangle size={20} />, classes: "bg-amber-50 text-amber-600" },
                { label: "Sắp hết HSD / Loss", value: expiringCount + " / " + totalLossItems, icon: <CalendarClock size={20} />, classes: "bg-purple-50 text-purple-600" },
              ].map((card) => (
                <article key={card.label} className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <span className={"w-10 h-10 rounded-xl flex items-center justify-center mb-4 " + card.classes}>{card.icon}</span>
                  <small className="block text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</small>
                  <b className="text-3xl md:text-4xl font-black text-slate-800">{card.value}</b>
                </article>
              ))}
            </div>
            <div className="grid lg:grid-cols-[1.4fr_.6fr] gap-5">
              <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[360px]">
                <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
                  <h2 className="font-black text-sm uppercase flex items-center gap-2"><History size={18} className="text-slate-400" /> Lịch sử thao tác</h2>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Phiên hiện tại</span>
                </div>
                <div className="p-3">
                  {activities.length ? activities.map((log) => (
                    <div key={log.id} className="grid grid-cols-[54px_12px_1fr] gap-3 p-3 border-b border-slate-50 last:border-0">
                      <span className="text-[10px] font-bold text-slate-400 text-right">{new Date(log.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                      <i className={"w-2 h-2 mt-1 rounded-full ring-4 " + theme.bg + " ring-blue-50"} />
                      <div><p className="text-sm font-semibold text-slate-700">{log.action}</p><small className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1 mt-1"><CircleUserRound size={10} /> Owner</small></div>
                    </div>
                  )) : <div className="h-[290px] flex flex-col items-center justify-center text-slate-400 gap-2"><History size={34} /><p className="text-[10px] font-bold uppercase tracking-widest">Chưa có thao tác nào</p></div>}
                </div>
              </section>
              <section className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl grid content-center gap-4">
                <span className={"w-12 h-12 rounded-2xl flex items-center justify-center " + theme.bg}><PackageSearch size={24} /></span>
                <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-slate-400 mb-2">Tác vụ nhanh</p><h2 className="text-xl font-black">Tìm đúng line, thấy đúng vị trí.</h2></div>
                <p className="text-xs leading-relaxed text-slate-400">Tìm theo tên, SKU hoặc barcode; sau đó mở POG để xem số vị trí liền kề sản phẩm trên ảnh.</p>
                <div className="grid gap-2">
                  <button onClick={() => setActiveTab("MAP")} className="px-4 py-3 rounded-xl bg-white text-slate-900 text-xs font-black text-left flex justify-between">Mở bản đồ <MapPin size={15} /></button>
                  <button onClick={() => openUpload(selectedLine, "A")} className="px-4 py-3 rounded-xl bg-white/10 text-white text-xs font-black text-left flex justify-between">Nhập PDF POG <Upload size={15} /></button>
                </div>
              </section>
            </div>
          </div>
        )}

        {(activeTab === "MAP" || activeTab === "SUGGEST") && (
          <div className={"w-full mx-auto grid gap-5 " + (activeTab === "SUGGEST" ? "xl:grid-cols-[360px_1fr]" : "max-w-[1500px]")}>
            {activeTab === "SUGGEST" && (
              <aside className="bg-white rounded-3xl shadow-lg p-5 border border-slate-100 min-h-[480px] flex flex-col">
                <h2 className="font-black uppercase flex items-center gap-2 mb-4"><Sparkles className={theme.text} size={20} /> Tư vấn mua sắm</h2>
                <form onSubmit={(event: FormEvent) => { event.preventDefault(); buildSuggestions(); }} className="relative mb-5">
                  <input value={dishInput} onChange={(event) => setDishInput(event.target.value)} placeholder="Nhập món ăn hoặc sự kiện..." className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400" />
                  <button className={"absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white bg-gradient-to-r " + theme.gradient}><Sparkles size={16} /></button>
                </form>
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {suggestions.length ? suggestions.map((item) => (
                    <button key={item.id} onClick={() => setCheckedSuggestions((current) => ({ ...current, [item.id]: !current[item.id] }))} className={"w-full p-4 rounded-2xl border-2 text-left transition-all " + (checkedSuggestions[item.id] ? "bg-slate-50 opacity-60 border-slate-200" : "bg-white border-blue-100 hover:border-blue-300 hover:shadow-md")}>
                      <span className="flex justify-between gap-2 mb-2"><b className={checkedSuggestions[item.id] ? "line-through text-slate-400 text-sm" : "text-slate-800 text-sm"}>{item.name}</b><i className={"not-italic text-[9px] font-black text-white px-2 py-1 rounded " + theme.bg}>L.{item.line}</i></span>
                      <small className="text-[11px] text-slate-500">{item.reason}</small>
                    </button>
                  )) : <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-3 opacity-70"><Cpu size={44} /><p className="text-[10px] font-black uppercase tracking-[.18em]">Động cơ phân tích nội bộ<br />Không cần API key</p></div>}
                </div>
              </aside>
            )}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-3 md:p-5 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
                <div><p className={"text-[9px] font-black tracking-[.18em] uppercase mb-1 " + theme.text}>BẢN ĐỒ POG</p><h1 className="font-black text-lg md:text-xl">Chọn line để mở mặt kệ A/B</h1></div>
                <div className="flex gap-2"><button onClick={() => setActiveTab("SUGGEST")} className="px-3 py-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-black flex items-center gap-1.5"><ShoppingBasket size={14} /> Gợi ý mua sắm</button><button onClick={() => openUpload(selectedLine, "A")} className={"px-3 py-2 rounded-xl text-white text-[10px] font-black flex items-center gap-1.5 " + theme.bg}><Upload size={14} /> Nhập PDF</button></div>
              </div>
              <div className="store-map-wrap"><StoreLayout activeLine={selectedLine} highlightedLines={highlightedSuggestionLines} onSelectLine={selectMapLine} /></div>
              {selectedProduct && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div><small className="text-[9px] font-black uppercase tracking-widest text-slate-400">SẢN PHẨM ĐANG CHỌN</small><b className="block text-sm mt-1">{selectedProduct.name}</b><span className="text-[10px] text-slate-500">SKU {selectedProduct.sku}</span></div>
                  <button onClick={() => openLine(lineNumber(selectedProduct.line), selectedProduct.side, selectedProduct.sku)} className={"px-4 py-2.5 rounded-xl text-white text-xs font-black flex items-center gap-2 " + theme.bg}><MapPin size={15} /> Line {selectedProduct.line} · Mặt {selectedProduct.side} · Vị trí {String(selectedProduct.locId ?? "—").padStart(2, "0")}</button>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "MASTER_DATA" && (
          <section className="w-full max-w-7xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between">
              <h1 className="font-black uppercase tracking-wider flex items-center gap-2"><Database size={18} className={theme.text} /> Cơ sở dữ liệu Master Data</h1>
              <div className="flex gap-2 items-center"><span className="hidden sm:block text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl">Tổng: {masterData.length} SP</span><button onClick={exportCsv} className={"px-4 py-2.5 rounded-xl text-white text-[10px] font-black uppercase flex items-center gap-2 bg-gradient-to-r " + theme.gradient}><Download size={14} /> Xuất CSV</button></div>
            </div>
            <div className="md:hidden p-3 space-y-3 bg-slate-50">
              {products.map((item) => (
                <article key={"mobile-" + item.sku} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex justify-between mb-2"><span className="font-mono text-[10px] font-bold text-slate-400">SKU {item.sku}</span><span className={"text-[9px] font-black px-2 py-1 rounded " + theme.light + " " + theme.text}>Line {item.line}</span></div>
                  <h2 className="font-bold text-sm leading-snug mb-3">{item.name}</h2>
                  <div className="pt-3 border-t border-slate-50 flex justify-between items-center"><b className="text-sm">{formatPrice(item.price)}</b><button onClick={() => setInsightProduct(item)} className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Cpu size={15} /></button></div>
                </article>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200"><tr><th className="p-4 md:px-6">SKU</th><th>Tên sản phẩm</th><th>Line</th><th>Barcode</th><th className="text-right p-4 md:px-6">Giá / Insight</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((item) => (
                    <tr key={"master-" + item.sku} className="hover:bg-blue-50/40">
                      <td className="p-4 md:px-6 font-mono font-bold text-slate-700">{item.sku}</td><td className="font-semibold">{item.name}</td><td><button onClick={() => chooseProduct(item)} className={"px-2.5 py-1 rounded text-[9px] font-black " + theme.light + " " + theme.text}>Line {item.line}</button></td><td className="font-mono text-xs text-slate-400">{item.barcode || "—"}</td><td className="p-4 md:px-6 text-right font-black"><span className="inline-flex items-center gap-3">{formatPrice(item.price)}<button onClick={() => setInsightProduct(item)} className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Cpu size={16} /></button></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(activeTab === "STOCK" || activeTab === "LOSS" || activeTab === "DATE") && (
          <section className="w-full max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 px-1">
              <h1 className={"font-black uppercase tracking-wider flex items-center gap-2 " + (activeTab === "LOSS" ? "text-red-600" : activeTab === "DATE" ? "text-amber-600" : "text-slate-800")}>
                {activeTab === "STOCK" ? <Box size={20} className={theme.text} /> : activeTab === "LOSS" ? <AlertOctagon size={20} /> : <CalendarClock size={20} />}
                Quản lý {activeTab === "STOCK" ? "tồn kho" : activeTab === "LOSS" ? "hủy / hỏng" : "hạn sử dụng"}
              </h1>
              {activeTab === "STOCK" && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl"><Cpu size={13} className="inline mr-1" /> {outOfStockCount} cạn kho · {lowStockCount} tồn thấp</span>}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {masterData.map((item) => {
                const status = expiryStatus(item.expDate);
                const value = activeTab === "LOSS" ? item.loss : item.stock;
                return (
                  <article key={activeTab + "-" + item.sku} className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-100 hover:shadow-lg transition-all flex flex-col gap-4">
                    <div><div className="flex justify-between items-start mb-3"><button onClick={() => openLine(lineNumber(item.line), "A", item.sku)} className={"text-[9px] font-black px-2.5 py-1 rounded " + theme.light + " " + theme.text}>Line {lineLabel(item.line)}</button>{activeTab === "DATE" && status ? <span className={"text-[9px] font-black px-2 py-1 rounded border " + status.classes}>{status.label}</span> : <span className="font-mono text-[9px] text-slate-400">SKU {item.sku}</span>}</div><h2 className="font-bold text-sm leading-snug min-h-10">{item.name}</h2></div>
                    {activeTab === "DATE" ? (
                      <label className="mt-auto"><span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Cập nhật hạn sử dụng</span><input type="date" value={item.expDate} onChange={(event) => updateProduct(item.sku, { expDate: event.target.value }, "Cập nhật HSD SKU " + item.sku)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-sm font-bold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" /></label>
                    ) : (
                      <div className={"mt-auto flex items-center p-1.5 rounded-xl border " + (activeTab === "LOSS" ? "bg-red-50/60 border-red-100" : "bg-slate-50 border-slate-200")}>
                        <button onClick={() => updateProduct(item.sku, activeTab === "LOSS" ? { loss: Math.max(0, item.loss - 1) } : { stock: Math.max(0, item.stock - 1) }, "Giảm " + (activeTab === "LOSS" ? "Loss" : "Stock") + " SKU " + item.sku)} className="w-10 h-10 rounded-lg bg-white border border-slate-200 grid place-items-center text-red-500"><Minus size={16} /></button>
                        <b className={"flex-1 text-center text-xl " + (activeTab === "LOSS" ? "text-red-600" : "text-slate-800")}>{value}</b>
                        <button onClick={() => updateProduct(item.sku, activeTab === "LOSS" ? { loss: item.loss + 1 } : { stock: item.stock + 1 }, "Tăng " + (activeTab === "LOSS" ? "Loss" : "Stock") + " SKU " + item.sku)} className="w-10 h-10 rounded-lg bg-white border border-slate-200 grid place-items-center text-emerald-500"><Plus size={16} /></button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <nav className="xl:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 flex h-16 z-40 shadow-[0_-10px_30px_rgba(0,0,0,.05)] overflow-x-auto">
        {navItems.map((tab) => (
          <button key={"mobile-" + tab.id} onClick={() => setActiveTab(tab.id)} className={"flex-1 min-w-[65px] flex flex-col items-center justify-center gap-1 " + (activeTab === tab.id ? theme.text + " scale-105" : "text-slate-400")}>
            {tab.icon}<span className="text-[8px] font-black">{tab.mobile}</span>
          </button>
        ))}
      </nav>

      {selectedModalLine !== null && (
        <div className="fixed inset-0 z-[100] bg-white md:bg-slate-900/80 md:backdrop-blur-sm md:p-4 lg:p-7">
          <section className="w-full h-full bg-white md:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col">
            <header className={"px-4 md:px-6 py-4 text-white flex items-center justify-between gap-3 bg-gradient-to-r " + theme.gradient}>
              <div className="flex items-center gap-3 min-w-0"><span className="p-2.5 rounded-xl bg-white/20"><PackageSearch size={19} /></span><div className="min-w-0"><h2 className="text-lg md:text-2xl font-black uppercase leading-none">Line {String(selectedModalLine).padStart(2, "0")}</h2><p className="text-[9px] md:text-xs font-bold text-white/75 uppercase tracking-widest mt-1 truncate">{allLineSpecs.find((item) => item.line === selectedModalLine)?.name.replaceAll("\n", " ") ?? "POG Layout"}</p></div></div>
              <div className="flex items-center gap-2"><button onClick={() => openUpload(selectedModalLine, activeSide)} className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-[10px] font-black flex items-center gap-1.5"><Upload size={14} /> <span className="hidden sm:block">Tải PDF</span></button><button onClick={() => setSelectedModalLine(null)} className="p-2.5 rounded-full bg-white/20 hover:bg-white/30"><X size={19} /></button></div>
            </header>
            <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_360px]">
              <div className="min-h-0 bg-slate-100 flex flex-col">
                <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200"><button onClick={() => setActiveSide("A")} className={"px-6 py-2 rounded-lg text-xs font-black " + (activeSide === "A" ? "bg-slate-900 text-white shadow" : "text-slate-400")}>Mặt A</button><button onClick={() => setActiveSide("B")} className={"px-6 py-2 rounded-lg text-xs font-black " + (activeSide === "B" ? "bg-slate-900 text-white shadow" : "text-slate-400")}>Mặt B</button></div>
                  <div className="flex items-center gap-2"><span className={"hidden sm:block text-[9px] font-black px-3 py-2 rounded-full " + (modalSelected?.markerX != null && modalSelected?.markerY != null ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{modalSelected?.markerX != null && modalSelected?.markerY != null ? "● Đã có tọa độ" : "○ Chưa có tọa độ"}</span><button disabled={!modalSelected?.planogramId || !modalVisual} onClick={() => setMarkerEditMode((current) => !current)} className={"px-3 py-2 rounded-xl border text-[10px] font-black disabled:opacity-40 " + (markerEditMode ? "bg-lime-100 text-emerald-800 border-lime-300" : "bg-white text-slate-600 border-slate-200")}>{markerEditMode ? "Bấm vào ảnh để đặt điểm" : "Chỉnh vị trí"}</button></div>
                </div>
                <div className="flex-1 min-h-[360px] overflow-auto p-3 md:p-5 flex items-center justify-center">
                  {modalVisual ? (
                    <div onClick={placeSavedMarker} className={"relative inline-block leading-none max-w-full " + (markerEditMode ? "cursor-crosshair ring-4 ring-lime-400 ring-offset-4" : "")}>
                      <img src={modalVisual} alt={"POG Line " + selectedModalLine + " Mặt " + activeSide} className="max-w-full max-h-[70vh] block shadow-xl" />
                      {lineProducts.map((product) => product.markerX != null && product.markerY != null && (
                        <button key={product.sku + "-" + product.locId} onClick={(event) => { event.stopPropagation(); setSelectedSku(product.sku); }} style={{ left: Number(product.markerX) * 100 + "%", top: Number(product.markerY) * 100 + "%" }} className={"absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center rounded-full font-black shadow-lg border-2 border-white transition-all " + (product.sku === modalSelected?.sku ? "w-12 h-12 bg-red-500 text-white ring-4 ring-red-500/30 z-20 text-xs" : "w-7 h-7 bg-lime-300 text-slate-900 z-10 text-[9px]")}>
                          {product.locId}
                        </button>
                      ))}
                      {modalSelected?.markerX != null && modalSelected?.markerY != null && <span style={{ left: Number(modalSelected.markerX) * 100 + "%", top: Number(modalSelected.markerY) * 100 + "%" }} className="absolute -translate-x-1/2 translate-y-7 bg-red-600 text-white px-2 py-1 rounded text-[9px] font-black whitespace-nowrap shadow-lg pointer-events-none">Sản phẩm ở đây</span>}
                      {markerEditMode && <span className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-2 rounded-lg text-[10px] font-black whitespace-nowrap">Bấm đúng vị trí {modalSelected?.locId ?? "—"} trên ảnh</span>}
                    </div>
                  ) : <div className="text-center text-slate-400 p-10"><FileText size={42} className="mx-auto mb-3" /><b className="block text-slate-700 mb-2">Chưa có POG cho Line {selectedModalLine} · Mặt {activeSide}</b><p className="text-xs mb-4">Tải PDF để nhận diện danh sách sản phẩm và số vị trí.</p><button onClick={() => openUpload(selectedModalLine, activeSide)} className={"px-4 py-3 rounded-xl text-white text-xs font-black " + theme.bg}>Tải PDF planogram</button></div>}
                </div>
              </div>
              <aside className="min-h-0 border-l border-slate-200 bg-white flex flex-col">
                <div className="p-4 border-b border-slate-100">
                  <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={pogSearchQuery} onChange={(event) => setPogSearchQuery(event.target.value)} placeholder="Tìm tên, SKU hoặc STT..." className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-400" /></div>
                  <div className="mt-3 flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Danh sách POG</span><span>{lineProducts.length} sản phẩm</span></div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {lineProducts.length ? lineProducts.map((product) => (
                    <button key={"pog-" + product.sku + "-" + product.locId} onClick={() => setSelectedSku(product.sku)} className={"w-full p-3 rounded-xl text-left border mb-2 transition-all " + (product.sku === modalSelected?.sku ? theme.light + " border-blue-200 shadow-sm" : "bg-white border-slate-100 hover:bg-slate-50")}>
                      <span className="flex gap-3"><b className={"w-9 h-9 rounded-lg grid place-items-center shrink-0 text-xs " + (product.sku === modalSelected?.sku ? theme.bg + " text-white" : "bg-slate-100 text-slate-600")}>{product.locId ?? "—"}</b><span className="min-w-0"><strong className="block text-xs leading-snug line-clamp-2">{product.name}</strong><small className="block mt-1 text-[9px] text-slate-400 font-mono">SKU {product.sku}</small></span></span>
                    </button>
                  )) : <div className="p-8 text-center text-xs text-slate-400">Chưa có sản phẩm ở mặt kệ này.</div>}
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  {modalSelected ? <div className="mb-3 p-3 rounded-xl bg-white border border-slate-200"><small className="text-[9px] font-black uppercase text-slate-400">Đang chọn</small><b className="block text-xs mt-1">{modalSelected.name}</b><span className="block text-[10px] text-slate-500 mt-1">Vị trí {modalSelected.locId ?? "—"} · SKU {modalSelected.sku}</span></div> : null}
                  <div className="grid grid-cols-2 gap-2">{activePlanogram?.pdfUrl ? <a href={activePlanogram.pdfUrl} target="_blank" rel="noreferrer" className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-center">Mở PDF gốc</a> : <span className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-[10px] text-slate-400 text-center">Chưa có PDF</span>}<button onClick={() => openUpload(selectedModalLine, activeSide)} className="px-3 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black">Cập nhật POG</button></div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}

      {uploadOpen && (
        <div className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
          <button className="modal-backdrop" aria-label="Đóng" onClick={() => !uploadBusy && setUploadOpen(false)} />
          <section className="upload-card">
            <header><div><p className="eyebrow">NHẬP DỮ LIỆU PLANOGRAM</p><h2 id="upload-title">Liên kết sản phẩm từ PDF</h2><span>Số vị trí được lấy từ nhãn số liền kề mỗi sản phẩm; app không tự đánh số.</span></div><button onClick={() => !uploadBusy && setUploadOpen(false)} aria-label="Đóng">×</button></header>
            <div className="upload-steps"><span className="active">1. Chọn line &amp; PDF</span><span className={uploadDraft ? "active" : ""}>2. Kiểm tra liên kết</span><span>3. Lưu dữ liệu</span></div>
            <div className="upload-controls">
              <label>Line<select value={uploadLine} onChange={(event) => setUploadLine(event.target.value)}>{Array.from({ length: 28 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>Line {String(number).padStart(2, "0")}</option>)}</select></label>
              <label>Mặt kệ<select value={uploadSide} onChange={(event) => setUploadSide(event.target.value)}><option value="A">Mặt A</option><option value="B">Mặt B</option></select></label>
              <label className="pdf-drop"><input type="file" accept="application/pdf,.pdf" onChange={handlePdf} disabled={uploadBusy} /><span>▧</span><div><b>{uploadFile?.name || "Chọn file PDF planogram"}</b><small>Tối đa 50 MB · cần có lớp chữ</small></div></label>
            </div>
            {uploadBusy && <div className="parse-status"><i /> Đang đọc hình layout, số vị trí, SKU và tên sản phẩm…</div>}
            {uploadError && <div className="upload-error"><b>Chưa thể xử lý PDF</b><span>{uploadError}</span></div>}
            {uploadDraft && (
              <div className="import-review">
                <div className="import-preview">
                  <div className="review-title"><div><b>Trang layout được nhận diện</b><span>Trang {uploadDraft.visual.pageNumber}/{uploadDraft.visual.pageCount}</span></div><span>{uploadDraft.visual.markers.length} số vị trí</span></div>
                  <div className="draft-visual"><div className={"draft-image-stage " + (draftMarkerIndex != null ? "is-picking" : "")} onClick={placeDraftMarker}><img src={uploadDraft.visual.src} alt="Layout trích từ PDF" />{uploadDraft.products.map((product, index) => product.markerX != null && product.markerY != null && <i className={draftMarkerIndex === index ? "is-active" : ""} key={product.sku + "-" + index} style={{ left: product.markerX * 100 + "%", top: product.markerY * 100 + "%" }}>{product.locId}</i>)}{draftMarkerIndex != null && <span className="draft-pick-hint">Bấm vào đúng vị trí {uploadDraft.products[draftMarkerIndex]?.locId}</span>}</div></div>
                </div>
                <div className="product-review">
                  <div className="review-title"><div><b>Danh sách đã liên kết</b><span>Số vị trí là nhãn số cạnh sản phẩm</span></div><strong>{uploadDraft.products.length} sản phẩm</strong></div>
                  <div className="review-table"><div className="review-row review-head"><span>Số cạnh SP</span><span>SKU</span><span>Tên sản phẩm</span><span>Điểm ảnh</span></div>{uploadDraft.products.map((product, index) => <div className={"review-row " + (product.markerX == null || product.markerY == null ? "unmatched " : "") + (draftMarkerIndex === index ? "is-editing" : "")} key={product.sku + "-" + index}><input aria-label={"Vị trí sản phẩm " + (index + 1)} type="number" min="1" value={product.locId} onChange={(event) => updateDraftProduct(index, "locId", event.target.value)} /><input aria-label={"SKU sản phẩm " + (index + 1)} value={product.sku} onChange={(event) => updateDraftProduct(index, "sku", event.target.value)} /><input aria-label={"Tên sản phẩm " + (index + 1)} value={product.name} onChange={(event) => updateDraftProduct(index, "name", event.target.value)} /><button type="button" className="set-marker" onClick={() => setDraftMarkerIndex(index)}>{product.markerX != null && product.markerY != null ? "Chỉnh" : "Đặt điểm"}</button></div>)}</div>
                </div>
              </div>
            )}
            <footer className="upload-footer"><span>{uploadDraft ? "Sẵn sàng lưu vào L" + uploadLine + "-" + uploadSide : "Chọn PDF để bắt đầu"}</span><div><button className="cancel-button" onClick={() => !uploadBusy && setUploadOpen(false)}>Hủy</button><button className="save-import" disabled={!uploadDraft || uploadBusy} onClick={savePdfImport}>{uploadBusy ? "Đang xử lý…" : "Lưu & đồng bộ Master Data"}</button></div></footer>
          </section>
        </div>
      )}

      {insightProduct && (
        <div className="fixed inset-0 z-[180] bg-slate-900/70 backdrop-blur-sm grid place-items-center p-4">
          <section className="w-full max-w-md bg-white rounded-[2rem] p-6 md:p-8 shadow-2xl relative">
            <button onClick={() => setInsightProduct(null)} className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:bg-slate-100"><X size={20} /></button>
            <h2 className="font-black text-lg flex items-center gap-2 mb-5"><Cpu className="text-purple-500" /> Phân tích sản phẩm</h2>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mb-4"><small className="font-mono text-[9px] font-bold text-slate-400">SKU {insightProduct.sku}</small><b className="block text-sm mt-1">{insightProduct.name}</b></div>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100"><small className="block text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">Phân loại ngành hàng</small><p className="text-sm font-semibold text-blue-900">{insightProduct.category ?? (lineNumber(insightProduct.line) >= 14 && lineNumber(insightProduct.line) <= 16 ? "Health & Beauty Care / Non-food" : "General Merchandise")}</p></div>
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-100"><small className="block text-[9px] font-black uppercase tracking-widest text-purple-500 mb-1">Nội dung gợi ý</small><p className="text-sm italic text-purple-900">Sản phẩm đang được trưng bày tại Line {insightProduct.line}, Mặt {insightProduct.side}, vị trí {insightProduct.locId ?? "chưa xác định"}.</p></div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100"><small className="block text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">Bán kèm</small><p className="text-sm font-semibold text-emerald-900">Gợi ý các sản phẩm cùng ngành hàng ở vị trí lân cận trong Line {insightProduct.line}.</p></div>
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-[170] bg-slate-900/70 backdrop-blur-sm grid place-items-center p-4">
          <section className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl overflow-hidden">
            <header className="p-5 border-b border-slate-100 flex justify-between items-center"><div className="flex gap-3 items-center"><span className="p-2 rounded-xl bg-slate-100"><Settings size={18} /></span><div><h2 className="font-black uppercase text-sm">Cài đặt hệ thống</h2><small className="text-[9px] text-slate-400 font-bold uppercase">Quyền truy cập riêng tư · Owner</small></div></div><button onClick={() => setSettingsOpen(false)} className="p-2 rounded-full bg-slate-100"><X size={18} /></button></header>
            <div className="p-6 bg-slate-50 space-y-5">
              <div className="p-5 bg-white rounded-2xl border border-slate-100"><label className="block text-[10px] font-black uppercase tracking-[.18em] text-slate-400 mb-4">Màu chủ đạo</label><div className="flex gap-4">{(Object.keys(themes) as ThemeKey[]).map((key) => <button key={key} onClick={() => { setThemeKey(key); localStorage.setItem("smartops_theme", key); }} className={"w-12 h-12 rounded-full grid place-items-center text-white shadow-md " + themes[key].bg + (themeKey === key ? " ring-4 ring-offset-2 ring-slate-400 scale-110" : "")}>{themeKey === key && <Check size={20} strokeWidth={4} />}</button>)}</div></div>
              <div className="p-5 bg-white rounded-2xl border border-slate-100"><label className="block text-[10px] font-black uppercase tracking-[.18em] text-slate-400 mb-4">Kiểu chữ</label><div className="grid sm:grid-cols-3 gap-2">{[["font-sans", "Mặc định"], ["font-serif", "Cổ điển"], ["font-mono", "Kỹ thuật"]].map(([key, label]) => <button key={key} onClick={() => { setFontClass(key); localStorage.setItem("smartops_font", key); }} className={"p-3 rounded-xl border-2 text-xs font-bold " + key + " " + (fontClass === key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500")}>{label}</button>)}</div></div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 flex gap-2"><CheckCircle2 size={17} className="shrink-0" /> Ứng dụng dùng quyền truy cập riêng của trang thay cho mật khẩu mẫu lưu dạng rõ trong mã tham chiếu.</div>
            </div>
            <footer className="p-4 border-t border-slate-100 flex justify-end"><button onClick={() => setSettingsOpen(false)} className="px-7 py-3 rounded-xl bg-slate-900 text-white text-xs font-black">Lưu &amp; đóng</button></footer>
          </section>
        </div>
      )}
    </div>
  );
}
