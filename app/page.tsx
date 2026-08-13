"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const RAW = "https://raw.githubusercontent.com/huy61h1-coder/picker-assistant/main";

type Product = {
  sku: string;
  name: string;
  aisle: string;
  locId: number;
  verified?: boolean;
  category?: string;
};

type Visual = { pageNumber: number; width: number; height: number; src: string };
type Store = { aisleProducts?: Record<string, Product[]>; updatedAt?: string };

const sourceProducts: Product[] = [
  {
    sku: "10531914",
    name: "HC TẤM TRẢI LÀM MÁT ICECOLD 160X200",
    aisle: "L12-A",
    locId: 1,
    verified: true,
    category: "HomeCoordy · Bed / Clean",
  },
  {
    sku: "10763049",
    name: "HC GỐI MOCHI PILLOW BE",
    aisle: "L12-A",
    locId: 5,
    verified: true,
    category: "HomeCoordy · Bed / Clean",
  },
];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function aisleNumber(aisle: string) {
  return Number(aisle.match(/\d+/)?.[0] ?? 12);
}

function aisleSide(aisle: string) {
  return aisle.split("-")[1] ?? "A";
}

type LineSpec = { line: number; name: string; tone?: "yellow" | "pink"; logo?: boolean };

const upperLeft: LineSpec[] = [
  { line: 17, name: "BEER\nLIQUOR" },
  { line: 18, name: "TEA\nBOTTLED\nDRINKS", tone: "yellow" },
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
  { line: 2, name: "CHOCO-\nLATE", tone: "pink" }, { line: 1, name: "PÍA\n-\nDRIED\nFRUIT\nNUTS", tone: "yellow" },
];

function StoreLayout({ activeLine }: { activeLine: number }) {
  const bay = (spec: LineSpec, left: number, keyPrefix: string) => (
    <div
      key={`${keyPrefix}-${spec.line}`}
      className={`map-line ${spec.tone ?? "grey"} ${activeLine === spec.line ? "is-active" : ""}`}
      style={{ left: `${left}%` }}
      aria-label={`Line ${spec.line}: ${spec.name.replaceAll("\n", " ")}`}
    >
      <div className="line-cap">LINE {String(spec.line).padStart(2, "0")}</div>
      <div className="line-name">
        {spec.logo ? <span className={`map-brand ${spec.name === "HOMECOORDY" ? "homecoordy" : "topvalu"}`}><b>TOPVALU</b>{spec.name === "HOMECOORDY" && <small>HOMECOORDY</small>}</span> : spec.name.split("\n").map((part, index) => <span key={index}>{part}</span>)}
      </div>
      <div className="line-cap">LINE {String(spec.line).padStart(2, "0")}</div>
      {activeLine === spec.line && <div className="active-flag">SẢN PHẨM Ở LINE NÀY</div>}
    </div>
  );

  return <div className="redrawn-map" role="img" aria-label="Sơ đồ các line hàng trong siêu thị được vẽ lại theo bản gốc">
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

    <div className="lower-lines left-row">
      {lowerLeft.map((spec, index) => bay(spec, 6.65 + index * 5.08, "lower-left"))}
    </div>
    <div className="lower-lines right-row">
      {lowerRight.map((spec, index) => bay(spec, 53.75 + index * 5.02, "lower-right"))}
    </div>

    <div className="map-zone bottom-zone nonfood-bottom">NON-FOOD &amp; HBC</div>
    <div className="map-zone bottom-zone cashier-bottom">CASHIER COUNTER</div>
    <div className="map-zone bottom-zone promotion-bottom">PROMOTION</div>
    <div className="map-zone bottom-zone tissue-bottom">TISSUE &amp; DIAPERS</div>
    <div className="map-zone bottom-blank blank-one" />
    <div className="map-zone bottom-blank blank-two" />
    <div className="map-zone bottom-blank blank-three" />
  </div>;
}

