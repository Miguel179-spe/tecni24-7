const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;
let MOVIES = [];

try {
  const data = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, process.env.DATA_FILE || "data.json"),
      "utf8"
    )
  );
  MOVIES = data.map((m, i) => ({
    id: i,
    title: m.title || "Sin título",
    poster: m.logo || "",
    url: m.url || "",
  }));
  console.log(`✓ ${MOVIES.length} películas`);
} catch (e) {
  console.error("Error:", e.message);
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Range,Accept-Ranges,Content-Length"
  );
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/movies", (req, res) => {
  const { page = 0, limit = 200, q = "", random } = req.query;
  let list = q
    ? MOVIES.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()))
    : [...MOVIES];
  if (random === "true") list.sort(() => Math.random() - 0.5);
  const start = page * limit;
  res.json({
    total: list.length,
    hasMore: start + +limit < list.length,
    data: list.slice(start, start + +limit),
  });
});

app.get("/video-proxy", (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).end();
  let parsed;
  try {
    parsed = new URL(decodeURIComponent(url));
  } catch {
    return res.status(400).end();
  }
  const client = parsed.protocol === "https:" ? https : http;
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Accept: "*/*",
    "Accept-Encoding": "identity",
    Referer: parsed.origin + "/",
  };
  if (req.headers.range) headers["Range"] = req.headers.range;
  const proxyReq = client.request(
    {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers,
      timeout: 30000,
    },
    (proxyRes) => {
      if (
        [301, 302, 307, 308].includes(proxyRes.statusCode) &&
        proxyRes.headers.location
      ) {
        proxyRes.destroy();
        return res.redirect(
          307,
          "/video-proxy?url=" + encodeURIComponent(proxyRes.headers.location)
        );
      }
      const h = {
        "Content-Type": proxyRes.headers["content-type"] || "video/mp4",
        "Accept-Ranges": "bytes",
      };
      if (proxyRes.headers["content-length"])
        h["Content-Length"] = proxyRes.headers["content-length"];
      if (proxyRes.headers["content-range"])
        h["Content-Range"] = proxyRes.headers["content-range"];
      res.writeHead(proxyRes.statusCode, h);
      proxyRes.pipe(res);
      proxyRes.on("error", () => res.end());
    }
  );
  proxyReq.on("error", () => !res.headersSent && res.status(502).end());
  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    !res.headersSent && res.status(504).end();
  });
  req.on("close", () => proxyReq.destroy());
  proxyReq.end();
});

