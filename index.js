const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

const config = { DATA_FILE: process.env.DATA_FILE || 'movies.json' };

app.use(compression({
    filter: (req, res) => {
        if (req.path === '/video-proxy') return false;
        if (req.headers.accept && (
            req.headers.accept.includes('video') ||
            req.headers.accept.includes('audio')
        )) return false;
        return compression.filter(req, res);
    },
    level: 6
}));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            mediaSrc: ["'self'", "blob:", "data:", "https:", "http:", "*"],
            connectSrc: ["'self'", "https:", "http:", "*"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const videoProxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    skip: (req) => req.headers.range
});

let MOVIES_LIST = [];

function loadData() {
    try {
        const jsonPath = path.join(__dirname, config.DATA_FILE);
        if (!fs.existsSync(jsonPath)) return;
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (!Array.isArray(data)) return;

        MOVIES_LIST = data
            .filter(item => item.title && item.url)
            .map(item => ({
                title: String(item.title).trim(),
                logo: item.logo || '',
                url: item.url || ''
            }))
            .sort((a, b) => a.title.localeCompare(b.title));

        console.log('[OK] ' + MOVIES_LIST.length + ' películas');
    } catch (e) { console.error('[ERROR]', e.message); }
}

loadData();

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.get('/api/stats', (req, res) => res.json({ movies: MOVIES_LIST.length }));

app.get('/api/movies', (req, res) => {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 250;
    const search = (req.query.q || '').toLowerCase();
    const random = req.query.random === 'true';
    let list = [...MOVIES_LIST];
    if (search) list = list.filter(m => m.title.toLowerCase().includes(search));
    if (random) for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const start = page * limit;
    res.json({ total: list.length, page, hasMore: start + limit < list.length, data: list.slice(start, start + limit) });
});

app.get('/video-proxy', videoProxyLimiter, (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    let parsed;
    try {
        parsed = new URL(decodeURIComponent(url));
    } catch (e) {
        return res.status(400).json({ error: 'URL inválida' });
    }

    const client = parsed.protocol === 'https:' ? https : http;

    const opts = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
            'Referer': parsed.origin + '/'
        }
    };

    if (req.headers.range) opts.headers['Range'] = req.headers.range;

    const proxyReq = client.request(opts, proxyRes => {
        if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
            proxyRes.destroy();
            return res.redirect('/video-proxy?url=' + encodeURIComponent(proxyRes.headers.location));
        }

        const headers = {
            'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff'
        };

        if (proxyRes.headers['content-length']) headers['Content-Length'] = proxyRes.headers['content-length'];
        if (proxyRes.headers['content-range']) headers['Content-Range'] = proxyRes.headers['content-range'];

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res, { end: true });

        proxyRes.on('error', (err) => {
            console.error('[PROXY STREAM ERROR]', err.message);
            if (!res.headersSent) res.status(502).json({ error: 'Stream error' });
            else res.end();
        });
    });

    proxyReq.on('timeout', () => {
        console.error('[PROXY TIMEOUT]');
        proxyReq.destroy();
        if (!res.headersSent) res.status(504).json({ error: 'Timeout' });
    });

    proxyReq.on('error', (err) => {
        console.error('[PROXY ERROR]', err.message);
        if (!res.headersSent) res.status(502).json({ error: 'Connection error' });
    });

    req.on('close', () => proxyReq.destroy());
    proxyReq.end();
});

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Stream+ Películas</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none;-webkit-tap-highlight-color:transparent}
:root{--bg:#0a0a0a;--surface:#161616;--card:#1a1a1a;--border:#2a2a2a;--text:#e0e0e0;--text2:#707070;--accent:#c00;--focus:#fff}
html,body{background:var(--bg);color:var(--text);font-family:-apple-system,system-ui,sans-serif;height:100%;overflow:hidden}
#app{height:100%;display:flex;flex-direction:column}

.hdr{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border)}
.logo{color:var(--accent);font-weight:700;font-size:20px;letter-spacing:-1px}
.srch{flex:1;background:var(--bg);border:2px solid var(--border);color:var(--text);padding:10px 16px;border-radius:8px;font-size:14px;outline:none}
.srch:focus,.srch.f{border-color:var(--focus)}
.btn{background:var(--card);border:2px solid var(--border);color:var(--text);padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
.btn.f{border-color:var(--focus)}
.stats{color:var(--text2);font-size:12px}

.main{flex:1;overflow-y:auto;padding:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
@media(min-width:900px){.grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}}
@media(min-width:1400px){.grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}}