export default function Home() {
  const [store, setStore] = useState<Store | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product>(sourceProducts[0]);
  const [visual, setVisual] = useState<Visual | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetch(`${RAW}/shared-data/store.json`).then((res) => res.json()).then(setStore).catch(() => setStore(null));
  }, []);

  const products = useMemo(() => {
    const remote = Object.entries(store?.aisleProducts ?? {}).flatMap(([aisle, items]) =>
      (Array.isArray(items) ? items : []).map((item) => ({ ...item, aisle: item.aisle || aisle })),
    );
    const merged = [...remote, ...sourceProducts];
    return merged.filter((item, index) => merged.findIndex((other) => other.sku === item.sku && other.aisle === item.aisle) === index);
  }, [store]);

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return products.slice(0, 6);
    return products.filter((product) => normalize(`${product.name} ${product.sku} ${product.aisle} ${product.category ?? ""}`).includes(needle)).slice(0, 8);
  }, [products, query]);

  useEffect(() => {
    setVisual(null);
    fetch(`${RAW}/shared-data/visuals/${selected.aisle}.json`)
      .then((res) => {
        if (!res.ok) throw new Error("missing");
        return res.json();
      })
      .then(setVisual)
      .catch(() => setVisual(null));
  }, [selected]);

  const line = aisleNumber(selected.aisle);
  const side = aisleSide(selected.aisle);
  const locationIndex = Math.max(1, Number(selected.locId) || 1);
  const markerLeft = Math.min(90, 4 + ((locationIndex - 1) % 10) * 9.5);

  function chooseProduct(product: Product) {
    setSelected(product);
    setQuery(product.name);
    setSearchOpen(false);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (results[0]) chooseProduct(results[0]);
  }

  return (
    <main className="finder-shell">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="Picker Assistant trang chủ">
          <span className="brand-mark">P</span>
          <span><b>Picker</b><small>Assistant</small></span>
        </a>
        <div className="header-meta"><span className="online-dot" /> Dữ liệu cửa hàng đã kết nối</div>
      </header>

      <section className="search-hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">TÌM HÀNG TRONG SIÊU THỊ</p>
          <h1>Tìm đúng line.<br /><em>Thấy đúng vị trí.</em></h1>
          <p>Nhập tên sản phẩm, SKU hoặc quét mã để xem đường đi và vị trí trưng bày chính xác.</p>
        </div>

        <div className="search-area">
          <form className="search-box" onSubmit={submitSearch}>
            <span className="search-icon">⌕</span>
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              aria-label="Tìm sản phẩm"
              placeholder="Ví dụ: Gối Mochi, 10763049..."
            />
            {query && <button type="button" className="clear-search" onClick={() => { setQuery(""); setSearchOpen(true); }} aria-label="Xóa tìm kiếm">×</button>}
            <button type="submit" className="scan-button">Tìm vị trí</button>
          </form>

          {searchOpen && <div className="search-results">
            <div className="result-label">{query ? `${results.length} kết quả phù hợp` : "Sản phẩm có vị trí"}</div>
            {results.length ? results.map((product) => (
              <button type="button" key={`${product.aisle}-${product.sku}`} onClick={() => chooseProduct(product)}>
                <span className="product-symbol">▦</span>
                <span className="result-copy"><b>{product.name}</b><small>SKU {product.sku}</small></span>
                <span className="result-location">Line {aisleNumber(product.aisle)}<small>Vị trí {String(product.locId).padStart(2, "0")}</small></span>
              </button>
            )) : <div className="empty-result">Chưa có sản phẩm này trong dữ liệu vị trí.</div>}
          </div>}

          <div className="quick-searches">
            <span>Tìm nhanh:</span>
            {sourceProducts.map((product) => <button key={product.sku} onClick={() => chooseProduct(product)}>{product.name.includes("GỐI") ? "Gối Mochi" : "Tấm trải Icecold"}</button>)}
          </div>
        </div>
      </section>

      <section className="location-summary" aria-live="polite">
        <div className="selected-product">
          <div className="product-thumb">HC</div>
          <div><p>SẢN PHẨM ĐANG TÌM</p><h2>{selected.name}</h2><span>SKU {selected.sku} · {selected.category}</span></div>
        </div>
        <div className="location-facts">
          <div><small>LINE</small><strong>{String(line).padStart(2, "0")}</strong></div>
          <div><small>MẶT KỆ</small><strong>{side}</strong></div>
          <div className="position-fact"><small>VỊ TRÍ</small><strong>{String(locationIndex).padStart(2, "0")}</strong></div>
        </div>
      </section>

      <section className="map-section">
        <div className="section-heading">
          <div><span className="step-number">01</span><div><p className="eyebrow">VỊ TRÍ TRONG SIÊU THỊ</p><h2>Đi đến Line {String(line).padStart(2, "0")}</h2></div></div>
          <p>Từ quầy thu ngân, đi về khu <b>NON FOOD &amp; HBC</b>. Line cần tìm đã được đánh dấu màu xanh.</p>
        </div>
        <div className="store-map-wrap"><StoreLayout activeLine={line} /></div>
      </section>

      <section className="layout-section">
        <div className="section-heading">
          <div><span className="step-number">02</span><div><p className="eyebrow">VỊ TRÍ TRÊN LINE LAYOUT</p><h2>Tìm vị trí {String(locationIndex).padStart(2, "0")} · Mặt {side}</h2></div></div>
          <p>Đối chiếu mã vị trí trên nhãn kệ. Khu vực màu xanh là điểm trưng bày của sản phẩm.</p>
        </div>
        <div className="layout-workspace">
          <aside className="route-card">
            <p className="route-kicker">CHỈ DẪN NHANH</p>
            <ol>
              <li className="done"><span>✓</span><div><b>Đến Line {line}</b><small>Khu {selected.category?.split("·")[0].trim()}</small></div></li>
              <li className="current"><span>2</span><div><b>Chọn mặt {side}</b><small>Đứng theo hướng đánh số của line</small></div></li>
              <li><span>3</span><div><b>Tìm vị trí {String(locationIndex).padStart(2, "0")}</b><small>Đối chiếu nhãn SKU {selected.sku}</small></div></li>
            </ol>
            <div className="verified">{selected.verified ? "✓ Vị trí đã được xác minh" : "Vị trí từ dữ liệu đồng bộ"}</div>
          </aside>

          <div className="planogram">
            <div className="planogram-bar"><div><b>{selected.aisle}</b><span>Line layout · Trang {visual?.pageNumber ?? "—"}</span></div><span className="zoom-note">Vị trí {String(locationIndex).padStart(2, "0")}</span></div>
            <div className="planogram-canvas">
              {visual ? <img src={visual.src} alt={`Line layout ${selected.aisle}`} /> : <div className="layout-missing"><b>Chưa có layout cho {selected.aisle}</b><span>Cần tải file layout lên để đánh dấu chính xác vị trí trưng bày.</span></div>}
              {visual && <>
                <div className="shelf-zone" style={{ left: `${markerLeft}%` }} />
                <div className="shelf-marker" style={{ left: `${markerLeft}%` }}><span>{String(locationIndex).padStart(2, "0")}</span><b>Sản phẩm ở đây</b></div>
              </>}
            </div>
            <div className="location-ruler">{Array.from({ length: 10 }, (_, index) => <span className={index + 1 === ((locationIndex - 1) % 10) + 1 ? "active" : ""} key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div>
          </div>
        </div>
      </section>

      <footer><span>Picker Assistant · Store Navigation</span><span>{products.length} sản phẩm đã có dữ liệu vị trí</span></footer>
    </main>
  );
}
