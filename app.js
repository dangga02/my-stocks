/**
 * 내 주식 트리맵 PWA — 검색 자동완성 + KIS Proxy + 시장지표 + 외인/기관/개인
 */

const STORAGE_STOCKS = 'kr_stocks_v1';
const STORAGE_API_URL = 'kr_api_url_v1';
const STORAGE_PRICES_CACHE = 'kr_prices_cache_v1';
const STORAGE_TICKERS_CACHE = 'kr_tickers_cache_v1';
const STORAGE_SYNC_CODE = 'kr_sync_code_v1';

// 기본 API 주소 (저장된 값 없으면 이거 사용)
const DEFAULT_API_URL = 'https://kis-proxy.dangga2002.workers.dev';

const DEFAULT_STOCKS = [
  { ticker: '005930', name: '삼성전자' },
  { ticker: '000660', name: 'SK하이닉스' },
  { ticker: '035420', name: 'NAVER' },
  { ticker: '035720', name: '카카오' },
  { ticker: '005380', name: '현대차' },
  { ticker: '051910', name: 'LG화학' },
];

let stocks = [];
let prices = {};
let apiBaseUrl = '';
let deferredInstallPrompt = null;
let tickerData = [];
let searchAbortController = null;
let syncCode = '';
let syncTimer = null;       // 디바운스 타이머
let syncInProgress = false; // 중복 동기화 방지

// ===== 저장소 =====
function loadStocks() {
  try {
    const raw = localStorage.getItem(STORAGE_STOCKS);
    if (raw) { stocks = JSON.parse(raw); return; }
  } catch (e) {}
  stocks = [...DEFAULT_STOCKS];
  saveStocks();
}
function saveStocks() {
  try { localStorage.setItem(STORAGE_STOCKS, JSON.stringify(stocks)); } catch (e) {}
  scheduleSync(); // 변경 시마다 1초 후 동기화
}

// ===== 동기화 코드 관리 =====
function loadSyncCode() {
  try {
    const saved = localStorage.getItem(STORAGE_SYNC_CODE);
    if (saved && /^[A-Z0-9]{6}$/.test(saved)) {
      syncCode = saved;
      return;
    }
  } catch (e) {}
  // 처음 사용 시 자동 생성
  syncCode = generateSyncCode();
  try { localStorage.setItem(STORAGE_SYNC_CODE, syncCode); } catch (e) {}
}

function setSyncCode(code) {
  if (!/^[A-Z0-9]{6}$/.test(code)) return false;
  syncCode = code;
  try { localStorage.setItem(STORAGE_SYNC_CODE, code); } catch (e) {}
  return true;
}

function generateSyncCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0,O,1,I 제외
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 디바운스: 마지막 변경 후 1초 뒤 동기화 (연속 변경 시 한 번만 호출)
function scheduleSync() {
  if (!apiBaseUrl || !syncCode) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => uploadSync(), 1000);
}

