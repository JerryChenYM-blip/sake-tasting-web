/* =============================================================
   清酒試飲會 — React 主應用
   單檔架構：Intro → Stage → Evaluation → Discussion → Cart → LiveWall
   無 build step：在 <script type="text/babel"> 中執行
   ============================================================= */
/* global React, ReactDOM */

const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ----------------------------------------------------------------
   1. Web Audio 音效（程式合成，無外部檔）
   ---------------------------------------------------------------- */
let _audioCtx = null;
function getAudio() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return null; }
  }
  // iOS 在使用者首次互動時 resume
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}

function envGain(ctx, dur, peak = 0.3) {
  const g = ctx.createGain();
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  return g;
}

// 開瓶「啵」+ 氣泡聲
function playPopAndFizz() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  // pop
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(180, now);
  o.frequency.exponentialRampToValueAtTime(60, now + 0.18);
  const g = envGain(ctx, 0.22, 0.5);
  o.connect(g).connect(ctx.destination);
  o.start(now); o.stop(now + 0.25);

  // fizz（白噪音 high-pass）
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.9, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, now + 0.15);
  ng.gain.linearRampToValueAtTime(0.12, now + 0.22);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  noise.connect(hp).connect(ng).connect(ctx.destination);
  noise.start(now + 0.15); noise.stop(now + 1.2);
}

// 飲用「咕嚕」
function playGulp() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    o.type = "sine";
    const start = now + i * 0.16;
    o.frequency.setValueAtTime(220 + i * 30, start);
    o.frequency.exponentialRampToValueAtTime(100, start + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.25, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start(start); o.stop(start + 0.2);
  }
}

// 配餐「咀嚼」（短促）
function playEat() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 2; i++) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = 360 - i * 60;
    const g = envGain(ctx, 0.1, 0.18);
    o.connect(g).connect(ctx.destination);
    const t = now + i * 0.12;
    o.start(t); o.stop(t + 0.1);
  }
}

// 飛機（產區飛行）
function playAirplane() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(80, now);
  o.frequency.linearRampToValueAtTime(220, now + 0.6);
  o.frequency.linearRampToValueAtTime(80, now + 1.2);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
  const g = envGain(ctx, 1.3, 0.18);
  o.connect(lp).connect(g).connect(ctx.destination);
  o.start(now); o.stop(now + 1.3);
}

// 鈴
function playBell() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = envGain(ctx, 0.9, 0.22);
    o.connect(g).connect(ctx.destination);
    o.start(now + i * 0.08); o.stop(now + 0.95);
  });
}

// 倒酒咕嚕（連續低音）
function playPour() {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  // 連續低音 + 隨機抖動
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(140, now);
  const lfo = ctx.createOscillator();
  lfo.type = "sine"; lfo.frequency.value = 12;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 22;
  lfo.connect(lfoGain).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.22, now + 0.1);
  g.gain.setValueAtTime(0.22, now + 1.4);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  o.connect(g).connect(ctx.destination);
  o.start(now); o.stop(now + 1.85);
  lfo.start(now); lfo.stop(now + 1.85);

  // 噴頭白噪音
  const buf = ctx.createBuffer(1, ctx.sampleRate * 1.6, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
  const n = ctx.createBufferSource(); n.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, now);
  ng.gain.linearRampToValueAtTime(0.08, now + 0.15);
  ng.gain.setValueAtTime(0.08, now + 1.4);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
  n.connect(bp).connect(ng).connect(ctx.destination);
  n.start(now); n.stop(now + 1.75);
}

/* ----------------------------------------------------------------
   2. localStorage 持久化
   ---------------------------------------------------------------- */
const LS_KEY = "sake-tasting-v1";
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 同日才回覆
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.day !== today) return null;
    return parsed;
  } catch { return null; }
}
function saveState(patch) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = loadState() || {};
    const merged = { ...existing, ...patch, day: today };
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
  } catch {}
}
function clearState() { try { localStorage.removeItem(LS_KEY); } catch {} }

/* ----------------------------------------------------------------
   3. SSI 象限色判定
   ---------------------------------------------------------------- */
function ssiQuadrantKey(ssi) {
  // x: 風味濃淡 (0 輕 → 100 濃)
  // y: 香氣高低 (0 低 → 100 高)
  if (!ssi) return "sou";
  const { x, y } = ssi;
  if (x < 50 && y >= 50) return "kun";   // 薰：高香低味
  if (x < 50 && y < 50)  return "sou";   // 爽：低香低味
  if (x >= 50 && y < 50) return "jun";   // 醇：低香高味
  return "juku";                         // 熟：高香高味
}

