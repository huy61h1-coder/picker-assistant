"use client";

import { useEffect, useMemo, useState } from "react";

const RAW = "https://raw.githubusercontent.com/huy61h1-coder/picker-assistant/main";
const visualFiles = ["L12-A", "L12-B", "L17-A"];

type Store = {
  aisleProducts?: Record<string, unknown>;
  aisleVisuals?: Record<string, { hasSource?: boolean; updatedAt?: string; width?: number; height?: number }>;
  aisleNames?: Record<string, unknown>;
  lossAudits?: unknown[];
  stockChecks?: unknown[];
  masterProducts?: unknown[];
  updatedAt?: string;
};

type Visual = { pageNumber: number; width: number; height: number; src: string };

export default function Home() {
  const [store, setStore] = useState<Store | null>(null);
  const [visual, setVisual] = useState<Visual | null>(null);
  const [selected, setSelected] = useState(visualFiles[0]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${RAW}/shared-data/store.json`).then((r) => r.json()).then(setStore).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setVisual(null);
    fetch(`${RAW}/shared-data/visuals/${selected}.json`).then((r) => r.json()).then(setVisual).catch(() => setVisual(null));
  }, [selected]);

  const accounts = useMemo(() => [
    { name: "Quan ly kho", username: "admin", role: "Quản lý", initials: "QK" },
    { name: "Nhan vien 01", username: "picker01", role: "Picker", initials: "NV" },
  ].filter((item) => `${item.name} ${item.username} ${item.role}`.toLowerCase().includes(search.toLowerCase())), [search]);

  const updated = store?.updatedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(store.updatedAt)) : "Đang tải";
  const metrics = [
    ["Sản phẩm chủ", store?.masterProducts?.length ?? 0, "Danh mục sản phẩm"],
    ["Kiểm kê tồn", store?.stockChecks?.length ?? 0, "Lần kiểm kê"],
    ["Kiểm kê hao hụt", store?.lossAudits?.length ?? 0, "Bản ghi hao hụt"],
    ["Sơ đồ quầy", 4, "3 file sơ đồ + 1 nguồn"],
  ];

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">P</span><span>Picker Assistant</span></div>
      <p className="side-label">DỮ LIỆU ĐỒNG BỘ</p>
      <nav>
        <a className="active" href="#tong-quan">Tổng quan</a>
        <a href="#so-do">Sơ đồ quầy</a>
        <a href="#tai-khoan">Tài khoản</a>
        <a href="#nguon">Nguồn dữ liệu</a>
      </nav>
      <div className="side-note"><span className="dot" /> GitHub · main<br /><small>Đồng bộ từ repository</small></div>
    </aside>

    <section className="content">
      <header className="topbar">
        <div><p className="eyebrow">KHO HÀNG / BẢN SAO DỮ LIỆU</p><h1>Trung tâm điều hành</h1></div>
        <div className="status"><span className="dot" /> Dữ liệu đã kết nối</div>
      </header>

      <section id="tong-quan" className="hero">
        <div><p className="eyebrow accent">TÌNH TRẠNG HỆ THỐNG</p><h2>Tất cả dữ liệu Picker<br />trong một màn hình.</h2><p className="hero-copy">Xem nhanh dữ liệu kho, sơ đồ quầy và tài khoản đã có trong Picker Assistant.</p></div>
        <div className="sync-card"><p>Cập nhật gần nhất</p><strong>{updated}</strong><span>{loading ? "Đang đọc dữ liệu" : "Đã đồng bộ"}</span></div>
      </section>

      <section className="metrics">{metrics.map(([label, value, hint]) => <article className="metric" key={String(label)}><p>{label}</p><strong>{value}</strong><span>{hint}</span></article>)}</section>

      <section id="so-do" className="panel visual-panel">
        <div className="panel-heading"><div><p className="eyebrow">LAYOUT KHO</p><h2>Sơ đồ quầy hàng</h2></div><span className="pill">{visualFiles.length} sơ đồ có thể xem</span></div>
        <div className="visual-layout">
          <div className="visual-tabs">{visualFiles.map((name) => <button className={selected === name ? "selected" : ""} key={name} onClick={() => setSelected(name)}><span className="file-icon">▧</span><b>{name}</b><small>PDF trang sơ đồ</small></button>)}<div className="missing"><b>L18-A</b><span>Được ghi trong store nhưng chưa có file nguồn.</span></div></div>
          <div className="visual-preview">{visual ? <><img src={visual.src} alt={`Sơ đồ ${selected}`} /><div className="image-meta"><span>{selected} · Trang {visual.pageNumber}</span><span>{visual.width} × {visual.height}</span></div></> : <div className="image-loading">Đang tải sơ đồ…</div>}</div>
        </div>
      </section>

      <section id="tai-khoan" className="panel users-panel">
        <div className="panel-heading"><div><p className="eyebrow">PHÂN QUYỀN</p><h2>Tài khoản ứng dụng</h2></div><input aria-label="Tìm tài khoản" placeholder="Tìm tên hoặc tài khoản" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="account-list">{accounts.map((account) => <article className="account" key={account.username}><span className="avatar">{account.initials}</span><div><b>{account.name}</b><span>@{account.username}</span></div><span className="role">{account.role}</span></article>)}</div>
        <p className="privacy">Thông tin xác thực không được hiển thị trong giao diện này.</p>
      </section>

      <section id="nguon" className="source-strip"><div><p className="eyebrow">NGUỒN</p><b>huy61h1-coder / picker-assistant</b></div><a href="https://github.com/huy61h1-coder/picker-assistant" target="_blank">Mở repository ↗</a></section>
    </section>
  </main>;
}
