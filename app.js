/**
 * 내 주식 트리맵 PWA
 * Cloudflare Worker 백엔드를 통해 KIS API와 통신합니다.
 */

const STORAGE_STOCKS = 'kr_stocks_v1';
const STORAGE_API_URL = 'kr_api_url_v1';
const STORAGE_PRICES_CACHE = 'kr_prices_cache_v1';

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
}
function loadApiUrl() {
  try { apiBaseUrl = localStorage.getItem(STORAGE_API_URL) || ''; } catch (e) {}
}
function saveApiUrl(url) {
  try { localStorage.setItem(STORAGE_API_URL, url); } catch (e) {}
  apiBaseUrl = url;
}
function loadCachedPrices() {
  try {
    const raw = localStorage.getItem(STORAGE_PRICES_CACHE);
    if (raw) prices = JSON.parse(raw);
  } catch (e) {}
}
function saveCachedPrices() {
  try { localStorage.setItem(STORAGE_PRICES_CACHE, JSON.stringify(prices)); } catch (e) {}
}

// ===== API 호출 =====
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

async function fetchAllPrices() {
  const status = document.getElementById('status');
  if (stocks.length === 0) {
    setStatus('');
    return;
  }
  if (!apiBaseUrl) {
    setStatus('API 주소를 먼저 설정해주세요', true);
    document.getElementById('settings-row').classList.add('show');
    return;
  }
  setStatus(`시세 가져오는 중… (0/${stocks.length})`);
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.classList.add('spinning');

  let done = 0;
  let fails = 0;
  // 동시 호출보다 순차가 안전 (KIS rate limit)
  for (const s of stocks) {
    try {
      const p = await fetchPrice(s.ticker);
      prices[s.ticker] = p;
    } catch (e) {
      fails++;
      console.warn(`${s.ticker} 실패:`, e.message);
    }
    done++;
    setStatus(`시세 가져오는 중… (${done}/${stocks.length})`);
    renderTreemap(); // 점진적 렌더
  }

  saveCachedPrices();
  refreshBtn.classList.remove('spinning');

  const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  if (fails > 0) {
    setStatus(`${stocks.length - fails}/${stocks.length}개 로드 · ${now}`);
  } else {
    setStatus(`${stocks.length}개 종목 · ${now} 업데이트`);
  }
}

function setStatus(text, isError = false) {
  const status = document.getElementById('status');
  status.innerHTML = `
    <span style="${isError ? 'color:#ff8080' : ''}">${text}</span>
    <button class="settings-link" id="settings-link">설정</button>
  `;
  document.getElementById('settings-link').onclick = () => {
    document.getElementById('settings-row').classList.toggle('show');
    document.getElementById('api-url-input').value = apiBaseUrl;
  };
}

// ===== 색상 =====
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

