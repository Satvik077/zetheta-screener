import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";

// ─── ZUSTAND-LIKE STATE (inline since no external deps) ──────────────────────
const createStore = (initialState) => {
  let state = initialState;
  const listeners = new Set();
  const setState = (updater) => {
    state = typeof updater === "function" ? updater(state) : { ...state, ...updater };
    listeners.forEach((l) => l(state));
  };
  const getState = () => state;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return { setState, getState, subscribe };
};

const useStore = (store, selector = (s) => s) => {
  const [, forceRender] = useState(0);
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const selectedRef = useRef(selector(store.getState()));
  useEffect(() => {
    return store.subscribe((state) => {
      const next = selectorRef.current(state);
      if (next !== selectedRef.current) {
        selectedRef.current = next;
        forceRender((n) => n + 1);
      }
    });
  }, [store]);
  return selectedRef.current;
};

// ─── STOCK DATA GENERATION (5000+ records) ───────────────────────────────────
const SECTORS = ["Technology","Healthcare","Finance","Energy","Consumer","Materials","Utilities","Real Estate","Industrials","Communication"];
const EXCHANGES = ["NASDAQ","NYSE","AMEX","OTC"];
const tickers = [];
const names = [];
const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let idx = 0;
const companyNames = ["Alpha","Beta","Gamma","Delta","Epsilon","Zeta","Eta","Theta","Iota","Kappa","Lambda","Mu","Nu","Xi","Omicron","Pi","Rho","Sigma","Tau","Upsilon","Phi","Chi","Psi","Omega","Apex","Nexus","Vertex","Quantum","Fusion","Stellar","Nova","Pulsar","Vega","Orion","Lyra","Cygnus","Hydra","Perseus","Phoenix","Titan"];
const suffixes = [" Inc","Corp","Ltd","Group","Holdings","Systems","Tech","Bio","Finance","Energy","Capital","Global","Ventures","Labs","Solutions"];

for (let i = 0; i < 5200; i++) {
  const len = i < 26*26 ? 4 : 5;
  let t = "";
  let n = i;
  for (let j = 0; j < len; j++) { t = alpha[n % 26] + t; n = Math.floor(n / 26); }
  tickers.push(t.slice(0, len));
  names.push(companyNames[i % companyNames.length] + " " + companyNames[(i * 7) % companyNames.length] + suffixes[i % suffixes.length]);
}

const seededRand = (seed) => {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
};

const generateStocks = () => {
  return Array.from({ length: 5200 }, (_, i) => {
    const rng = seededRand(i * 31337 + 42);
    const price = +(rng() * 980 + 1).toFixed(2);
    const change = +((rng() - 0.48) * price * 0.08).toFixed(2);
    const changePct = +((change / price) * 100).toFixed(2);
    const volume = Math.floor(rng() * 50000000 + 100000);
    const marketCap = +(price * volume * (rng() * 10 + 1) / 1e9).toFixed(2);
    const pe = rng() < 0.15 ? null : +(rng() * 80 + 5).toFixed(1);
    const eps = pe ? +(price / pe).toFixed(2) : null;
    const week52High = +(price * (1 + rng() * 0.6)).toFixed(2);
    const week52Low = +(price * (1 - rng() * 0.5)).toFixed(2);
    const beta = +((rng() * 2.8 - 0.4)).toFixed(2);
    const dividendYield = rng() < 0.4 ? +(rng() * 6).toFixed(2) : 0;
    const rsi = +(rng() * 100).toFixed(1);
    const macd = +((rng() - 0.5) * 4).toFixed(3);
    const sma20 = +(price * (1 + (rng() - 0.5) * 0.05)).toFixed(2);
    const sma50 = +(price * (1 + (rng() - 0.5) * 0.1)).toFixed(2);
    const sma200 = +(price * (1 + (rng() - 0.5) * 0.2)).toFixed(2);
    const avgVolume = Math.floor(volume * (rng() * 1.5 + 0.5));
    const relVolume = +(volume / avgVolume).toFixed(2);
    const shortFloat = +(rng() * 30).toFixed(1);
    const institutionalOwn = +(rng() * 100).toFixed(1);
    const earningsDate = rng() < 0.5 ? `2026-${String(Math.floor(rng() * 12) + 1).padStart(2, "0")}-${String(Math.floor(rng() * 28) + 1).padStart(2, "0")}` : null;
    return {
      id: i,
      ticker: tickers[i],
      name: names[i],
      sector: SECTORS[i % SECTORS.length],
      exchange: EXCHANGES[i % EXCHANGES.length],
      price, change, changePct,
      volume, avgVolume, relVolume,
      marketCap, pe, eps,
      week52High, week52Low,
      beta, dividendYield,
      rsi, macd, sma20, sma50, sma200,
      shortFloat, institutionalOwn, earningsDate,
      signal: rsi < 30 ? "Oversold" : rsi > 70 ? "Overbought" : "Neutral",
    };
  });
};

const ALL_STOCKS = generateStocks();