app.get("/", (req, res) =>
  res.send(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Movies+</title><style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none;-webkit-tap-highlight-color:transparent}
:root{--p:#f5c518;--bg:#0a0a0a;--s:#161616;--c:#1a1a1a;--b:#2a2a2a;--t:#e0e0e0;--t2:#888}
html,body{background:var(--bg);color:var(--t);font-family:system-ui,sans-serif;height:100%;overflow:hidden}
#app{height:100%;display:flex;flex-direction:column}
.hdr{display:flex;align-items:center;gap:10px;padding:12px;background:var(--s);border-bottom:1px solid var(--b)}
.logo{color:var(--p);font-weight:700;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.2s}
.logo:hover{background:rgba(245,197,24,0.1)}
.srch{flex:1;background:var(--bg);border:2px solid var(--b);color:var(--t);padding:10px;border-radius:8px;font-size:16px;outline:none;transition:border-color 0.2s}
.srch:focus{border-color:var(--p)}
.btn{background:var(--c);border:2px solid var(--b);color:var(--t);padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;transition:all 0.2s}
.btn:hover{background:var(--p);color:#000;border-color:var(--p)}
.stats{color:var(--t2);font-size:12px;margin-left:auto}
.main{flex:1;overflow-y:auto;padding:10px;-webkit-overflow-scrolling:touch}
.pull-indicator{display:flex;justify-content:center;align-items:center;height:0;overflow:hidden;transition:height 0.2s;color:var(--t2);font-size:14px}
.pull-indicator.visible{height:40px}
.pull-indicator.loading{color:var(--p)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.card{position:relative;aspect-ratio:2/3;background:var(--c);border-radius:6px;overflow:hidden;border:2px solid transparent;cursor:pointer;transition:transform 0.15s}
.card:active{transform:scale(0.97)}
.card img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.3s ease-in-out;background:linear-gradient(45deg,#1a1a1a 25%,#222 25%,#222 50%,#1a1a1a 50%,#1a1a1a 75%,#222 75%,#222);background-size:20px 20px}
.card img.loaded{opacity:1}
.card img.error{opacity:0.5}
.card-title{position:absolute;bottom:0;left:0;right:0;padding:20px 6px 6px;background:linear-gradient(transparent,#000);font-size:11px;font-weight:600}
.player{position:fixed;inset:0;background:#000;z-index:200;display:none;flex-direction:column}
.player.active{display:flex}
.player-header{display:flex;align-items:center;gap:10px;padding:12px;padding-top:max(12px,env(safe-area-inset-top))}
.btn-back{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0 8px}
.player-title{font-size:16px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.video-container{flex:1;display:flex;align-items:center;justify-content:center;background:#000}
video{width:100%;max-height:100%;background:#000}
.p-ui{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;opacity:1;transition:.2s;background:linear-gradient(#000a,transparent 15%,transparent 85%,#000a);pointer-events:none}
.p-ui>*{pointer-events:auto}.p-ui.hide{opacity:0}.p-ui.hide>*{pointer-events:none}
.p-top{padding:12px}
.p-title{font-size:14px;font-weight:600}
.p-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:40px;font-weight:700;opacity:0;transition:.15s;pointer-events:none}
.p-center.show{opacity:1}
.p-bottom{padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom))}
.p-prog{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.p-time{font-size:12px;min-width:45px}
.p-bar{flex:1;height:5px;background:#444;border-radius:3px;position:relative;cursor:pointer}
.p-bar-fill{position:absolute;left:0;top:0;height:100%;background:var(--p);border-radius:3px}
.p-bar-buf{position:absolute;left:0;top:0;height:100%;background:#666;border-radius:3px;z-index:-1}
.p-ctrl{display:flex;justify-content:center;gap:10px}
.p-btn{width:44px;height:44px;background:rgba(255,255,255,.1);border:none;border-radius:50%;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:background 0.2s}
.p-btn:hover,.p-btn:active{background:var(--p);color:#000}
.p-btn.main{width:52px;height:52px;font-size:18px}
.p-load,.p-err{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;display:none}
.p-load.show,.p-err.show{display:block}
.p-spin{width:36px;height:36px;border:3px solid #333;border-top-color:var(--p);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 10px}
.msg{text-align:center;padding:40px;color:var(--t2)}
.msg.load::after{content:'';display:block;width:20px;height:20px;margin:12px auto 0;border:2px solid #333;border-top-color:var(--p);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><div id="app">
<div class="hdr">
    <div class="logo" id="logo">MOVIES+</div>
    <input class="srch" id="srch" placeholder="Buscar..." autocomplete="off">
    <button class="btn" id="mix">🎲 Mezclar</button>
    <span class="stats" id="stats"></span>
</div>
<div class="pull-indicator" id="pullIndicator">↓ Suelta para mezclar</div>
<div class="main" id="main"><div class="grid" id="grid"><div class="msg load">Cargando</div></div></div>
<div class="player" id="player">
    <div class="player-header">
        <button class="btn-back" id="playerBack">←</button>
        <div class="player-title" id="playerTitle"></div>
    </div>
    <div class="video-container">
        <video id="vid" playsinline webkit-playsinline></video>
    </div>
    <div class="p-load" id="pLoad"><div class="p-spin"></div><div id="pLoadTxt">Cargando...</div></div>
    <div class="p-err" id="pErr"><div>Error</div><div style="font-size:11px;color:#888;margin:8px 0" id="pErrTxt"></div><button class="btn" id="pRetry">Reintentar</button></div>
</div>
</div></body>
<script>
(function(){
const $=id=>document.getElementById(id);
const el={
    logo:$('logo'), grid:$('grid'), main:$('main'), srch:$('srch'), mix:$('mix'), stats:$('stats'),
    pullIndicator:$('pullIndicator'), player:$('player'), playerBack:$('playerBack'), playerTitle:$('playerTitle'),
    vid:$('vid'), pLoad:$('pLoad'), pLoadTxt:$('pLoadTxt'), pErr:$('pErr'), pErrTxt:$('pErrTxt'),
    pRetry:$('pRetry')
};

const state = {
    movies: [],
    page: 0,
    hasMore: true,
    loading: false,
    search: '',
    currentMovie: null,
    currentView: 'home',
    retry: 0
};

const imgObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src;
            if (src) {
                img.src = src;
                img.onload = () => img.classList.add('loaded');
                img.onerror = () => img.classList.add('error');
            } else {
                img.classList.add('error');
            }
            imgObserver.unobserve(img);
        }
    });
}, { rootMargin: '100px' });

function init() {
    fetch('/api/movies?limit=200&random=true').then(r=>r.json()).then(d=>{
        el.stats.textContent = d.total + ' películas';
        state.movies = d.data;
        state.hasMore = d.hasMore;
        renderMovies();
    }).catch(() => el.grid.innerHTML='<div class="msg">Error</div>');

    el.srch.addEventListener('input', () => {
        clearTimeout(el.srch._timer);
        el.srch._timer = setTimeout(() => {
            state.search = el.srch.value.trim();
            loadMovies(false, false);
        }, 300);
    });

    el.mix.addEventListener('click', () => loadMovies(false, true));
    el.logo.addEventListener('click', () => {
        el.srch.value = '';
        state.search = '';
        loadMovies(false, true);
    });

    el.main.addEventListener('scroll', () => {
        if (state.loading || !state.hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = el.main;
        if (scrollTop + clientHeight >= scrollHeight - 300) loadMovies(true, false);
    });

    // Pull to refresh
    let startY = 0, pulling = false;
    el.main.addEventListener('touchstart', (e) => {
        if (el.main.scrollTop === 0) {
            startY = e.touches[0].pageY;
            pulling = true;
        }
    }, { passive: true });

    el.main.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        const diff = e.touches[0].pageY - startY;
        el.pullIndicator.classList.toggle('visible', diff > 60);
    }, { passive: true });

    el.main.addEventListener('touchend', () => {
        if (el.pullIndicator.classList.contains('visible')) {
            el.pullIndicator.textContent = 'Mezclando...';
            el.pullIndicator.classList.add('loading');
            setTimeout(() => {
                loadMovies(false, true);
                el.pullIndicator.classList.remove('visible', 'loading');
                el.pullIndicator.textContent = '↓ Suelta para mezclar';
            }, 500);
        }
        pulling = false;
    }, { passive: true });

    // Navegación con botón atrás del navegador
    window.addEventListener('popstate', (e) => {
        if (state.currentView === 'player') {
            closePlayer();
            e.preventDefault();
        }
    });

    // Escape para cerrar reproductor
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.currentView === 'player') {
            closePlayer();
        }
    });

    el.playerBack.addEventListener('click', closePlayer);
}

function loadMovies(append, random) {
    if (state.loading) return;
    if (append && !state.hasMore) return;
    state.loading = true;

    if (!append) {
        state.page = 0;
        state.hasMore = true;
        state.movies = [];
        el.grid.innerHTML = '<div class="msg load">Cargando</div>';
    }

    let url = '/api/movies?page=' + state.page + '&limit=50';
    if (state.search) url += '&q=' + encodeURIComponent(state.search);
    if (random) url += '&random=true';

    fetch(url).then(r => r.json()).then(d => {
        if (!append) el.grid.innerHTML = '';
        if (d.data.length === 0 && !append) {
            el.grid.innerHTML = '<div class="msg">No se encontraron películas</div>';
            return;
        }
        d.data.forEach(m => el.grid.appendChild(createCard(m)));
        state.movies = append ? state.movies.concat(d.data) : d.data;
        state.page++;
        state.hasMore = d.hasMore;
    }).catch(() => {
        if (!append) el.grid.innerHTML = '<div class="msg">Error al cargar</div>';
    }).finally(() => {
        state.loading = false;
    });
}

function renderMovies() {
    el.grid.innerHTML = '';
    state.movies.forEach(m => el.grid.appendChild(createCard(m)));
}

function createCard(m) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<img data-src="' + esc(m.poster) + '" alt="">' +
                     '<div class="card-title">' + esc(m.title) + '</div>';
    const img = card.querySelector('img');
    imgObserver.observe(img);
    card.addEventListener('click', () => openPlayer(m));
    return card;
}

function openPlayer(movie) {
    state.currentMovie = movie;
    state.currentView = 'player';
    history.pushState({ view: 'player' }, '', '#player');
    el.playerTitle.textContent = movie.title;
    el.player.classList.add('active');
    el.pErr.classList.remove('show');
    el.pLoad.classList.add('show');
    el.pLoadTxt.textContent = 'Conectando...';
    state.retry = 0;

    let url = movie.url;
    if (url.startsWith('http://') || location.protocol === 'https:') {
        url = '/video-proxy?url=' + encodeURIComponent(url);
    }
    el.vid.src = url;
    el.vid.play().catch(e => {
        if (e.name !== 'NotAllowedError') showError(e);
    });
}

function closePlayer() {
    el.vid.pause();
    el.vid.removeAttribute('src');
    el.vid.load();
    el.player.classList.remove('active');
    state.currentView = 'home';
    state.currentMovie = null;
    history.pushState({ view: 'home' }, '', '#home');
}

function showError(e) {
    el.pLoad.classList.remove('show');
    el.pErr.classList.add('show');
    el.pErrTxt.textContent = e && e.message ? e.message : 'Error de reproducción';
}

el.vid.onloadstart = () => {
    el.pLoad.classList.add('show');
    el.pErr.classList.remove('show');
    el.pLoadTxt.textContent = 'Cargando...';
};
el.vid.oncanplay = () => {
    el.pLoad.classList.remove('show');
    state.retry = 0;
};
el.vid.onwaiting = () => {
    el.pLoad.classList.add('show');
    el.pLoadTxt.textContent = 'Buffering...';
};
el.vid.onplaying = () => el.pLoad.classList.remove('show');
el.vid.onerror = () => {
    const err = el.vid.error;
    if (err && err.code === 2 && state.retry < 2) {
        state.retry++;
        el.pLoadTxt.textContent = 'Reintentando...';
        setTimeout(() => {
            el.vid.play().catch(showError);
        }, 1500);
    } else {
        showError(err);
    }
};
el.pRetry.onclick = () => {
    el.pErr.classList.remove('show');
    el.pLoad.classList.add('show');
    el.vid.play().catch(showError);
};

function esc(s) {
    return s ? String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]) : '';
}

init();
})();
</script></html>`)
);

app.listen(PORT, "0.0.0.0", () =>
  console.log(
    "🎬 Movies+ → Puerto " + PORT + " | " + MOVIES.length + " películas"
  )
);