.card{position:relative;aspect-ratio:2/3;background:var(--card);border-radius:6px;overflow:hidden;border:2px solid transparent;cursor:pointer}
.card.f{border-color:var(--focus)}
.card img{width:100%;height:100%;object-fit:cover;opacity:0}
.card img.ok{opacity:1}
.card img.err{opacity:.2}
.card-t{position:absolute;bottom:0;left:0;right:0;padding:30px 8px 8px;background:linear-gradient(transparent,#000);font-size:12px;font-weight:600;opacity:0}
.card.f .card-t{opacity:1}

.player{position:fixed;inset:0;background:#000;z-index:200;display:none}
.player.open{display:block}
video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}

.p-ui{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;opacity:1;transition:opacity .15s}
.p-ui.hide{opacity:0;pointer-events:none}

.p-top{padding:16px 20px;background:linear-gradient(#000a,transparent)}
.p-title{font-size:15px;font-weight:600}
.p-status{font-size:12px;color:var(--text2);margin-top:4px}

.p-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:48px;font-weight:700;opacity:0;transition:opacity .15s}
.p-center.show{opacity:1}

.p-vol{position:absolute;right:30px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;opacity:0;transition:opacity .15s}
.p-vol.show{opacity:1}
.p-vol-bar{width:6px;height:100px;background:#333;border-radius:3px;position:relative}
.p-vol-fill{position:absolute;bottom:0;left:0;right:0;background:var(--accent);border-radius:3px}
.p-vol-pct{font-size:13px;font-weight:600}

.p-bottom{padding:16px 20px 20px;background:linear-gradient(transparent,#000a)}
.p-prog{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.p-time{font-size:13px;font-weight:500;min-width:50px}
.p-time:last-child{text-align:right}
.p-bar{flex:1;height:4px;background:#444;border-radius:2px;position:relative;cursor:pointer}
.p-bar.f{height:6px;box-shadow:0 0 0 2px var(--focus)}
.p-bar-fill{position:absolute;left:0;top:0;height:100%;background:var(--accent);border-radius:2px;z-index:2}
.p-bar-buf{position:absolute;left:0;top:0;height:100%;background:#666;border-radius:2px;z-index:1}
.p-bar-dot{position:absolute;top:50%;transform:translate(-50%,-50%);width:14px;height:14px;background:#fff;border-radius:50%;opacity:0;z-index:3}
.p-bar.f .p-bar-dot{opacity:1}

.p-ctrl{display:flex;justify-content:center;gap:12px}
.p-btn{width:48px;height:48px;background:transparent;border:2px solid transparent;border-radius:50%;color:#fff;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center}
.p-btn.f{border-color:var(--focus);background:#222}
.p-btn.main{width:56px;height:56px;background:#222;font-size:16px}
.p-btn.main.f{background:var(--accent);border-color:var(--accent)}

.p-next{position:absolute;bottom:120px;right:20px;background:#111;border:1px solid var(--border);border-radius:10px;padding:16px 20px;display:none;max-width:280px}
.p-next.show{display:block}
.p-next-lbl{font-size:11px;color:var(--text2);text-transform:uppercase;margin-bottom:6px}
.p-next-t{font-size:14px;font-weight:600;margin-bottom:4px}
.p-next-cd{font-size:12px;color:var(--accent);margin-bottom:12px}
.p-next-btns{display:flex;gap:8px}
.p-next-btn{padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:2px solid transparent}
.p-next-btn.f{border-color:var(--focus)}
.p-next-btn.pri{background:var(--accent);color:#fff}
.p-next-btn.sec{background:transparent;color:var(--text);border-color:var(--border)}

.p-err{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;display:none}
.p-err.show{display:block}
.p-err-t{font-size:16px;margin-bottom:8px}
.p-err-sub{font-size:12px;color:var(--text2);margin-bottom:16px}
.p-err-btn{padding:12px 24px;background:var(--accent);border:2px solid transparent;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin:4px}
.p-err-btn.f{border-color:var(--focus)}
.p-err-btn.sec{background:transparent;border-color:var(--border)}

.p-load{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:none;text-align:center}
.p-load.show{display:block}
.p-load-spin{width:40px;height:40px;border:3px solid #333;border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px}
.p-load-txt{font-size:12px;color:var(--text2)}

.msg{text-align:center;padding:60px 20px;color:var(--text2)}
.msg.load::after{content:'';display:block;width:24px;height:24px;margin:16px auto 0;border:2px solid #333;border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}

@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="app">
    <div class="hdr">
        <div class="logo">STREAM+</div>
        <input class="srch" id="srch" placeholder="Buscar película...">
        <button class="btn" id="mix">Aleatorio</button>
        <span class="stats" id="stats"></span>
    </div>
    <div class="main" id="main">
        <div class="grid" id="grid"><div class="msg load">Cargando</div></div>
    </div>

    <div class="player" id="player">
        <video id="vid" playsinline preload="auto"></video>
        <div class="p-load" id="p-load">
            <div class="p-load-spin"></div>
            <div class="p-load-txt" id="p-load-txt">Cargando...</div>
        </div>
        <div class="p-err" id="p-err">
            <div class="p-err-t">Error de reproducción</div>
            <div class="p-err-sub" id="p-err-sub">No se pudo cargar el video</div>
            <button class="p-err-btn" id="p-retry">Reintentar</button>
            <button class="p-err-btn sec" id="p-back">Volver</button>
        </div>
        <div class="p-center" id="p-ind"></div>
        <div class="p-vol" id="p-vol">
            <div class="p-vol-pct" id="p-vol-pct">100%</div>
            <div class="p-vol-bar"><div class="p-vol-fill" id="p-vol-fill" style="height:100%"></div></div>
        </div>
        <div class="p-ui" id="p-ui">
            <div class="p-top">
                <div class="p-title" id="p-title"></div>
                <div class="p-status" id="p-status"></div>
            </div>
            <div class="p-next" id="p-next">
                <div class="p-next-lbl">Siguiente película</div>
                <div class="p-next-t" id="p-next-t"></div>
                <div class="p-next-cd" id="p-next-cd"></div>
                <div class="p-next-btns">
                    <button class="p-next-btn pri" id="p-next-play">Reproducir</button>
                    <button class="p-next-btn sec" id="p-next-cancel">Cancelar</button>
                </div>
            </div>
            <div class="p-bottom">
                <div class="p-prog">
                    <span class="p-time" id="p-cur">0:00</span>
                    <div class="p-bar" id="p-bar">
                        <div class="p-bar-buf" id="p-bar-buf"></div>
                        <div class="p-bar-fill" id="p-bar-fill"></div>
                        <div class="p-bar-dot" id="p-bar-dot"></div>
                    </div>
                    <span class="p-time" id="p-dur">0:00</span>
                </div>
                <div class="p-ctrl">
                    <button class="p-btn" id="p-prev">PREV</button>
                    <button class="p-btn" id="p-rw">-10</button>
                    <button class="p-btn main" id="p-pp">PLAY</button>
                    <button class="p-btn" id="p-fw">+10</button>
                    <button class="p-btn" id="p-nxt">NEXT</button>
                </div>
            </div>
        </div>
    </div>
</div>
<script>
(function(){
const $=id=>document.getElementById(id);

const state = {
    view: 'home',
    movieIdx: 0,
    currentList: [],
    page: 0,
    hasMore: true,
    loading: false,
    cols: 5,
    focused: null,
    playing: false,
    lastFocused: null,
    retryCount: 0,
    maxRetries: 3
};

let hideT, volT, indT, nextT, bufferCheckT;

const el = {
    grid: $('grid'), main: $('main'), srch: $('srch'), mix: $('mix'), stats: $('stats'),
    player: $('player'), vid: $('vid'), pUi: $('p-ui'), pTitle: $('p-title'), pStatus: $('p-status'),
    pLoad: $('p-load'), pLoadTxt: $('p-load-txt'), pErr: $('p-err'), pErrSub: $('p-err-sub'), pRetry: $('p-retry'), pBack: $('p-back'),
    pInd: $('p-ind'), pVol: $('p-vol'), pVolFill: $('p-vol-fill'), pVolPct: $('p-vol-pct'),
    pBar: $('p-bar'), pBarFill: $('p-bar-fill'), pBarBuf: $('p-bar-buf'), pBarDot: $('p-bar-dot'),
    pCur: $('p-cur'), pDur: $('p-dur'),
    pPrev: $('p-prev'), pRw: $('p-rw'), pPp: $('p-pp'), pFw: $('p-fw'), pNxt: $('p-nxt'),
    pNext: $('p-next'), pNextT: $('p-next-t'), pNextCd: $('p-next-cd'), pNextPlay: $('p-next-play'), pNextCancel: $('p-next-cancel')
};

function initHistory() {
    history.replaceState({ view: 'home' }, '', '#home');
    window.addEventListener('popstate', function(e) {
        if (state.view === 'player') closePlayerInternal();
    });
}

function pushView(view) { history.pushState({ view }, '', '#' + view); }

initHistory();
fetch('/api/stats').then(r => r.json()).then(d => { el.stats.textContent = d.movies + ' películas'; }).catch(() => {});
load(false, true);
calcCols();
window.addEventListener('resize', calcCols);
document.addEventListener('keydown', onKey, true);
setupPlayer();
setupMouse();
setTimeout(() => focusFirst(), 300);

function calcCols() {
    const c = el.grid.querySelector('.card');
    if (c) { const w = el.grid.offsetWidth, cw = c.offsetWidth + 10; state.cols = Math.max(1, Math.floor(w / cw)); }
}

function onKey(e) {
    const k = e.key;
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '];
    if (navKeys.includes(k)) { e.preventDefault(); e.stopPropagation(); }
    if (state.view === 'player') { playerKey(k); return; }
    if (document.activeElement === el.srch) {
        if (k === 'ArrowDown') { el.srch.blur(); focusFirst(); }
        return;
    }
    switch (k) {
        case 'ArrowUp': move('up'); break;
        case 'ArrowDown': move('down'); break;
        case 'ArrowLeft': move('left'); break;
        case 'ArrowRight': move('right'); break;
        case 'Enter': case ' ': activate(); break;
    }
}

function getFocusable() {
    if (state.view === 'home') return [...document.querySelectorAll('#srch,#mix,.card')].filter(e => e.offsetParent);
    return [];
}

function focus(elem) {
    if (state.focused) state.focused.classList.remove('f');
    state.focused = elem;
    if (elem) { elem.classList.add('f'); elem.scrollIntoView({ block: 'nearest' }); }
}

function focusFirst() {
    const f = getFocusable();
    if (state.lastFocused && f.includes(state.lastFocused)) { focus(state.lastFocused); return; }
    const card = f.find(e => e.classList.contains('card'));
    focus(card || f[0]);
}

function saveFocus() { state.lastFocused = state.focused; }

function move(dir) {
    const f = getFocusable(), i = f.indexOf(state.focused);
    if (i < 0) { focusFirst(); return; }
    const cards = f.filter(e => e.classList.contains('card'));
    const ci = cards.indexOf(state.focused);
    if (ci >= 0) {
        if (dir === 'up') { if (ci < state.cols) focus(el.mix); else focus(cards[ci - state.cols]); }
        if (dir === 'down') { const ni = ci + state.cols; if (ni < cards.length) focus(cards[ni]); else if (state.hasMore) load(true, false); }
        if (dir === 'left' && ci > 0) focus(cards[ci - 1]);
        if (dir === 'right' && ci < cards.length - 1) focus(cards[ci + 1]);
    } else {
        if (state.focused === el.srch && dir === 'right') focus(el.mix);
        if (state.focused === el.mix && dir === 'left') focus(el.srch);
        if (dir === 'down' && cards.length) focus(cards[0]);
    }
}

function activate() {
    if (!state.focused) return;
    if (state.focused === el.srch) { el.srch.focus(); return; }
    state.focused.click();
}

// ===== PLAYER =====
function playerKey(k) {
    showUI();
    switch (k) {
        case 'ArrowLeft': seek(-10); break;
        case 'ArrowRight': seek(10); break;
        case 'ArrowUp': vol(0.1); break;
        case 'ArrowDown': vol(-0.1); break;
        case 'Enter': case ' ': togglePlay(); break;
    }
}

function togglePlay() {
    if (el.vid.paused) { el.vid.play().catch(handlePlayError); showInd('▶'); }
    else { el.vid.pause(); showInd('⏸'); }
}

function seek(s) {
    const newTime = Math.max(0, Math.min(el.vid.currentTime + s, el.vid.duration || 0));
    el.vid.currentTime = newTime;
    showInd((s > 0 ? '+' : '') + s + 's');
}

function vol(d) {
    el.vid.volume = Math.max(0, Math.min(1, el.vid.volume + d));
    updateVol();
    el.pVol.classList.add('show');
    clearTimeout(volT);
    volT = setTimeout(() => el.pVol.classList.remove('show'), 1500);
}

function updateVol() {
    const v = Math.round(el.vid.volume * 100);
    el.pVolFill.style.height = v + '%';
    el.pVolPct.textContent = v + '%';
}

function showInd(txt) {
    el.pInd.textContent = txt;
    el.pInd.classList.add('show');
    clearTimeout(indT);
    indT = setTimeout(() => el.pInd.classList.remove('show'), 500);
}

function showUI() {
    el.pUi.classList.remove('hide');
    clearTimeout(hideT);
    hideT = setTimeout(() => {
        if (state.playing && !el.pNext.classList.contains('show')) el.pUi.classList.add('hide');
    }, 3000);
}

function setupPlayer() {
    const v = el.vid;
    v.preload = 'auto';
    v.playsInline = true;

    v.addEventListener('loadstart', () => { el.pLoad.classList.add('show'); el.pErr.classList.remove('show'); el.pLoadTxt.textContent = 'Conectando...'; updateStatus('Conectando...'); });
    v.addEventListener('loadedmetadata', () => { el.pLoadTxt.textContent = 'Cargando video...'; updateStatus('Preparando...'); });
    v.addEventListener('loadeddata', () => { el.pLoadTxt.textContent = 'Casi listo...'; });
    v.addEventListener('canplay', () => { el.pLoad.classList.remove('show'); updateStatus(''); state.retryCount = 0; });
    v.addEventListener('canplaythrough', () => { el.pLoad.classList.remove('show'); updateStatus(''); });
    v.addEventListener('waiting', () => { el.pLoad.classList.add('show'); el.pLoadTxt.textContent = 'Buffering...'; updateStatus('Buffering...'); });
    v.addEventListener('playing', () => { el.pLoad.classList.remove('show'); state.playing = true; el.pPp.textContent = 'PAUSE'; hideNext(); updateStatus(''); startBufferMonitor(); });
    v.addEventListener('pause', () => { state.playing = false; el.pPp.textContent = 'PLAY'; stopBufferMonitor(); });
    v.addEventListener('timeupdate', () => { updateProg(); checkNext(); });
    v.addEventListener('progress', updateBuf);
    v.addEventListener('durationchange', () => { el.pDur.textContent = fmt(v.duration); });
    v.addEventListener('volumechange', updateVol);
    v.addEventListener('ended', () => { stopBufferMonitor(); showNext(); });
    v.addEventListener('error', handleVideoError);
    v.addEventListener('stalled', () => { updateStatus('Reconectando...'); el.pLoadTxt.textContent = 'Reconectando...'; });

    el.pPp.onclick = togglePlay;
    el.pRw.onclick = () => seek(-10);
    el.pFw.onclick = () => seek(10);
    el.pPrev.onclick = prevMovie;
    el.pNxt.onclick = nextMovie;
    el.pRetry.onclick = retry;
    el.pBack.onclick = () => history.back();
    el.pNextPlay.onclick = nextMovie;
    el.pNextCancel.onclick = cancelNext;
    el.pBar.onclick = e => {
        const r = el.pBar.getBoundingClientRect();
        el.vid.currentTime = ((e.clientX - r.left) / r.width) * el.vid.duration;
    };
}

function handleVideoError() {
    const error = el.vid.error;
    let msg = 'Error desconocido';
    if (error) {
        switch(error.code) {
            case 1: msg = 'Carga abortada'; break;
            case 2: msg = 'Error de red'; break;
            case 3: msg = 'Error de decodificación'; break;
            case 4: msg = 'Formato no soportado'; break;
        }
    }
    el.pErrSub.textContent = msg;
    if (error && error.code === 2 && state.retryCount < state.maxRetries) {
        state.retryCount++;
        el.pLoadTxt.textContent = 'Reintentando... (' + state.retryCount + '/' + state.maxRetries + ')';
        updateStatus('Reintentando...');
        setTimeout(retry, 2000);
    } else {
        el.pLoad.classList.remove('show');
        el.pErr.classList.add('show');
        stopBufferMonitor();
    }
}

function handlePlayError(e) {
    if (e.name === 'NotAllowedError') el.pPp.textContent = 'PLAY';
}

function updateStatus(text) { el.pStatus.textContent = text; }

function startBufferMonitor() {
    stopBufferMonitor();
    bufferCheckT = setInterval(() => {
        if (el.vid.buffered.length > 0) {
            const ahead = el.vid.buffered.end(el.vid.buffered.length - 1) - el.vid.currentTime;
            if (ahead < 2 && !el.vid.paused) updateStatus('Buffer bajo...');
            else if (ahead > 5) updateStatus('');
        }
    }, 1000);
}

function stopBufferMonitor() { if (bufferCheckT) { clearInterval(bufferCheckT); bufferCheckT = null; } }

function updateProg() {
    const p = el.vid.duration ? (el.vid.currentTime / el.vid.duration) * 100 : 0;
    el.pBarFill.style.width = p + '%';
    el.pBarDot.style.left = p + '%';
    el.pCur.textContent = fmt(el.vid.currentTime);
}

function updateBuf() {
    if (el.vid.buffered.length) {
        const p = (el.vid.buffered.end(el.vid.buffered.length - 1) / el.vid.duration) * 100;
        el.pBarBuf.style.width = p + '%';
    }
}

function retry() {
    el.pErr.classList.remove('show');
    el.pLoad.classList.add('show');
    el.pLoadTxt.textContent = 'Reintentando...';
    const currentTime = el.vid.currentTime, src = el.vid.src;
    el.vid.src = '';
    setTimeout(() => { el.vid.src = src; el.vid.currentTime = currentTime; el.vid.play().catch(handlePlayError); }, 500);
}

function checkNext() {
    const rem = (el.vid.duration || 0) - el.vid.currentTime;
    if (rem <= 15 && rem > 0 && hasNext() && !nextT) showNext();
}

function showNext() {
    if (!hasNext()) return;
    const n = state.currentList[state.movieIdx + 1];
    el.pNextT.textContent = n.title;
    el.pNext.classList.add('show');
    let c = 8;
    el.pNextCd.textContent = 'En ' + c + 's';
    nextT = setInterval(() => {
        c--; el.pNextCd.textContent = 'En ' + c + 's';
        if (c <= 0) { clearInterval(nextT); nextT = null; nextMovie(); }
    }, 1000);
    showUI();
}

function hideNext() { el.pNext.classList.remove('show'); if (nextT) { clearInterval(nextT); nextT = null; } }
function cancelNext() { hideNext(); }
function hasNext() { return state.movieIdx < state.currentList.length - 1; }
function nextMovie() { hideNext(); if (hasNext()) { state.movieIdx++; playMovie(state.currentList[state.movieIdx]); } }
function prevMovie() { if (state.movieIdx > 0) { state.movieIdx--; playMovie(state.currentList[state.movieIdx]); } }

function playMovie(movie) {
    state.retryCount = 0;
    hideNext();
    el.pErr.classList.remove('show');
    el.pLoad.classList.add('show');
    el.pLoadTxt.textContent = 'Conectando...';

    let u = movie.url;
    if (u.startsWith('http://')) u = '/video-proxy?url=' + encodeURIComponent(u);

    el.vid.pause();
    el.vid.removeAttribute('src');
    el.vid.load();

    setTimeout(() => {
        el.vid.src = u;
        el.pTitle.textContent = movie.title;
        el.vid.play().catch(handlePlayError);
        showUI();
    }, 100);
}

function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
    return h > 0 ? h + ':' + String(m).padStart(2,'0') + ':' + String(ss).padStart(2,'0') : m + ':' + String(ss).padStart(2,'0');
}

// ===== CARGA DE PELÍCULAS =====
function load(append, random) {
    if (state.loading || (append && !state.hasMore)) return;
    state.loading = true;
    if (!append) { el.grid.innerHTML = '<div class="msg load">Cargando</div>'; state.page = 0; state.hasMore = true; state.currentList = []; }

    let u = '/api/movies?page=' + state.page + '&limit=250';
    if (el.srch.value.trim()) u += '&q=' + encodeURIComponent(el.srch.value.trim());
    if (random) u += '&random=true';

    fetch(u).then(r => r.json()).then(d => {
        if (!append) el.grid.innerHTML = '';
        if (!d.data.length && !append) { el.grid.innerHTML = '<div class="msg">Sin resultados</div>'; return; }
        d.data.forEach((m, i) => {
            state.currentList.push(m);
            el.grid.appendChild(mkCard(m, state.currentList.length - 1));
        });
        state.page++; state.hasMore = d.hasMore;
        calcCols();
        if (!append) setTimeout(focusFirst, 50);
    }).catch(() => {
        if (!append) el.grid.innerHTML = '<div class="msg">Error al cargar</div>';
    }).finally(() => state.loading = false);
}

function mkCard(m, idx) {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = '<img data-src="' + esc(m.logo) + '"><div class="card-t">' + esc(m.title) + '</div>';
    const img = d.querySelector('img');
    obs.observe(img);
    d.onclick = () => openPlayer(idx);
    return d;
}

const obs = new IntersectionObserver(es => {
    es.forEach(e => {
        if (e.isIntersecting) {
            const i = e.target;
            if (i.dataset.src) { i.src = i.dataset.src; i.onload = () => i.classList.add('ok'); i.onerror = () => i.classList.add('err'); }
            obs.unobserve(i);
        }
    });
}, { rootMargin: '200px' });

function openPlayer(idx) {
    saveFocus();
    state.view = 'player';
    state.movieIdx = idx;
    pushView('player');
    playMovie(state.currentList[idx]);
    el.player.classList.add('open');
}

function closePlayerInternal() {
    el.vid.pause();
    el.vid.removeAttribute('src');
    el.vid.load();
    el.player.classList.remove('open');
    state.view = 'home';
    hideNext();
    stopBufferMonitor();
    setTimeout(focusFirst, 50);
}

function setupMouse() {
    el.mix.onclick = () => load(false, true);
    let t;
    el.srch.oninput = () => { clearTimeout(t); t = setTimeout(() => load(false, !el.srch.value.trim()), 300); };
    el.main.onscroll = () => {
        if (!state.loading && state.hasMore) {
            const { scrollTop, scrollHeight, clientHeight } = el.main;
            if (scrollTop + clientHeight >= scrollHeight - 300) load(true, false);
        }
    };
    el.player.onclick = e => { if (e.target === el.vid) { togglePlay(); showUI(); } };
    el.player.onmousemove = showUI;
    el.player.ontouchmove = showUI;
}

function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]) : ''; }
})();
</script>
</body>
</html>`;

app.get('/', (req, res) => { res.setHeader('Content-Type', 'text/html'); res.send(HTML); });
app.get('/health', (req, res) => res.json({ ok: true, movies: MOVIES_LIST.length }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, '0.0.0.0', () => {
    console.log('Stream+ Películas | Puerto ' + PORT + ' | ' + MOVIES_LIST.length + ' películas');
});