// ─── WEBSOCKET SIMULATION ─────────────────────────────────────────────────────
const createWSSimulator = () => {
  const listeners = new Set();
  let interval = null;
  let running = false;
  const start = () => {
    if (running) return;
    running = true;
    interval = setInterval(() => {
      const batch = [];
      for (let i = 0; i < 25; i++) {
        const idx = Math.floor(Math.random() * ALL_STOCKS.length);
        const stock = ALL_STOCKS[idx];
        const delta = (Math.random() - 0.495) * stock.price * 0.003;
        const newPrice = Math.max(0.01, +(stock.price + delta).toFixed(2));
        const newChange = +(stock.change + delta).toFixed(2);
        const newChangePct = +((newChange / (newPrice - newChange)) * 100).toFixed(2);
        ALL_STOCKS[idx] = { ...stock, price: newPrice, change: newChange, changePct: newChangePct, volume: stock.volume + Math.floor(Math.random() * 10000) };
        batch.push({ id: idx, price: newPrice, change: newChange, changePct: newChangePct, volume: ALL_STOCKS[idx].volume });
      }
      listeners.forEach((l) => l(batch));
    }, 300);
  };
  const stop = () => { running = false; clearInterval(interval); };
  const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
  return { start, stop, subscribe };
};

const wsSimulator = createWSSimulator();

// ─── CANDLESTICK DATA GENERATOR ───────────────────────────────────────────────
const generateOHLC = (basePrice, days = 120) => {
  const data = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const open = price;
    const move = (Math.random() - 0.48) * price * 0.04;
    const close = Math.max(0.01, +(open + move).toFixed(2));
    const high = +(Math.max(open, close) * (1 + Math.random() * 0.02)).toFixed(2);
    const low = +(Math.min(open, close) * (1 - Math.random() * 0.02)).toFixed(2);
    const vol = Math.floor(Math.random() * 5000000 + 500000);
    data.push({ date: new Date(now - i * 86400000), open, high, low, close, volume: vol });
    price = close;
  }
  return data;
};

// ─── GLOBAL APP STORE ─────────────────────────────────────────────────────────
const appStore = createStore({
  auth: { isLoggedIn: false, user: null, token: null },
  filters: {
    search: "", sector: "All", exchange: "All",
    minPrice: "", maxPrice: "", minMarketCap: "", maxMarketCap: "",
    minVolume: "", minRSI: "", maxRSI: "", minChangePct: "", maxChangePct: "",
    signal: "All", minPE: "", maxPE: "", minBeta: "", maxBeta: "",
    hasDividend: false, minDividend: "",
  },
  sort: { col: "marketCap", dir: "desc" },
  selectedStock: null,
  wsActive: true,
  livePrices: {},
  theme: "dark",
  benchmarks: { filterTime: 0, renderTime: 0, totalRows: 5200 },
  notifications: [],
  watchlist: [],
  activeTab: "screener",
});