// ===== 렌더링 =====
function renderTreemap() {
  const container = document.getElementById('treemap');
  container.innerHTML = '';
  if (stocks.length === 0) {
    container.innerHTML = `<div class="empty">아직 종목이 없어요.<br>위 입력창에 종목코드(6자리)를 입력하고<br>+ 추가 버튼을 눌러주세요.</div>`;
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
    remove.setAttribute('aria-label', '삭제');
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
    } else {
      pct.textContent = '—';
    }

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

// ===== 상세 모달 =====
function renderChart(candles, changePct) {
  if (!candles || candles.length < 2) return '<div style="color:#666;font-size:12px;text-align:center;padding:20px;">차트 데이터 없음</div>';
  const values = candles.map(c => c.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 600, h = 140;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 20) - 10;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const stroke = changePct >= 0 ? '#ff6b6b' : '#5599ff';
  const fill = changePct >= 0 ? 'rgba(255,107,107,0.15)' : 'rgba(85,153,255,0.15)';
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:140px;display:block;" preserveAspectRatio="none" role="img" aria-label="주가 차트">
      <polygon points="${areaPoints}" fill="${fill}" />
      <polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="1.5" />
    </svg>
  `;
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  return `${yyyymmdd.slice(4,6)}.${yyyymmdd.slice(6,8)}`;
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

    <div class="chart-wrap">
      <div class="chart-tabs">
        <button class="chart-tab active" data-period="D">일봉</button>
        <button class="chart-tab" data-period="W">주봉</button>
        <button class="chart-tab" data-period="M">월봉</button>
      </div>
      <div id="chart-container">
        <div style="color:#666;font-size:12px;text-align:center;padding:30px 0;">차트 불러오는 중…</div>
      </div>
      <div class="chart-labels" id="chart-labels"></div>
    </div>

    <div class="link-grid">
      <a href="${naverUrl}" target="_blank" rel="noopener">네이버 종목 →</a>
      <a href="${newsUrl}" target="_blank" rel="noopener">네이버 뉴스 →</a>
      <a href="${googleNewsUrl}" target="_blank" rel="noopener">구글 뉴스 →</a>
      <a href="${dartUrl}" target="_blank" rel="noopener">DART 공시 →</a>
    </div>
  `;
  overlay.classList.add('show');

  // 차트 로드
  loadChartFor(stock.ticker, 'D');

  // 차트 탭 핸들러
  modal.querySelectorAll('.chart-tab').forEach(tab => {
    tab.onclick = () => {
      modal.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadChartFor(stock.ticker, tab.dataset.period);
    };
  });
}

async function loadChartFor(ticker, period) {
  const container = document.getElementById('chart-container');
  const labels = document.getElementById('chart-labels');
  if (!container) return;
  container.innerHTML = `<div style="color:#666;font-size:12px;text-align:center;padding:30px 0;">차트 불러오는 중…</div>`;
  try {
    const data = await fetchChart(ticker, period);
    const candles = data.candles || [];
    const p = prices[ticker];
    container.innerHTML = renderChart(candles, p ? p.changePct : 0);
    if (candles.length >= 2) {
      labels.innerHTML = `<span>${formatDate(candles[0].date)}</span><span>${formatDate(candles[candles.length - 1].date)}</span>`;
    } else {
      labels.innerHTML = '';
    }
  } catch (e) {
    container.innerHTML = `<div style="color:#ff8080;font-size:12px;text-align:center;padding:20px;">차트 로드 실패: ${e.message}</div>`;
  }
}

// ===== 이벤트 =====
function setupEvents() {
  document.getElementById('add-btn').onclick = async () => {
    const ti = document.getElementById('ticker-input');
    const ni = document.getElementById('name-input');
    const ticker = ti.value.trim();
    let name = ni.value.trim();
    if (!ticker) { setStatus('종목코드를 입력해주세요', true); return; }
    if (!/^\d{6}$/.test(ticker)) { setStatus('종목코드는 숫자 6자리입니다', true); return; }
    if (stocks.some(s => s.ticker === ticker)) { setStatus('이미 추가된 종목입니다', true); return; }
    if (!name) name = ticker; // 이름 비우면 코드로

    stocks.push({ ticker, name });
    saveStocks();
    ti.value = '';
    ni.value = '';
    renderTreemap();
    setStatus(`${name} 시세 가져오는 중…`);
    try {
      const p = await fetchPrice(ticker);
      prices[ticker] = p;
      saveCachedPrices();
      renderTreemap();
      setStatus(`${name} 추가 완료`);
    } catch (e) {
      setStatus(`${name} 시세 조회 실패: ${e.message}`, true);
    }
  };

  document.getElementById('refresh-btn').onclick = () => fetchAllPrices();

  document.getElementById('save-api-btn').onclick = () => {
    const url = document.getElementById('api-url-input').value.trim().replace(/\/$/, '');
    if (!url.startsWith('https://')) { setStatus('https://로 시작하는 주소를 입력해주세요', true); return; }
    saveApiUrl(url);
    document.getElementById('settings-row').classList.remove('show');
    setStatus('API 주소 저장됨');
    fetchAllPrices();
  };

  document.getElementById('ticker-input').onkeydown = (e) => {
    if (e.key === 'Enter') document.getElementById('name-input').focus();
  };
  document.getElementById('name-input').onkeydown = (e) => {
    if (e.key === 'Enter') document.getElementById('add-btn').click();
  };

  // 모달 닫기 (배경 클릭 또는 아래로 스와이프)
  const overlay = document.getElementById('modal-overlay');
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.classList.remove('show');
  };
  // 모바일 스와이프 다운으로 닫기
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

  // PWA 설치 프롬프트
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

// ===== 초기화 =====
async function init() {
  loadApiUrl();
  loadStocks();
  loadCachedPrices();
  setupEvents();
  renderTreemap();

  if (!apiBaseUrl) {
    document.getElementById('settings-row').classList.add('show');
    setStatus('API 주소를 입력해주세요 (Cloudflare Worker URL)', true);
    return;
  }
  await fetchAllPrices();
}

init();