async function uploadSync() {
  if (!apiBaseUrl || !syncCode || syncInProgress) return;
  syncInProgress = true;
  try {
    const res = await fetch(`${apiBaseUrl}/sync?code=${syncCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stocks }),
    });
    if (!res.ok) console.warn('동기화 업로드 실패:', res.status);
  } catch (e) {
    console.warn('동기화 업로드 에러:', e.message);
  } finally {
    syncInProgress = false;
  }
}

async function downloadSync() {
  if (!apiBaseUrl || !syncCode) return false;
  try {
    const res = await fetch(`${apiBaseUrl}/sync?code=${syncCode}`);
    if (!res.ok) return false;
    const data = await res.json();
    if (data.stocks && Array.isArray(data.stocks) && data.stocks.length > 0) {
      stocks = data.stocks;
      try { localStorage.setItem(STORAGE_STOCKS, JSON.stringify(stocks)); } catch (e) {}
      return true;
    }
  } catch (e) {
    console.warn('동기화 다운로드 에러:', e.message);
  }
  return false;
}
function loadApiUrl() {
  try {
    const saved = localStorage.getItem(STORAGE_API_URL);
    apiBaseUrl = saved || DEFAULT_API_URL;
  } catch (e) {
    apiBaseUrl = DEFAULT_API_URL;
  }
}
function saveApiUrl(url) { try { localStorage.setItem(STORAGE_API_URL, url); } catch (e) {} apiBaseUrl = url; }
function loadCachedPrices() {
  try { const raw = localStorage.getItem(STORAGE_PRICES_CACHE); if (raw) prices = JSON.parse(raw); } catch (e) {}
}
function saveCachedPrices() { try { localStorage.setItem(STORAGE_PRICES_CACHE, JSON.stringify(prices)); } catch (e) {} }
function loadCachedTickers() {
  try { const raw = localStorage.getItem(STORAGE_TICKERS_CACHE); if (raw) tickerData = JSON.parse(raw); } catch (e) {}
}
function saveCachedTickers() { try { localStorage.setItem(STORAGE_TICKERS_CACHE, JSON.stringify(tickerData)); } catch (e) {} }

// ===== API =====
async function fetchPrice(ticker) {
  if (!apiBaseUrl) throw new Error('API 주소가 설정되지 않았습니다');
  const res = await fetch(`${apiBaseUrl}/price?ticker=${ticker}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return await res.json();
}
async function fetchChart(ticker, period = 'D') {
  if (!apiBaseUrl) throw new Error('API 주소가 설정되지 않았습니다');
  const res = await fetch(`${apiBaseUrl}/chart?ticker=${ticker}&period=${period}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return await res.json();
}
async function fetchInvestor(ticker) {
  if (!apiBaseUrl) throw new Error('API 주소가 설정되지 않았습니다');
  const res = await fetch(`${apiBaseUrl}/investor?ticker=${ticker}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return await res.json();
}
async function fetchTickers() {
  if (!apiBaseUrl) return null;
  const res = await fetch(`${apiBaseUrl}/tickers`);
  if (!res.ok) return null;
  return await res.json();
}

// 실시간 검색 — 백엔드 → 네이버 금융 자동완성
async function searchStocksRemote(query, signal) {
  if (!apiBaseUrl) return [];
  const res = await fetch(`${apiBaseUrl}/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return data.stocks || [];
}

async function fetchAllPrices() {
  const status = document.getElementById('status');
  if (stocks.length === 0) { setStatus(''); return; }
  if (!apiBaseUrl) {
    setStatus('API 주소를 먼저 설정해주세요', true);
    document.getElementById('settings-row').classList.add('show');
    return;
  }
  setStatus(`시세 가져오는 중… (0/${stocks.length})`);
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.classList.add('spinning');

  let done = 0, fails = 0;
  for (const s of stocks) {
    try {
      const p = await fetchPrice(s.ticker);
      prices[s.ticker] = p;
    } catch (e) { fails++; }
    done++;
    setStatus(`시세 가져오는 중… (${done}/${stocks.length})`);
    renderTreemap();
  }

  saveCachedPrices();
  refreshBtn.classList.remove('spinning');

  const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  if (fails > 0) setStatus(`${stocks.length - fails}/${stocks.length}개 로드 · ${now}`);
  else setStatus(`${stocks.length}개 종목 · ${now} 업데이트`);
}

async function refreshTickers() {
  if (!apiBaseUrl) return;
  try {
    const data = await fetchTickers();
    if (data && data.tickers && data.tickers.length > 0) {
      tickerData = data.tickers;
      saveCachedTickers();
      renderTickerBar();
    }
  } catch (e) {}
}

function setStatus(text, isError = false) {
  const status = document.getElementById('status');
  status.innerHTML = `
    <span style="${isError ? 'color:var(--up)' : ''}">${text}</span>
    <button class="settings-link" id="settings-link">설정</button>
  `;
  document.getElementById('settings-link').onclick = () => {
    const settingsRow = document.getElementById('settings-row');
    const syncRow = document.getElementById('sync-row');
    const willShow = !settingsRow.classList.contains('show');
    settingsRow.classList.toggle('show', willShow);
    syncRow.classList.toggle('show', willShow);
    document.getElementById('api-url-input').value = apiBaseUrl;
    updateSyncCodeDisplay();
  };
}

function updateSyncCodeDisplay() {
  const el = document.getElementById('sync-code-display');
  if (el) el.textContent = syncCode || '------';
}

function colorForChange(pct) {
  if (pct == null || isNaN(pct)) return { bg: '#3a3a3a', text: '#cccccc' };
  if (pct > 3) return { bg: '#7c1e1e', text: '#ffe5e5' };
  if (pct > 1) return { bg: '#a32d2d', text: '#ffeaea' };
  if (pct > 0.1) return { bg: '#c44545', text: '#ffffff' };
  if (pct >= -0.1) return { bg: '#5f5e5a', text: '#ffffff' };
  if (pct > -1) return { bg: '#2d5a8c', text: '#ffffff' };
  if (pct > -3) return { bg: '#1e4778', text: '#e5efff' };
  return { bg: '#0f3158', text: '#cce0ff' };
}

function renderTreemap() {
  const container = document.getElementById('treemap');
  container.innerHTML = '';
  if (stocks.length === 0) {
    container.innerHTML = `<div class="empty">아직 종목이 없어요.<br>위에서 종목명을 검색해서 추가해보세요.</div>`;
    return;
  }
  stocks.forEach(s => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const p = prices[s.ticker];
    const colors = p ? colorForChange(p.changePct) : { bg: '#3a3a3a', text: '#888' };
    cell.style.background = colors.bg;
    cell.style.color = colors.text;

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.textContent = '×';
    remove.onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`${s.name}을(를) 삭제할까요?`)) return;
      stocks = stocks.filter(x => x.ticker !== s.ticker);
      saveStocks();
      delete prices[s.ticker];
      saveCachedPrices();
      renderTreemap();
    };

    const name = document.createElement('div');
    name.className = 'cell-name';
    name.textContent = s.name;

    const pct = document.createElement('div');
    pct.className = 'cell-pct';
    if (p) {
      const sign = p.changePct >= 0 ? '+' : '';
      pct.textContent = `${sign}${p.changePct.toFixed(2)}%`;
    } else pct.textContent = '—';

    const price = document.createElement('div');
    price.className = 'cell-price';
    if (p) price.textContent = `${p.price.toLocaleString('ko-KR')}원`;

    cell.appendChild(remove);
    cell.appendChild(name);
    cell.appendChild(pct);
    if (p) cell.appendChild(price);
    cell.onclick = () => showDetail(s);
    container.appendChild(cell);
  });
}

// ===== 검색 결과 렌더링 =====
function highlightMatch(text, query) {
  if (!query) return text;
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

async function renderSearchResults(query) {
  const container = document.getElementById('search-results');
  const q = query.trim();
  if (!q) {
    container.classList.remove('show');
    container.innerHTML = '';
    return;
  }

  // 로딩 표시
  container.classList.add('show');
  container.innerHTML = `<div class="search-empty">검색 중…</div>`;

  // 이전 검색 취소
  if (searchAbortController) searchAbortController.abort();
  searchAbortController = new AbortController();

  let results = [];
  try {
    results = await searchStocksRemote(q, searchAbortController.signal);
  } catch (e) {
    if (e.name === 'AbortError') return; // 새 검색이 들어와서 취소됨
    container.innerHTML = `<div class="search-empty">검색 실패: ${e.message}</div>`;
    return;
  }

  if (results.length === 0) {
    container.innerHTML = `<div class="search-empty">'${q}'에 해당하는 종목이 없어요</div>`;
    return;
  }

  container.innerHTML = results.slice(0, 8).map(s => {
    const alreadyAdded = stocks.some(x => x.ticker === s.ticker);
    const tagClass = s.market === 'KOSDAQ' ? 'kosdaq' : 'kospi';
    const tagLabel = s.market === 'KOSDAQ' ? 'KOSDAQ' : 'KOSPI';
    return `
      <div class="search-result-item" data-ticker="${s.ticker}" data-name="${s.name}" data-added="${alreadyAdded}">
        <span class="sr-tag ${tagClass}">${tagLabel}</span>
        <span class="sr-name">${highlightMatch(s.name, q)}${alreadyAdded ? ' ✓' : ''}</span>
        <span class="sr-code">${s.ticker}</span>
      </div>
    `;
  }).join('');
  container.querySelectorAll('.search-result-item').forEach(el => {
    el.onclick = () => addStockFromSearch(el.dataset.ticker, el.dataset.name, el.dataset.added === 'true');
  });
}

async function addStockFromSearch(ticker, name, alreadyAdded) {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  if (alreadyAdded) {
    setStatus(`${name}은(는) 이미 추가되어 있어요`);
    input.value = '';
    results.classList.remove('show');
    input.blur();
    return;
  }

  stocks.push({ ticker, name });
  saveStocks();
  input.value = '';
  results.classList.remove('show');
  input.blur();
  renderTreemap();
  setStatus(`${name} 시세 가져오는 중…`);
  try {
    const p = await fetchPrice(ticker);
    prices[ticker] = p;
    saveCachedPrices();
    renderTreemap();
    setStatus(`${name} 추가 완료`);
  } catch (e) {
    setStatus(`${name} 추가됨 (시세 조회 실패: ${e.message})`, true);
  }
}

// ===== 하단 시장 지표 띠 =====
function formatTickerPrice(item) {
  const v = item.price;
  if (item.type === 'index') return v.toFixed(2);
  if (item.type === 'crypto') {
    if (v >= 10000) return Math.round(v).toLocaleString('en-US');
    return v.toFixed(0);
  }
  if (item.type === 'yahoo') {
    if (item.key && item.key.includes('=X')) return v.toFixed(2);
    return v.toFixed(2);
  }
  return v.toFixed(2);
}
function iconClassForType(item) {
  if (item.type === 'index') return 'idx';
  if (item.type === 'crypto') return 'crypto';
  if (item.key && item.key.includes('=X')) return 'fx';
  if (item.key && (item.key === 'CL=F' || item.key === 'GC=F')) return 'cmd';
  return 'fut';
}
function iconLetterFor(item) {
  if (item.type === 'index') return 'KR';
  if (item.type === 'crypto') return '₿';
  if (item.key && item.key.includes('=X')) return '환';
  if (item.key === 'CL=F') return 'CL';
  if (item.key === 'GC=F') return 'AU';
  if (item.key === 'NQ=F') return 'NQ';
  if (item.key === 'ES=F') return 'ES';
  return '·';
}
function renderTickerBar() {
  const track = document.getElementById('ticker-track');
  if (!tickerData || tickerData.length === 0) {
    track.innerHTML = '<div class="ticker-loading">시장 지표 불러오는 중…</div>';
    return;
  }
  const itemsHtml = tickerData.map(t => {
    const sign = t.changePct >= 0 ? '+' : '';
    const direction = t.changePct > 0.01 ? 'up' : (t.changePct < -0.01 ? 'down' : 'neutral');
    const arrow = t.changePct > 0.01 ? '▲' : (t.changePct < -0.01 ? '▼' : '·');
    return `
      <div class="ticker-item">
        <span class="t-icon ${iconClassForType(t)}">${iconLetterFor(t)}</span>
        <span class="t-label">${t.label}</span>
        <span class="t-price">${formatTickerPrice(t)}</span>
        <span class="t-change ${direction}">${arrow} ${sign}${t.changePct.toFixed(2)}%</span>
      </div>
    `;
  }).join('');
  track.innerHTML = itemsHtml + itemsHtml;
}

// ===== 상세 모달 =====
function formatDateMD(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  return `${yyyymmdd.slice(4,6)}.${yyyymmdd.slice(6,8)}`;
}

function formatQty(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '−';
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(2)}억`;
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}만`;
  return `${sign}${abs.toLocaleString('ko-KR')}`;
}
function formatAmount(n) {
  if (n == null || isNaN(n) || n === 0) return '';
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '−';
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(0)}억원`;
  if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(1)}천만`;
  return `${sign}${(abs / 10000).toFixed(0)}만원`;
}
function netClass(n) {
  if (n > 0) return 'up';
  if (n < 0) return 'down';
  return 'neutral';
}

function renderInvestorSection(days) {
  if (!days || days.length === 0) {
    return `<div class="loading-mini">매매 동향 데이터 없음</div>`;
  }
  const today = days[0];
  const summaryHtml = `
    <div class="investor-summary">
      <div class="investor-card">
        <div class="inv-label">외국인</div>
        <div class="inv-net ${netClass(today.foreignNet)}">${formatQty(today.foreignNet)}</div>
        <div class="inv-amount">${formatAmount(today.foreignNetAmount)}</div>
      </div>
      <div class="investor-card">
        <div class="inv-label">기관</div>
        <div class="inv-net ${netClass(today.institutionNet)}">${formatQty(today.institutionNet)}</div>
        <div class="inv-amount">${formatAmount(today.institutionNetAmount)}</div>
      </div>
      <div class="investor-card">
        <div class="inv-label">개인</div>
        <div class="inv-net ${netClass(today.personNet)}">${formatQty(today.personNet)}</div>
        <div class="inv-amount">${formatAmount(today.personNetAmount)}</div>
      </div>
    </div>
  `;
  const recent = days.slice(0, 7);
  const tableRows = recent.map(d => `
    <div class="row">
      <div class="col date">${formatDateMD(d.date)}</div>
      <div class="col ${netClass(d.foreignNet)}">${formatQty(d.foreignNet)}</div>
      <div class="col ${netClass(d.institutionNet)}">${formatQty(d.institutionNet)}</div>
      <div class="col ${netClass(d.personNet)}">${formatQty(d.personNet)}</div>
    </div>
  `).join('');
  return summaryHtml + `
    <div class="investor-table">
      <div class="row head">
        <div class="col date">날짜</div>
        <div class="col">외국인</div>
        <div class="col">기관</div>
        <div class="col">개인</div>
      </div>
      ${tableRows}
    </div>
  `;
}

async function showDetail(stock) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  const p = prices[stock.ticker];

  if (!p) {
    modal.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div><p class="modal-name">${stock.name}</p><p class="modal-ticker">${stock.ticker}</p></div>
      </div>
      <div class="error-box">시세 데이터를 가져오지 못했습니다. 종목코드를 확인하거나 새로고침을 눌러주세요.</div>
    `;
    overlay.classList.add('show');
    return;
  }

  const sign = p.changePct >= 0 ? '+' : '';
  const direction = p.changePct >= 0 ? 'up' : (p.changePct < 0 ? 'down' : 'neutral');
  const naverUrl = `https://m.stock.naver.com/domestic/stock/${stock.ticker}/total`;
  const newsUrl = `https://m.stock.naver.com/domestic/stock/${stock.ticker}/news`;
  const googleNewsUrl = `https://www.google.com/search?q=${encodeURIComponent(stock.name + ' 주식')}&tbm=nws`;
  const dartUrl = `https://dart.fss.or.kr/dsab007/main.do?textCrpNm=${encodeURIComponent(stock.name)}`;

  modal.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-header">
      <div>
        <p class="modal-name">${stock.name}</p>
        <p class="modal-ticker">${stock.ticker}</p>
      </div>
      <div>
        <div class="modal-price">${p.price.toLocaleString('ko-KR')}원</div>
        <div class="modal-change ${direction}">${sign}${Math.round(p.change).toLocaleString('ko-KR')} (${sign}${p.changePct.toFixed(2)}%)</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-item"><div class="stat-label">시가</div><div class="stat-value">${p.open ? p.open.toLocaleString('ko-KR') : '—'}</div></div>
      <div class="stat-item"><div class="stat-label">고가</div><div class="stat-value">${p.high ? p.high.toLocaleString('ko-KR') : '—'}</div></div>
      <div class="stat-item"><div class="stat-label">저가</div><div class="stat-value">${p.low ? p.low.toLocaleString('ko-KR') : '—'}</div></div>
      <div class="stat-item"><div class="stat-label">거래량</div><div class="stat-value">${p.volume ? p.volume.toLocaleString('ko-KR') : '—'}</div></div>
      <div class="stat-item"><div class="stat-label">52주 최고</div><div class="stat-value">${p.high52 ? p.high52.toLocaleString('ko-KR') : '—'}</div></div>
      <div class="stat-item"><div class="stat-label">52주 최저</div><div class="stat-value">${p.low52 ? p.low52.toLocaleString('ko-KR') : '—'}</div></div>
      <div class="stat-item"><div class="stat-label">PER</div><div class="stat-value">${p.per || '—'}</div></div>
      <div class="stat-item"><div class="stat-label">PBR</div><div class="stat-value">${p.pbr || '—'}</div></div>
    </div>

    <div class="tv-chart-wrap">
      <div id="tradingview-chart"></div>
    </div>

    <div class="section-title">
      <span>외인 / 기관 / 개인</span>
      <span class="sub">단위: 주 (순매수)</span>
    </div>
    <div id="investor-container">
      <div class="loading-mini">매매 동향 불러오는 중…</div>
    </div>

    <div class="link-grid">
      <a href="${naverUrl}" target="_blank" rel="noopener">네이버 종목 →</a>
      <a href="${newsUrl}" target="_blank" rel="noopener">네이버 뉴스 →</a>
      <a href="${googleNewsUrl}" target="_blank" rel="noopener">구글 뉴스 →</a>
      <a href="${dartUrl}" target="_blank" rel="noopener">DART 공시 →</a>
    </div>
  `;
  overlay.classList.add('show');

  loadTradingViewChart(stock.ticker);
  loadInvestorFor(stock.ticker);
}

// ===== TradingView 위젯 로드 =====
async function loadTradingViewChart(ticker) {
  const container = document.getElementById('tradingview-chart');
  if (!container) return;

  if (!ticker || !/^\d{6}$/.test(String(ticker).trim())) {
    container.innerHTML = `<div class="error-box">잘못된 종목코드: ${ticker}</div>`;
    return;
  }

  // 탭 정의
  const TABS = [
    { key: 'minute', label: '일봉',  type: 'candle' },
    { key: 'W',      label: '주봉',  type: 'candle' },
    { key: 'M',      label: '월봉',  type: 'line'   },
    { key: '5Y',     label: '5년',   type: 'line'   },
    { key: '10Y',    label: '10년',  type: 'line'   },
  ];

  const tabsHtml = TABS.map((t, i) =>
    `<button class="chart-tab${i===0?' active':''}" data-period="${t.key}" data-type="${t.type}">${t.label}</button>`
  ).join('');

  container.innerHTML = `
    <div class="chart-tabs">${tabsHtml}</div>
    <div id="chart-body" style="position:relative; min-height:60px;"></div>
  `;

  let minuteRefreshTimer = null; // 일봉 자동갱신 타이머

  async function drawChart(period, type) {
    const body = container.querySelector('#chart-body');
    body.innerHTML = `<div class="loading-mini">차트 불러오는 중…</div>`;

    // 탭 전환 시 이전 자동갱신 중단
    if (minuteRefreshTimer) {
      clearInterval(minuteRefreshTimer);
      minuteRefreshTimer = null;
    }

    try {
      const data = await fetchChart(ticker, period);
      let candles = data.candles || [];

      // 일봉(분봉): 장 마감 후 데이터 없으면 최근 30일 일봉으로 대체
      if (period === 'minute' && candles.length === 0) {
        const fallback = await fetchChart(ticker, 'D');
        const dayCandles = (fallback.candles || []).slice(-30);
        body.innerHTML = `<div style="font-size:10px;color:var(--text-3);padding:0 8px 4px;">장 마감 후 — 최근 30일 종가</div>`;
        const subContainer = document.createElement('div');
        body.appendChild(subContainer);
        renderLineChart(subContainer, dayCandles, 'D');
        return;
      }

      if (type === 'line') renderLineChart(body, candles, period);
      else renderCandleChart(body, candles, period);

      // 일봉 탭: 장 시간(09:00~15:30)이면 30초마다 자동갱신
      if (period === 'minute' && isMarketOpen()) {
        minuteRefreshTimer = setInterval(async () => {
          if (!document.getElementById('tradingview-chart')) {
            clearInterval(minuteRefreshTimer);
            return;
          }
          // 모달이 닫혔으면 중단
          if (!document.getElementById('modal-overlay')?.classList.contains('show')) {
            clearInterval(minuteRefreshTimer);
            return;
          }
          try {
            const fresh = await fetchChart(ticker, 'minute');
            const freshCandles = fresh.candles || [];
            if (freshCandles.length > 0) {
              renderCandleChart(body, freshCandles, 'minute');
              // 타이머 label 업데이트
              const lbl = container.querySelector('#minute-refresh-lbl');
              if (lbl) lbl.textContent = `🔴 실시간 · ${new Date().toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}`;
            }
          } catch (e) { /* 갱신 실패 무시 */ }
        }, 30000);

        // 실시간 표시 레이블
        const lbl = document.createElement('div');
        lbl.id = 'minute-refresh-lbl';
        lbl.style.cssText = 'font-size:10px;color:var(--text-3);padding:2px 8px;';
        lbl.textContent = `🔴 실시간 · ${new Date().toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}`;
        body.appendChild(lbl);
      }

    } catch (e) {
      body.innerHTML = `<div class="error-box">차트 로드 실패: ${e.message}</div>`;
    }
  }

  // 장 시간 체크 (09:00~15:30 평일)
  function isMarketOpen() {
    const now  = new Date();
    const day  = now.getDay();
    if (day === 0 || day === 6) return false;
    const t = now.getHours() * 60 + now.getMinutes();
    return t >= 9 * 60 && t < 15 * 60 + 30;
  }

  container.querySelectorAll('.chart-tab').forEach(tab => {
    tab.onclick = () => {
      container.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      drawChart(tab.dataset.period, tab.dataset.type);
    };
  });

  drawChart('minute', 'candle');
}

// ===== 캔들스틱 차트 (일봉/주봉) =====
function renderCandleChart(container, candles, period) {
  if (!candles || candles.length < 2) {
    container.innerHTML = `<div class="loading-mini">차트 데이터 없음</div>`;
    return;
  }

  const isLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const W = 800, H = 240;
  const padL = 10, padR = 65, padT = 16, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const data = candles;
  const n = data.length;

  const highs  = data.map(c => c.high  || c.close);
  const lows   = data.map(c => c.low   || c.close);
  const maxP   = Math.max(...highs);
  const minP   = Math.min(...lows);
  const range  = maxP - minP || 1;

  const candleW = Math.max(2, Math.floor(chartW / n) - 1);
  const step    = chartW / n;

  function py(price) { return padT + chartH - ((price - minP) / range) * chartH; }
  function cx(i)     { return padL + i * step + step / 2; }

  // 이동평균
  function ma(arr, p) {
    return arr.map((_, i) => {
      if (i < p - 1) return null;
      return arr.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p;
    });
  }
  const closes = data.map(c => c.close);
  const ma5    = ma(closes, 5);
  const ma20   = ma(closes, 20);

  function maPath(maArr, color) {
    let d = '';
    maArr.forEach((v, i) => {
      if (v === null) return;
      d += (d === '' || maArr[i-1] === null ? 'M' : 'L') +
           `${cx(i).toFixed(1)},${py(v).toFixed(1)}`;
    });
    return d ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.9"/>` : '';
  }

  // 그리드 + 가격 레이블
  const gridCount = 4;
  const grids = Array.from({length: gridCount}, (_, k) => {
    const ratio = (k + 1) / (gridCount + 1);
    const price  = minP + range * (1 - ratio);
    const y      = padT + chartH * ratio;
    const lbl    = price >= 1000
      ? Math.round(price / 100) * 100
      : price.toFixed(0);
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}"
            stroke="${isLight?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'}" stroke-width="0.5"/>
      <text x="${W-padR+4}" y="${(y+3.5).toFixed(1)}" font-size="9"
            fill="${isLight?'#999':'#666'}">${Number(lbl).toLocaleString('ko-KR')}</text>`;
  }).join('');

  // 캔들
  const candleSvg = data.map((c, i) => {
    const up    = c.close >= c.open;
    const color = up ? (isLight?'#d4424a':'#ef5350') : (isLight?'#2d6fc9':'#5599ff');
    const hi    = c.high  || Math.max(c.open, c.close);
    const lo    = c.low   || Math.min(c.open, c.close);
    const bTop  = py(Math.max(c.open, c.close));
    const bBot  = py(Math.min(c.open, c.close));
    const bH    = Math.max(1, bBot - bTop);
    const x     = padL + i * step + (step - candleW) / 2;
    return `
      <line x1="${cx(i).toFixed(1)}" y1="${py(hi).toFixed(1)}"
            x2="${cx(i).toFixed(1)}" y2="${py(lo).toFixed(1)}"
            stroke="${color}" stroke-width="1"/>
      <rect x="${x.toFixed(1)}" y="${bTop.toFixed(1)}"
            width="${candleW}" height="${bH.toFixed(1)}" fill="${color}"/>`;
  }).join('');

  // 날짜/시간 레이블
  function fmtLabel(c) {
    if (c.time) {
      // 분봉: HHMMSS → HH:MM
      const t = String(c.time).padStart(6,'0');
      return `${t.slice(0,2)}:${t.slice(2,4)}`;
    }
    if (c.date && c.date.length === 8) return `${c.date.slice(4,6)}.${c.date.slice(6,8)}`;
    return '';
  }
  // 5~7개 레이블만 균등 배치
  const labelCount = Math.min(6, n);
  const labelIdxs  = Array.from({length: labelCount}, (_, k) => Math.round(k * (n-1) / (labelCount-1)));
  const dateLabels  = labelIdxs.map(i => `
    <text x="${cx(i).toFixed(1)}" y="${H-4}" text-anchor="middle" font-size="9"
          fill="${isLight?'#aaa':'#666'}">${fmtLabel(data[i])}</text>`).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:240px;display:block;overflow:visible;"
         id="chart-svg" xmlns="http://www.w3.org/2000/svg">
      ${grids}${candleSvg}
      ${maPath(ma5,  isLight?'#e07b00':'#f0a020')}
      ${maPath(ma20, isLight?'#1a7a3c':'#4caf80')}
      ${dateLabels}
      <line id="cv-vline" x1="0" y1="${padT}" x2="0" y2="${padT+chartH}"
            stroke="rgba(150,150,150,0.45)" stroke-width="1" stroke-dasharray="3,3" display="none"/>
      <circle id="cv-dot" cx="0" cy="0" r="3.5"
              fill="${isLight?'#d4424a':'#ef5350'}"
              stroke="${isLight?'#fff':'#111'}" stroke-width="1.5" display="none"/>
      <rect id="cv-bg" x="0" y="0" width="1" height="1" rx="3"
            fill="${isLight?'#fff':'#1e1e1e'}" stroke="${isLight?'#ccc':'#555'}" display="none"/>
      <text id="cv-txt" x="0" y="0" font-size="10"
            fill="${isLight?'#333':'#eee'}" display="none"></text>
    </svg>
    <div style="display:flex;gap:12px;padding:4px 8px;font-size:10px;">
      <span style="color:${isLight?'#e07b00':'#f0a020'}">── MA5</span>
      <span style="color:${isLight?'#1a7a3c':'#4caf80'}">── MA20</span>
    </div>
  `;

  setupChartHover(container, data, W, padL, padR, padT, padB, step, py, cx, fmtLabel);
}

// ===== 선 그래프 (월봉/5년/10년) =====
function renderLineChart(container, candles, period) {
  if (!candles || candles.length < 2) {
    container.innerHTML = `<div class="loading-mini">차트 데이터 없음</div>`;
    return;
  }

  const isLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const W = 800, H = 200;
  const padL = 10, padR = 65, padT = 16, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const data   = candles;
  const n      = data.length;
  const closes = data.map(c => c.close);
  const maxP   = Math.max(...closes);
  const minP   = Math.min(...closes);
  const range  = maxP - minP || 1;
  const first  = closes[0];
  const last   = closes[n-1];
  const up     = last >= first;

  const stroke = up ? (isLight?'#d4424a':'#ef5350') : (isLight?'#2d6fc9':'#5599ff');
  const fill   = up ? (isLight?'rgba(212,66,74,0.10)':'rgba(239,83,80,0.15)')
                    : (isLight?'rgba(45,111,201,0.10)':'rgba(85,153,255,0.15)');

  function py(price) { return padT + chartH - ((price - minP) / range) * chartH; }
  function cx(i)     { return padL + (i / (n-1)) * chartW; }

  const pts  = data.map((c, i) => `${cx(i).toFixed(1)},${py(c.close).toFixed(1)}`).join(' ');
  const area = `${padL},${padT+chartH} ${pts} ${padL+chartW},${padT+chartH}`;

  // 그리드
  const grids = [0.25, 0.5, 0.75].map(ratio => {
    const price = minP + range * (1 - ratio);
    const y     = padT + chartH * ratio;
    const lbl   = price >= 1000 ? Math.round(price/100)*100 : price.toFixed(0);
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}"
            stroke="${isLight?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'}" stroke-width="0.5"/>
      <text x="${W-padR+4}" y="${(y+3.5).toFixed(1)}" font-size="9"
            fill="${isLight?'#999':'#666'}">${Number(lbl).toLocaleString('ko-KR')}</text>`;
  }).join('');

  // 날짜 레이블
  function fmtDate(yyyymmdd) {
    if (!yyyymmdd || yyyymmdd.length < 6) return '';
    if (yyyymmdd.length === 8) return `${yyyymmdd.slice(0,4)}.${yyyymmdd.slice(4,6)}`;
    return yyyymmdd;
  }
  const labelCount = Math.min(5, n);
  const dateLabels = Array.from({length:labelCount}, (_,k) => {
    const i = Math.round(k * (n-1) / (labelCount-1));
    return `<text x="${cx(i).toFixed(1)}" y="${H-4}" text-anchor="middle" font-size="9"
                  fill="${isLight?'#aaa':'#666'}">${fmtDate(data[i].date)}</text>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:200px;display:block;overflow:visible;"
         id="chart-svg" xmlns="http://www.w3.org/2000/svg">
      ${grids}
      <polygon points="${area}" fill="${fill}"/>
      <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.5"/>
      ${dateLabels}
      <line id="cv-vline" x1="0" y1="${padT}" x2="0" y2="${padT+chartH}"
            stroke="rgba(150,150,150,0.45)" stroke-width="1" stroke-dasharray="3,3" display="none"/>
      <circle id="cv-dot" cx="0" cy="0" r="3.5"
              fill="${stroke}" stroke="${isLight?'#fff':'#111'}" stroke-width="1.5" display="none"/>
      <rect id="cv-bg" x="0" y="0" width="1" height="1" rx="3"
            fill="${isLight?'#fff':'#1e1e1e'}" stroke="${isLight?'#ccc':'#555'}" display="none"/>
      <text id="cv-txt" x="0" y="0" font-size="10"
            fill="${isLight?'#333':'#eee'}" display="none"></text>
    </svg>
  `;

  const step = chartW / (n - 1);
  setupChartHover(container, data, W, padL, padR, padT, padB, step, py, cx,
    c => fmtDate(c.date));
}

// ===== 공통 호버 이벤트 =====
function setupChartHover(container, data, W, padL, padR, padT, padB, step, py, cx, fmtLabel) {
  const svg     = container.querySelector('#chart-svg');
  const cvVline = container.querySelector('#cv-vline');
  const cvDot   = container.querySelector('#cv-dot');
  const cvBg    = container.querySelector('#cv-bg');
  const cvTxt   = container.querySelector('#cv-txt');
  if (!svg || !cvVline) return;

  const n = data.length;
  const chartH = svg.viewBox.baseVal.height - padT - padB;

  function show(clientX) {
    const rect   = svg.getBoundingClientRect();
    const ratio  = (clientX - rect.left) / rect.width;
    const svgX   = ratio * W;
    const i      = Math.max(0, Math.min(n-1, Math.round((svgX - padL) / step)));
    const c      = data[i];
    if (!c) return;

    const dotX = cx(i);
    const dotY = py(c.close);

    cvVline.setAttribute('x1', dotX); cvVline.setAttribute('x2', dotX);
    cvDot.setAttribute('cx', dotX);   cvDot.setAttribute('cy', dotY);
    cvVline.removeAttribute('display');
    cvDot.removeAttribute('display');

    const label = `${fmtLabel(c)}  ${c.close.toLocaleString('ko-KR')}원`;
    cvTxt.textContent = label;
    const tipW = label.length * 6 + 14, tipH = 18;
    let tipX = dotX + 6;
    if (tipX + tipW > W - padR) tipX = dotX - tipW - 6;
    const tipY = padT + 4;
    cvBg.setAttribute('x', tipX); cvBg.setAttribute('y', tipY);
    cvBg.setAttribute('width', tipW); cvBg.setAttribute('height', tipH);
    cvTxt.setAttribute('x', tipX + 6); cvTxt.setAttribute('y', tipY + 12);
    cvBg.removeAttribute('display'); cvTxt.removeAttribute('display');
  }

  function hide() {
    [cvVline, cvDot, cvBg, cvTxt].forEach(el => el.setAttribute('display','none'));
  }

  svg.addEventListener('mousemove', e => show(e.clientX));
  svg.addEventListener('mouseleave', hide);
  svg.addEventListener('touchstart', e => { e.preventDefault(); show(e.touches[0].clientX); }, {passive:false});
  svg.addEventListener('touchmove',  e => { e.preventDefault(); show(e.touches[0].clientX); }, {passive:false});
  svg.addEventListener('touchend', () => setTimeout(hide, 1500));
}



async function loadInvestorFor(ticker) {
  const container = document.getElementById('investor-container');
  if (!container) return;
  container.innerHTML = `<div class="loading-mini">매매 동향 불러오는 중…</div>`;
  try {
    const data = await fetchInvestor(ticker);
    container.innerHTML = renderInvestorSection(data.days || []);
  } catch (e) {
    container.innerHTML = `<div class="error-box">매매 동향 로드 실패: ${e.message}</div>`;
  }
}

// ===== 이벤트 =====
function setupEvents() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  // 디바운스: 250ms 후 검색 (네트워크 호출이라 좀 길게)
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const v = e.target.value;
    if (!v.trim()) {
      document.getElementById('search-results').classList.remove('show');
      return;
    }
    searchTimer = setTimeout(() => renderSearchResults(v), 250);
  });
  searchInput.addEventListener('focus', (e) => {
    if (e.target.value) renderSearchResults(e.target.value);
  });
  // 외부 클릭 시 결과 닫기
  document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.search-wrap');
    if (wrap && !wrap.contains(e.target)) {
      searchResults.classList.remove('show');
    }
  });
  // 엔터로 첫 결과 선택
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = searchResults.querySelector('.search-result-item');
      if (first) first.click();
    } else if (e.key === 'Escape') {
      searchResults.classList.remove('show');
      searchInput.blur();
    }
  });

  document.getElementById('refresh-btn').onclick = () => {
    fetchAllPrices();
    refreshTickers();
  };

  document.getElementById('save-api-btn').onclick = () => {
    const url = document.getElementById('api-url-input').value.trim().replace(/\/$/, '');
    if (!url.startsWith('https://')) { setStatus('https://로 시작하는 주소를 입력해주세요', true); return; }
    saveApiUrl(url);
    document.getElementById('settings-row').classList.remove('show');
    setStatus('API 주소 저장됨');
    fetchAllPrices();
    refreshTickers();
  };

  document.getElementById('sync-change-btn').onclick = async () => {
    const code = prompt(
      '다른 기기와 종목을 동기화하려면 그 기기의 동기화 코드를 입력하세요.\n\n' +
      '현재 코드: ' + syncCode + '\n' +
      '(현재 코드를 다른 기기에 입력해도 됩니다)\n\n' +
      '6자리 코드 입력:'
    );
    if (!code) return;
    const upperCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(upperCode)) {
      alert('잘못된 형식입니다. 영문 대문자/숫자 6자리여야 합니다.');
      return;
    }
    if (!setSyncCode(upperCode)) return;
    updateSyncCodeDisplay();
    setStatus(`동기화 코드 변경됨: ${upperCode}`);
    // 새 코드의 데이터 다운로드
    const downloaded = await downloadSync();
    if (downloaded) {
      renderTreemap();
      fetchAllPrices();
      setStatus(`다른 기기의 종목 ${stocks.length}개 불러옴`);
    } else {
      // 다운로드할 게 없으면 현재 종목을 새 코드로 업로드
      uploadSync();
      setStatus(`이 기기의 종목 ${stocks.length}개를 ${upperCode}로 저장`);
    }
  };

  const overlay = document.getElementById('modal-overlay');
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('show');
    }
  };
  let touchStartY = 0;
  document.getElementById('modal').addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  });
  document.getElementById('modal').addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientY - touchStartY;
    if (diff > 80 && document.getElementById('modal').scrollTop === 0) {
      overlay.classList.remove('show');
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('install-prompt').classList.add('show');
  });
  document.getElementById('install-btn').onclick = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
    }
    document.getElementById('install-prompt').classList.remove('show');
  };
  document.getElementById('install-close').onclick = () => {
    document.getElementById('install-prompt').classList.remove('show');
  };
}

async function init() {
  loadApiUrl();
  loadSyncCode();
  loadStocks();
  loadCachedPrices();
  loadCachedTickers();
  setupEvents();
  renderTreemap();
  renderTickerBar();

  if (!apiBaseUrl) {
    document.getElementById('settings-row').classList.add('show');
    setStatus('API 주소를 입력해주세요 (Cloudflare Worker URL)', true);
    return;
  }

  // 클라우드에서 종목 목록 다운로드 (다른 기기에서 추가한 게 있으면 받아옴)
  const downloaded = await downloadSync();
  if (downloaded) renderTreemap();

  // 시세와 시장 지표 병렬 로드
  await Promise.all([fetchAllPrices(), refreshTickers()]);
  setInterval(refreshTickers, 60000);

  // 30초마다 다른 기기에서 변경된 게 있는지 폴링
  setInterval(async () => {
    if (syncInProgress) return; // 내가 업로드 중이면 스킵
    const before = JSON.stringify(stocks);
    const got = await downloadSync();
    if (got && JSON.stringify(stocks) !== before) {
      renderTreemap();
      fetchAllPrices(); // 새 종목 시세 가져오기
    }
  }, 30000);

  // 시세 자동 갱신 (장 운영시간에만)
  startAutoRefresh();
}

// ===== 자동 갱신 (장 운영시간 기반) =====
// 매 5초마다 현재 장 상태 확인하고, 적절한 주기로 갱신
let lastRefreshAt = 0;
function startAutoRefresh() {
  setInterval(() => {
    const interval = currentRefreshInterval();
    if (interval === 0) return; // 장 외 시간 → 갱신 안 함
    const now = Date.now();
    if (now - lastRefreshAt >= interval) {
      lastRefreshAt = now;
      fetchAllPrices();
    }
  }, 5000); // 5초마다 체크 (실제 갱신은 interval에 따라)
}

// 현재 시각 기준으로 적절한 갱신 주기 반환 (ms 단위, 0 = 갱신 안 함)
function currentRefreshInterval() {
  const now = new Date();
  const day = now.getDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return 0; // 주말

  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 60 + minute; // 분 단위

  // NXT 프리마켓: 08:00 ~ 09:00 → 30초
  if (time >= 8 * 60 && time < 9 * 60) return 30000;

  // KRX 정규장 (NXT 메인마켓 포함): 09:00 ~ 15:30 → 10초
  if (time >= 9 * 60 && time < 15 * 60 + 30) return 10000;

  // NXT 애프터마켓 + KRX 시간외: 15:30 ~ 20:00 → 30초
  if (time >= 15 * 60 + 30 && time < 20 * 60) return 30000;

  return 0;
}

init();