// ─── AUTH UTILS ───────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { email: "demo@zetheta.com", password: "Demo@2024", name: "Alex Morgan", role: "Analyst", avatar: "AM" },
  { email: "trader@zetheta.com", password: "Trade@123", name: "Sam Chen", role: "Senior Trader", avatar: "SC" },
  { email: "admin@zetheta.com", password: "Admin@999", name: "Jordan Lee", role: "Administrator", avatar: "JL" },
];

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 16, color = "currentColor", fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const ICONS = {
  trending: "M22 7l-8.5 8.5-5-5L2 17",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  star: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
  close: "M6 18L18 6M6 6l12 12",
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  wifi: "M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  up: "M5 15l7-7 7 7",
  down: "M19 9l-7 7-7-7",
  settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  app: {
    fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
    background: "#080c14",
    color: "#c8d8f0",
    minHeight: "100vh",
    overflow: "hidden",
    position: "relative",
  },
  glass: {
    background: "rgba(12,22,45,0.85)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(0,200,255,0.12)",
    borderRadius: 8,
  },
  glassHover: {
    background: "rgba(0,200,255,0.06)",
    transition: "all 0.15s ease",
  },
  input: {
    background: "rgba(0,200,255,0.04)",
    border: "1px solid rgba(0,200,255,0.15)",
    borderRadius: 6,
    color: "#c8d8f0",
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: {
    background: "rgba(0,200,255,0.1)",
    border: "1px solid rgba(0,200,255,0.3)",
    borderRadius: 6,
    color: "#00c8ff",
    padding: "7px 14px",
    fontSize: 12,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "all 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #00c8ff22, #0066ff22)",
    border: "1px solid #00c8ff66",
    borderRadius: 6,
    color: "#00e5ff",
    padding: "10px 24px",
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
    fontWeight: 600,
    letterSpacing: 1,
    transition: "all 0.2s",
  },
  tag: (color) => ({
    background: `${color}22`,
    border: `1px solid ${color}44`,
    color,
    borderRadius: 4,
    padding: "2px 7px",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.5,
  }),
  positive: { color: "#00ff9d" },
  negative: { color: "#ff4466" },
  neutral: { color: "#8899bb" },
  header: {
    background: "rgba(4,10,24,0.95)",
    borderBottom: "1px solid rgba(0,200,255,0.12)",
    padding: "0 20px",
    height: 56,
    display: "flex",
    alignItems: "center",
    gap: 20,
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
};

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
const LoginScreen = () => {
  const [email, setEmail] = useState("demo@zetheta.com");
  const [password, setPassword] = useState("Demo@2024");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const login = () => {
    setLoading(true); setError("");
    setTimeout(() => {
      const user = MOCK_USERS.find(u => u.email === email && u.password === password);
      if (user) {
        const token = btoa(JSON.stringify({ email: user.email, exp: Date.now() + 3600000 }));
        appStore.setState(s => ({ ...s, auth: { isLoggedIn: true, user, token } }));
        wsSimulator.start();
      } else {
        setError("Invalid credentials. Try demo@zetheta.com / Demo@2024");
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #080c14; }
        ::-webkit-scrollbar-thumb { background: #00c8ff33; border-radius: 2px; }
        input::placeholder { color: #4466aa88; }
        select option { background: #0a1628; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .row-flash { animation: rowFlash 0.4s ease; }
        @keyframes rowFlash { 0%{background:rgba(0,200,255,0.15)} 100%{background:transparent} }
      `}</style>

      {/* Grid background */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(0,200,255,0.03) 1px, transparent 1px),linear-gradient(90deg, rgba(0,200,255,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

      <div style={{ ...S.glass, width: 420, padding: 40, animation: "fadeIn 0.4s ease", position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #00c8ff, #0066ff)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon path={ICONS.zap} size={20} color="#000" />
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: "#00e5ff", letterSpacing: 2 }}>ZETHETA</span>
          </div>
          <div style={{ color: "#4477aa", fontSize: 11, letterSpacing: 3 }}>STOCK INTELLIGENCE PLATFORM</div>
        </div>

        {/* Demo accounts */}
        <div style={{ background: "rgba(0,200,255,0.04)", border: "1px solid rgba(0,200,255,0.1)", borderRadius: 6, padding: "10px 14px", marginBottom: 24, fontSize: 11, color: "#5588aa" }}>
          <div style={{ marginBottom: 4, color: "#00c8ff88", fontWeight: 600 }}>DEMO ACCOUNTS</div>
          {MOCK_USERS.map(u => (
            <div key={u.email} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ cursor: "pointer", color: "#4499cc" }} onClick={() => { setEmail(u.email); setPassword(u.password); }}>{u.email}</span>
              <span style={{ color: "#335566" }}>{u.role}</span>
            </div>
          ))}
        </div>

        {/* Fields */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: "#4477aa", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Icon path={ICONS.mail} size={12} /> EMAIL
          </label>
          <input style={S.input} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 10, color: "#4477aa", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Icon path={ICONS.lock} size={12} /> PASSWORD
          </label>
          <div style={{ position: "relative" }}>
            <input style={S.input} type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
            <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4477aa", cursor: "pointer" }}>
              <Icon path={ICONS.eye} size={14} />
            </button>
          </div>
        </div>

        {error && <div style={{ color: "#ff4466", fontSize: 11, marginBottom: 16, padding: "8px 12px", background: "#ff446611", borderRadius: 6, border: "1px solid #ff446633" }}>{error}</div>}

        <button onClick={login} disabled={loading} style={{ ...S.btnPrimary, width: "100%", justifyContent: "center", display: "flex", gap: 8 }}>
          {loading ? <div style={{ width: 14, height: 14, border: "2px solid #00c8ff33", borderTopColor: "#00c8ff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> : <Icon path={ICONS.zap} size={14} />}
          {loading ? "AUTHENTICATING..." : "ACCESS PLATFORM"}
        </button>

        <div style={{ textAlign: "center", marginTop: 20, color: "#2244556", fontSize: 10, color: "#334466" }}>
          Zetheta Stock Intelligence Platform v2.4.1 · Production Build
        </div>
      </div>
    </div>
  );
};

// ─── CANDLESTICK CHART ────────────────────────────────────────────────────────
const CandlestickChart = memo(({ stock }) => {
  const canvasRef = useRef(null);
  const [indicator, setIndicator] = useState("SMA");
  const data = useMemo(() => generateOHLC(stock.price), [stock.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const PAD = { top: 20, right: 60, bottom: 50, left: 60 };
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#040a18";
    ctx.fillRect(0, 0, W, H);

    const visible = data.slice(-80);
    const prices = visible.flatMap(d => [d.high, d.low]);
    const minP = Math.min(...prices) * 0.998;
    const maxP = Math.max(...prices) * 1.002;
    const pToY = p => PAD.top + CH - ((p - minP) / (maxP - minP)) * CH;
    const iToX = i => PAD.left + (i + 0.5) * (CW / visible.length);

    // Grid
    ctx.strokeStyle = "rgba(0,200,255,0.06)";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 5; g++) {
      const y = PAD.top + (g / 5) * CH;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + CW, y); ctx.stroke();
      const price = maxP - (g / 5) * (maxP - minP);
      ctx.fillStyle = "#4466aa88"; ctx.font = "10px DM Mono"; ctx.textAlign = "right";
      ctx.fillText(price.toFixed(2), PAD.left - 8, y + 4