/* ----------------------------------------------------------------
   4. 通用：陀螺儀許可（iOS）
   ---------------------------------------------------------------- */
function requestGyroPerm() {
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission().catch(() => {});
  }
}

/* ================================================================
   元件：BottleStage — 偽 3D 酒瓶舞台
   ================================================================ */
function BottleStage({ sake, opened, onOpen }) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const [shake, setShake] = useState(false);
  const [capFly, setCapFly] = useState(false);
  const [bubbles, setBubbles] = useState([]);
  const halo = ssiQuadrantKey(sake.ssi);

  // 光斑：mouse / touch 更新 CSS 變數
  const handlePointer = useCallback((e) => {
    const el = imgRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX; clientY = e.clientY;
    }
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${Math.max(0, Math.min(100, x))}%`);
    el.style.setProperty("--my", `${Math.max(0, Math.min(100, y))}%`);
  }, []);

  // 陀螺儀視差（3~5 度）
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    let active = true;
    function onOrient(ev) {
      if (!active) return;
      const beta = ev.beta || 0;   // 前後傾 -180~180
      const gamma = ev.gamma || 0; // 左右傾 -90~90
      // 限制 ±5 度（rotateY 用 gamma、rotateX 用 beta）
      const ry = Math.max(-5, Math.min(5, gamma / 6));
      const rx = Math.max(-5, Math.min(5, (beta - 30) / 8));
      wrap.style.transform = `rotateY(${ry}deg) rotateX(${-rx}deg)`;
    }
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      active = false;
      window.removeEventListener("deviceorientation", onOrient);
      if (wrap) wrap.style.transform = "";
    };
  }, []);

  // 開瓶觸發
  function handleTap() {
    if (opened) return;
    requestGyroPerm(); // 第一次點擊請求陀螺儀
    setShake(true);
    setTimeout(() => setShake(false), 320);
    setTimeout(() => setCapFly(true), 280);
    // 生成 10 個氣泡
    const newBubbles = Array.from({ length: 10 }, (_, i) => ({
      id: Date.now() + i,
      bx: (Math.random() - 0.5) * 80,
      delay: Math.random() * 0.4,
    }));
    setBubbles(newBubbles);
    playPopAndFizz();
    setTimeout(() => {
      onOpen();
    }, 950);
    setTimeout(() => setBubbles([]), 2200);
  }

  return (
    <div
      className="bottle-stage"
      onMouseMove={handlePointer}
      onTouchMove={handlePointer}
      onClick={handleTap}
    >
      <div className={`stage-halo halo-${halo}`} />

      <div ref={wrapRef} className="bottle-wrap" style={{ transition: "transform 0.2s ease" }}>
        {/* 倒影 */}
        <img className="bottle-reflection" src={sake.bottleImage} alt="" aria-hidden />

        {/* 瓶身 */}
        <div className={`relative h-full flex items-end ${shake ? "bottle-shake" : ""}`}>
          <img
            ref={imgRef}
            className="bottle-img"
            src={sake.bottleImage}
            alt={sake.name}
            draggable="false"
          />
          <div className="bottle-img-mask" />
        </div>

        {/* 瓶蓋飛出 overlay（簡版：直接以 CSS 矩形模擬，不用額外圖片） */}
        {capFly && <div className="cap-overlay cap-fly" />}

        {/* 氣泡 */}
        {bubbles.map(b => (
          <span
            key={b.id}
            className="bubble"
            style={{ "--bx": `${b.bx}px`, animationDelay: `${b.delay}s` }}
          />
        ))}
      </div>

      {!opened && <div className="tap-hint">點酒瓶開瓶</div>}
    </div>
  );
}

/* ================================================================
   元件：SSI 四象限
   ================================================================ */
function SSIChart({ ssi, label }) {
  if (!ssi) return null;
  return (
    <div className="ssi-grid">
      <div className="ssi-axis-h" />
      <div className="ssi-axis-v" />
      <span className="ssi-quad-label" style={{ top: 10, left: 14, color: "#C44871" }}>薰</span>
      <span className="ssi-quad-label" style={{ top: 10, right: 14, color: "#A8782F" }}>熟</span>
      <span className="ssi-quad-label" style={{ bottom: 10, left: 14, color: "#4A86B5" }}>爽</span>
      <span className="ssi-quad-label" style={{ bottom: 10, right: 14, color: "#C66F1F" }}>醇</span>
      <div className="ssi-dot" style={{ left: `${ssi.x}%`, bottom: `${ssi.y}%` }} />
      {label && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-muted bg-white/80 px-2 py-0.5 rounded-full">
          {label}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   元件：Carousel
   ================================================================ */
function Carousel({ items, render }) {
  return (
    <div className="carousel pb-2">
      {items.map((it, i) => (
        <div className="carousel-card" key={i}>{render(it, i)}</div>
      ))}
    </div>
  );
}

/* ================================================================
   元件：Modal Sheet
   ================================================================ */
function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-ink">{title}</h3>
          <button className="jelly-btn text-2xl text-muted px-2" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ================================================================
   元件：Star Rating 1~10
   ================================================================ */
function StarRating({ value, onChange, max = 10 }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`star ${i < value ? "active" : ""}`}
          onClick={() => onChange(i + 1)}
        >★</span>
      ))}
    </div>
  );
}

/* ================================================================
   元件：Chip Group（複選 + 自填）
   ================================================================ */
function ChipGroup({ options, selected, onToggle, custom, setCustom }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-center mb-3">
        {options.map(opt => (
          <span
            key={opt}
            className={`chip jelly-btn ${selected.includes(opt) ? "chip-selected" : ""}`}
            onClick={() => onToggle(opt)}
          >{opt}</span>
        ))}
      </div>
      <input
        type="text"
        className="w-full px-4 py-2 rounded-full border border-gray-200 bg-white text-sm"
        placeholder="自填其他（可選）"
        value={custom || ""}
        onChange={e => setCustom(e.target.value)}
      />
    </div>
  );
}

/* ================================================================
   主畫面：Intro
   ================================================================ */
function IntroScreen({ stores, onPick }) {
  return (
    <div className="px-5 py-8 fade-in">
      <div className="text-center mb-8">
        <p className="text-gold text-xs tracking-[0.4em] font-bold mb-2">SAKE TASTING 2026</p>
        <h1 className="text-4xl font-bold mb-3">清酒試飲會</h1>
        <p className="text-muted text-sm leading-relaxed">
          開瓶 · 品味 · 評鑑 · 議題討論<br/>
          一人一杯，七款清酒的旅程
        </p>
      </div>

      <div className="glass-panel p-5 mb-5">
        <p className="text-xs font-bold text-gold tracking-widest mb-3">請選擇您的店家</p>
        <div className="grid grid-cols-2 gap-2">
          {stores.map(s => (
            <button
              key={s}
              className="jelly-btn btn-outline text-sm py-3"
              onClick={() => onPick(s)}
            >{s}</button>
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-muted">
        ※ 您的選擇與評鑑會自動儲存於本機，僅於當日有效。
      </p>
    </div>
  );
}

/* ================================================================
   主畫面：Stage 第 N 款酒
   ================================================================ */
function StageScreen({ sake, index, total, onStartEval, opened, setOpened }) {
  const [sheet, setSheet] = useState(null); // story / aroma / taste / pairing / region

  // 進入下一款酒重設「開瓶」狀態
  // (在 App 層用 key 重置；此元件僅讀 props)

  const infoButtons = [
    { key: "story",  emoji: "🏛️", label: "酒造故事", sound: playBell },
    { key: "aroma",  emoji: "✨", label: "香氣定位", sound: playBell },
    { key: "taste",  emoji: "🍶", label: "飲用口感", sound: playPour },
    { key: "pair",   emoji: "🥢", label: "餐點搭配", sound: playEat },
    { key: "region", emoji: "🗺️", label: "產區介紹", sound: playAirplane },
  ];

  return (
    <div className="fade-in">
      {/* 頂部進度 */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted tracking-widest">
            #{String(sake.id).padStart(2,"0")} / 共 {total} 款
          </span>
          <span className="text-xs text-gold font-bold">{sake.ssiQuadrant}</span>
        </div>
        <div className="progress-pill">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`pill ${i <= index ? "done" : ""}`} />
          ))}
        </div>
      </div>

      {/* 酒名 */}
      <div className="text-center px-5 pt-2">
        <h2 className="text-2xl font-bold leading-tight">{sake.name}</h2>
        <p className="text-xs text-muted mt-1">{sake.brewery} · {sake.region}</p>
      </div>

      {/* 酒瓶舞台 */}
      <BottleStage sake={sake} opened={opened} onOpen={() => setOpened(true)} />

      {/* 五個資訊按鈕 — 開瓶後才出現 */}
      {opened && (
        <div className="px-5 mt-2 fade-in">
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {infoButtons.map(b => (
              <button
                key={b.key}
                className="jelly-btn glass-panel py-3 px-1 text-center"
                onClick={() => { b.sound && b.sound(); setSheet(b.key); }}
              >
                <div className="text-2xl">{b.emoji}</div>
                <div className="text-[10px] mt-1 font-bold text-ink">{b.label}</div>
              </button>
            ))}
          </div>

          <button
            className="jelly-btn btn-gold w-full text-base"
            onClick={onStartEval}
          >開始評鑑儀式 →</button>
        </div>
      )}

      {/* 各種 Sheet */}
      <Sheet open={sheet === "story"} onClose={() => setSheet(null)} title="🏛️ 酒造故事">
        <Carousel
          items={sake.breweryStorySlides}
          render={(s) => (
            <div>
              <h4 className="font-bold text-lg mb-2 text-gold">{s.title}</h4>
              <p className="text-sm leading-relaxed break-word">{s.desc}</p>
            </div>
          )}
        />
        <p className="text-[10px] text-muted mt-3 text-center">← 左右滑動瀏覽 →</p>
      </Sheet>

      <Sheet open={sheet === "aroma"} onClose={() => setSheet(null)} title="✨ 香氣定位">
        <div className="mb-4">
          <SSIChart ssi={sake.ssi} label={sake.ssiQuadrant} />
        </div>
        <p className="text-xs text-muted mb-2">SSI 4 象限：香氣高低 × 風味濃淡</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {sake.aromaTags.map(t => (
            <span key={t} className="chip chip-aroma">{t}</span>
          ))}
        </div>
        <p className="text-sm leading-relaxed break-word">{sake.aromaDesc}</p>
        <p className="text-[11px] text-muted mt-3 italic">{sake.ssiReason}</p>
      </Sheet>

      <Sheet open={sheet === "taste"} onClose={() => setSheet(null)} title="🍶 飲用口感">
        <div className="bg-paper rounded-2xl p-4 mb-4">
          <p className="text-xs font-bold text-gold mb-2 tracking-widest">日本酒度（SMV）</p>
          {sake.smv !== null ? (
            <div>
              <input
                type="range"
                className="sake-range"
                min="-15" max="20" value={sake.smv}
                readOnly
              />
              <div className="flex justify-between text-[11px] text-muted mt-1">
                <span>← 甘口</span>
                <b className="text-gold">{sake.smvLabel}</b>
                <span>辛口 →</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">{sake.smvLabel}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <span className="text-muted">酒精度</span><br/><b>{sake.abv}</b>
          </div>
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <span className="text-muted">酸度</span><br/><b>{sake.acidityLabel || "—"}</b>
          </div>
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <span className="text-muted">酒米</span><br/><b>{sake.rice}</b>
          </div>
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <span className="text-muted">精米</span><br/><b>{sake.polish}</b>
          </div>
        </div>
        <p className="text-sm leading-relaxed break-word">{sake.tasteDesc}</p>
      </Sheet>

      <Sheet open={sheet === "pair"} onClose={() => setSheet(null)} title="🥢 餐點搭配">
        <div className="space-y-2">
          {sake.pairingDetails.map((p, i) => (
            <div key={i} className="bg-paper rounded-2xl p-3">
              <div className="flex justify-between items-start mb-1">
                <b className="text-sm">{p.title}</b>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white" style={{ color: "#B8860B", border: "1px solid rgba(184,134,11,0.4)" }}>
                  {p.type}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed break-word">{p.reason}</p>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "region"} onClose={() => setSheet(null)} title="🗺️ 產區介紹">
        <p className="text-xs text-gold font-bold tracking-widest mb-2">⛩️ 觀光景點</p>
        <Carousel items={sake.sightseeing} render={(x) => (
          <div>
            <h4 className="font-bold mb-1">{x.title}</h4>
            <p className="text-xs text-muted break-word">{x.desc}</p>
          </div>
        )} />
        <p className="text-xs text-gold font-bold tracking-widest mt-4 mb-2">🍡 當地名產</p>
        <Carousel items={sake.specialties} render={(x) => (
          <div>
            <h4 className="font-bold mb-1">{x.title}</h4>
            <p className="text-xs text-muted break-word">{x.desc}</p>
          </div>
        )} />
      </Sheet>
    </div>
  );
}

/* ================================================================
   主畫面：Evaluation 5 步驟評鑑儀式
   ================================================================ */
const AROMA_OPTS = ["🍒 果香","🌸 花香","🌾 米香","🍋 柑橘","🌰 堅果","🍯 蜜甜","🪨 礦石","🥛 乳酸","🍂 熟成","🫧 氣泡"];
const PAIR_OPTS  = ["生魚片","壽司","烤魚","燒肉","天婦羅","燉煮","起司","甜點","蔬食","湯品"];

function EvaluationScreen({ sake, initial, onSave, onCancel }) {
  const [step, setStep] = useState(0);
  const [aroma, setAroma] = useState(initial?.aroma || []);
  const [aromaCustom, setAromaCustom] = useState(initial?.aromaCustom || "");
  const [body, setBody] = useState(initial?.body || 3);
  const [alcohol, setAlcohol] = useState(initial?.alcohol || 3);
  const [pair, setPair] = useState(initial?.pair || []);
  const [pairCustom, setPairCustom] = useState(initial?.pairCustom || "");
  const [note, setNote] = useState(initial?.note || "");
  const [rating, setRating] = useState(initial?.rating || 0);
  const [remain, setRemain] = useState(30);
  const [timeUp, setTimeUp] = useState(false);

  // 30 秒倒數
  useEffect(() => {
    setRemain(30); setTimeUp(false);
    const t = setInterval(() => {
      setRemain(r => {
        if (r <= 1) { clearInterval(t); setTimeUp(true); playBell(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  const steps = [
    { title: "1. 香氣探索", icon: "✨" },
    { title: "2. 酒體重量", icon: "⚖️" },
    { title: "3. 酒精衝擊", icon: "🔥" },
    { title: "4. 料理配對", icon: "🥢" },
    { title: "5. 評語 & 意願", icon: "⭐" },
  ];

  function toggle(arr, setter, v) {
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  }

  function canNext() {
    if (step === 0) return aroma.length > 0 || (aromaCustom && aromaCustom.trim());
    if (step === 4) return rating >= 1;
    return true;
  }

  function next() {
    if (!canNext()) return;
    if (step === 4) {
      // 提交
      onSave({
        sakeId: sake.id,
        aroma, aromaCustom,
        body, alcohol,
        pair, pairCustom,
        note, rating,
        completedAt: new Date().toISOString(),
      });
    } else {
      setStep(s => s + 1);
    }
  }

  return (
    <div className="fade-in px-5 pt-6 pb-12">
      <div className="flex items-center justify-between mb-3">
        <button className="text-muted text-sm" onClick={onCancel}>← 返回</button>
        <span className="text-xs font-bold" style={{ color: timeUp ? "#D85070" : "#B8860B" }}>
          ⏱ {timeUp ? "時間到（仍可填寫）" : `剩餘 ${remain}s`}
        </span>
      </div>

      <div className="text-center mb-2">
        <p className="text-xs text-muted">{sake.name}</p>
        <h2 className="text-xl font-bold">{steps[step].icon} {steps[step].title}</h2>
      </div>

      <div className="progress-pill mb-6">
        {steps.map((_, i) => (
          <span key={i} className={`pill ${i <= step ? "done" : ""}`} />
        ))}
      </div>

      <div className="glass-panel p-5 mb-5 min-h-[280px]">
        {step === 0 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">您聞到了什麼？（複選，至少一項）</p>
            <ChipGroup
              options={AROMA_OPTS}
              selected={aroma}
              onToggle={(v) => toggle(aroma, setAroma, v)}
              custom={aromaCustom}
              setCustom={setAromaCustom}
            />
          </div>
        )}
        {step === 1 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">酒體重量？1 = 極輕盈，5 = 厚重</p>
            <input
              type="range" min="1" max="5" value={body}
              className="sake-range"
              onChange={e => setBody(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>輕</span><b className="text-gold text-xl">{body}</b><span>重</span>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">酒精衝擊？1 = 溫和，5 = 強烈</p>
            <input
              type="range" min="1" max="5" value={alcohol}
              className="sake-range"
              onChange={e => setAlcohol(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>溫和</span><b className="text-gold text-xl">{alcohol}</b><span>強烈</span>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <p className="text-sm text-muted mb-4 text-center">您覺得搭配什麼料理最對味？</p>
            <ChipGroup
              options={PAIR_OPTS}
              selected={pair}
              onToggle={(v) => toggle(pair, setPair, v)}
              custom={pairCustom}
              setCustom={setPairCustom}
            />
          </div>
        )}
        {step === 4 && (
          <div>
            <p className="text-sm text-muted mb-3 text-center">採購意願（1~10 星，至少 1 星）</p>
            <StarRating value={rating} onChange={setRating} />
            <p className="text-center text-gold font-bold mt-2">{rating || "?"} / 10</p>
            <textarea
              className="w-full mt-4 px-3 py-2 rounded-2xl border border-gray-200 bg-white text-sm break-word"
              placeholder="一句話評語（選填）"
              rows="3"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {step > 0 && (
          <button className="jelly-btn btn-outline flex-1" onClick={() => setStep(s => s - 1)}>← 上一步</button>
        )}
        <button
          className="jelly-btn btn-gold flex-1"
          disabled={!canNext()}
          onClick={next}
        >
          {step === 4 ? "完成評鑑 ✓" : "下一步 →"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   主畫面：Discussion 餐飲場景討論題
   ================================================================ */
function DiscussionScreen({ sake, isLast, onNext, onFinish }) {
  return (
    <div className="fade-in px-5 pt-8 pb-12">
      <div className="text-center mb-6">
        <p className="text-xs text-muted">{sake.name}</p>
        <h2 className="text-2xl font-bold mt-1">💬 場景討論</h2>
      </div>
      <div className="glass-panel p-6 mb-6">
        <p className="text-xs text-gold font-bold tracking-widest mb-3">餐飲場景提問</p>
        <p className="text-base leading-relaxed text-ink break-word italic">
          {sake.discussionPrompt}
        </p>
      </div>
      <p className="text-center text-xs text-muted mb-4">
        ※ 桌上請與夥伴分享您的看法。
      </p>
      <button
        className="jelly-btn btn-gold w-full"
        onClick={() => { playBell(); isLast ? onFinish() : onNext(); }}
      >
        {isLast ? "完成所有酒款 → 採購單" : "下一款酒 →"}
      </button>
    </div>
  );
}

/* ================================================================
   主畫面：Cart 採購單（兩步）
   ================================================================ */
const MOTIVE_OPTS  = ["客人指名度","風味稀有度","cp 值高","在地故事強","季節限定","視覺/包裝佳"];
const STRATEGY_OPTS = ["套餐搭配","單點推薦","常客驚喜","新客入門","活動限定","盲飲挑戰"];
const RANK_OPTS    = ["價格","風味","產地","季節","稀有度","客群"];

function CartScreen({ sakes, evals, cart, setCart, onSubmit, onBack }) {
  const [step, setStep] = useState(1);
  const [motives, setMotives] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [ranking, setRanking] = useState(RANK_OPTS);

  function setQty(id, delta) {
    setCart(prev => {
      const next = { ...prev };
      next[id] = Math.max(0, (next[id] || 0) + delta);
      return next;
    });
  }

  function move(i, dir) {
    setRanking(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function toggle(arr, setter, v) {
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  }

  const totalBottles = Object.values(cart).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="fade-in px-5 pt-6 pb-12">
      <div className="flex items-center justify-between mb-3">
        <button className="text-muted text-sm" onClick={onBack}>← 返回</button>
        <span className="text-xs text-gold font-bold tracking-widest">採購決策</span>
      </div>

      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold">🛒 我的採購單</h2>
        <p className="text-xs text-muted mt-1">Step {step} / 2</p>
      </div>

      {step === 1 && (
        <div className="space-y-3 mb-5">
          {sakes.map(s => (
            <div key={s.id} className="glass-panel p-3 flex items-center gap-3">
              <img src={s.bottleImage} className="w-12 h-20 object-contain" alt={s.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight break-word">{s.name}</p>
                <p className="text-[10px] text-muted">{s.brewery}</p>
                {evals[s.id]?.rating && (
                  <p className="text-[11px] text-gold">★ {evals[s.id].rating}/10</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="jelly-btn w-8 h-8 rounded-full bg-paper text-gold font-bold"
                  onClick={() => setQty(s.id, -1)}
                >−</button>
                <span className="font-bold text-lg w-6 text-center">{cart[s.id] || 0}</span>
                <button
                  className="jelly-btn w-8 h-8 rounded-full bg-gold text-white font-bold"
                  onClick={() => setQty(s.id, 1)}
                >＋</button>
              </div>
            </div>
          ))}
          <div className="text-center text-sm text-muted mb-2">
            共 <b className="text-gold text-lg">{totalBottles}</b> 瓶
          </div>
          <button
            className="jelly-btn btn-gold w-full"
            onClick={() => setStep(2)}
          >下一步：動機與策略 →</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 mb-5">
          <div className="glass-panel p-4">
            <p className="text-xs font-bold text-gold tracking-widest mb-3">採購動機（複選）</p>
            <div className="flex flex-wrap gap-2">
              {MOTIVE_OPTS.map(m => (
                <span
                  key={m}
                  className={`chip jelly-btn ${motives.includes(m) ? "chip-selected" : ""}`}
                  onClick={() => toggle(motives, setMotives, m)}
                >{m}</span>
              ))}
            </div>
          </div>

          <div className="glass-panel p-4">
            <p className="text-xs font-bold text-gold tracking-widest mb-3">運用策略（複選）</p>
            <div className="flex flex-wrap gap-2">
              {STRATEGY_OPTS.map(m => (
                <span
                  key={m}
                  className={`chip jelly-btn ${strategies.includes(m) ? "chip-selected" : ""}`}
                  onClick={() => toggle(strategies, setStrategies, m)}
                >{m}</span>
              ))}
            </div>
          </div>

          <div className="glass-panel p-4">
            <p className="text-xs font-bold text-gold tracking-widest mb-3">進貨考量排序（拖動或點箭頭）</p>
            <div className="space-y-2">
              {ranking.map((r, i) => (
                <div key={r} className="flex items-center bg-white rounded-xl p-2 border border-gray-100">
                  <span className="font-bold text-gold w-6">{i + 1}</span>
                  <span className="flex-1 text-sm">{r}</span>
                  <button className="jelly-btn px-2 text-muted" onClick={() => move(i, -1)}>▲</button>
                  <button className="jelly-btn px-2 text-muted" onClick={() => move(i, 1)}>▼</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="jelly-btn btn-outline flex-1"
              onClick={() => setStep(1)}
            >← 上一步</button>
            <button
              className="jelly-btn btn-gold flex-1"
              onClick={() => onSubmit({ motives, strategies, ranking })}
            >提交採購單 ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   主畫面：LiveWall 統計牆（mock）
   ================================================================ */
function LiveWallScreen({ sakes, onRestart }) {
  // mock 數據
  const mockStats = sakes.map((s, i) => ({
    id: s.id,
    name: s.name,
    avgRating: (6 + Math.sin(i * 1.7) * 1.8 + Math.random() * 1.2).toFixed(1),
    topAroma: s.aromaTags[0],
    bottles: 4 + Math.floor(Math.random() * 12),
  }));

  return (
    <div className="fade-in px-5 pt-6 pb-12">
      <div className="text-center mb-3">
        <span className="mock-tag">📊 示意統計（活動結束後更新）</span>
      </div>
      <h2 className="text-2xl font-bold text-center mb-1">統計牆</h2>
      <p className="text-xs text-muted text-center mb-6">全場 16 位參與者的評鑑彙整（模擬數據）</p>

      <div className="space-y-3">
        {mockStats
          .sort((a, b) => b.avgRating - a.avgRating)
          .map((row, idx) => {
            const sake = sakes.find(x => x.id === row.id);
            const halo = ssiQuadrantKey(sake.ssi);
            return (
              <div key={row.id} className="glass-panel p-4 flex items-center gap-3">
                <span className="text-2xl font-bold text-gold w-8">{idx + 1}</span>
                <img src={sake.bottleImage} className="w-10 h-16 object-contain" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm break-word">{row.name}</p>
                  <p className="text-[11px] text-muted">{row.topAroma} · {sake.ssiQuadrant}</p>
                </div>
                <div className="text-right">
                  <p className="text-gold font-bold text-lg">★ {row.avgRating}</p>
                  <p className="text-[10px] text-muted">{row.bottles} 瓶</p>
                </div>
              </div>
            );
          })}
      </div>

      <div className="mt-8 space-y-2">
        <button className="jelly-btn btn-gold w-full" onClick={onRestart}>
          🔄 重新開始（清除本機資料）
        </button>
        <p className="text-center text-[11px] text-muted">
          完成時間 · 感謝您今晚的參與
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   App 主控
   ================================================================ */
function App({ data }) {
  // 從 localStorage 還原
  const restored = loadState();
  const [phase, setPhase] = useState(restored?.phase || "intro");
  const [venue, setVenue] = useState(restored?.venue || null);
  const [sakeIdx, setSakeIdx] = useState(restored?.sakeIdx || 0);
  const [opened, setOpened] = useState(false); // 每款酒進入時重置
  const [evals, setEvals] = useState(restored?.evals || {});
  const [cart, setCart] = useState(restored?.cart || {});
  const [showEval, setShowEval] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);

  const sakes = data.sakes;
  const total = sakes.length;
  const currentSake = sakes[sakeIdx];

  // 持久化
  useEffect(() => {
    saveState({ phase, venue, sakeIdx, evals, cart });
  }, [phase, venue, sakeIdx, evals, cart]);

  // 每換一支酒，重設「開瓶 / 評鑑 / 討論」狀態
  useEffect(() => {
    setOpened(false);
    setShowEval(false);
    setShowDiscussion(false);
  }, [sakeIdx]);

  // intro 選店家
  function pickVenue(s) {
    setVenue(s);
    setPhase("stage");
    getAudio(); // 解鎖 audio context
  }

  // 評鑑完成
  function handleSaveEval(rec) {
    setEvals(prev => ({ ...prev, [rec.sakeId]: rec }));
    setShowEval(false);
    setShowDiscussion(true);
  }

  // 下一款酒
  function nextSake() {
    setSakeIdx(i => Math.min(i + 1, total - 1));
  }

  // 全部完成 → cart
  function gotoCart() {
    setPhase("cart");
  }

  // 提交採購單
  function submitCart(extra) {
    const payload = {
      venue,
      cart,
      evals,
      ...extra,
      submittedAt: new Date().toISOString(),
    };
    const endpoint = window.SAKE_ORDER_ENDPOINT;
    if (endpoint) {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(err => console.error("[sake order] post failed", err));
    } else {
      console.log("[sake order] (no endpoint set) payload =", payload);
    }
    playBell();
    setPhase("livewall");
  }

  function restart() {
    if (!confirm("確定要清除本機資料並重新開始？")) return;
    clearState();
    setPhase("intro");
    setVenue(null);
    setSakeIdx(0);
    setEvals({});
    setCart({});
  }

  // 頂部 venue 提示
  const venueBar = venue && phase !== "intro" && (
    <div className="fixed top-0 left-0 right-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-100 px-4 py-2 flex items-center justify-between">
      <span className="text-xs text-muted">🏯 {venue}</span>
      <span className="text-[11px] text-gold">{phase === "cart" ? "採購單" : phase === "livewall" ? "統計牆" : `${sakeIdx + 1}/${total}`}</span>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto" style={{ paddingTop: venue && phase !== "intro" ? 36 : 0 }}>
      {venueBar}

      {phase === "intro" && (
        <IntroScreen stores={data.stores} onPick={pickVenue} />
      )}

      {phase === "stage" && !showEval && !showDiscussion && (
        <StageScreen
          key={currentSake.id}
          sake={currentSake}
          index={sakeIdx}
          total={total}
          opened={opened}
          setOpened={setOpened}
          onStartEval={() => setShowEval(true)}
        />
      )}

      {phase === "stage" && showEval && (
        <EvaluationScreen
          key={`eval-${currentSake.id}`}
          sake={currentSake}
          initial={evals[currentSake.id]}
          onSave={handleSaveEval}
          onCancel={() => setShowEval(false)}
        />
      )}

      {phase === "stage" && showDiscussion && (
        <DiscussionScreen
          key={`disc-${currentSake.id}`}
          sake={currentSake}
          isLast={sakeIdx === total - 1}
          onNext={() => { nextSake(); }}
          onFinish={() => { gotoCart(); }}
        />
      )}

      {phase === "cart" && (
        <CartScreen
          sakes={sakes}
          evals={evals}
          cart={cart}
          setCart={setCart}
          onSubmit={submitCart}
          onBack={() => { setPhase("stage"); setSakeIdx(total - 1); setShowDiscussion(true); }}
        />
      )}

      {phase === "livewall" && (
        <LiveWallScreen sakes={sakes} onRestart={restart} />
      )}
    </div>
  );
}

/* ================================================================
   啟動
   ================================================================ */
fetch("./sake_data.json")
  .then(r => r.json())
  .then(data => {
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(<App data={data} />);
  })
  .catch(err => {
    document.getElementById("root").innerHTML =
      `<div class="p-6 text-center text-rose-600">資料載入失敗：${err.message}<br>請以 HTTP 伺服器開啟。</div>`;
  });
