const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 5000;
let MOVIES = [];

function isSpanish(title) {
    const t = title;
    // Tier 1: accented Spanish characters or ñ
    if (/[áéíóúüñÁÉÍÓÚÜÑ¿¡]/.test(t)) return true;
    // Tier 2: unambiguous Spanish words (word boundaries)
    if (/\b(los|las|del|una|que|por|sobre|entre|cuando|también|hay|pero|nunca|siempre|aquí|allí|ahora|después|antes|grande|pequeño|negro|blanco|rojo|azul|verde|amor|vida|muerte|noche|hombre|mujer|mundo|tierra|cielo|fuego|agua|corazón|hermano|hermana|padre|madre|hijo|hija|señor|señora|diablo|ángel|alma|fantasma|maldito|maldita|perdido|perdida|salvaje|bella|bello|secreto|verdad|sangre|ciudad|guerra|venganza|traición|familia|viaje|regreso|ladrón|detective|policía|capitán|soldado|general|navidad|fiesta|loco|loca|sueño|miedo|peligro|fuerza|poder|silencio|oscuro|oscura|eterno|eterna|primero|primera|último|última)\b/i.test(t)) return true;
    // Tier 3: starts with clear Spanish articles/prepositions
    if (/^(el|la|lo|los|las|un|una|en|al)\s/i.test(t)) return true;
    return false;
}

function classifyGenre(title) {
    const t = title.toLowerCase();
    const has = (...words) => words.some(w => t.includes(w));

    if (has('naruto','dragon ball','one piece','bleach','attack on titan','demon slayer',
            'my hero academia','sword art','jujutsu','fullmetal','hunter x hunter',
            'fairy tail','death note','evangelion','pokemon','digimon','boku no',
            'shingeki','boruto','tokyo ghoul','chainsaw man','spy x family','isekai',
            'manga','shonen','seinen','hentai','ova ','ova:','anime','one punch',
            'kimetsu','gintama','rezero','re:zero','konosuba','overlord','sao:',
            'danmachi','steins','cowboy bebop','akira','ghost in the shell','spirited',
            'howl','princess mononoke','my neighbor','totoro','your name','weathering'))
        return 'Anime';

    if (has('horror','terror','zombie','haunted','haunting','paranormal','exorcis',
            'demon','devil','satan','cursed','curse','possession','possessed',
            'nightmare','slasher','scream','fear','creep','scare','scarey','scary',
            'witch','vampire','werewolf','monster','killer','murderer','psycho',
            'sinister','malevolent','evil','occult','ritual','sacrifice','bloodbath',
            'gore','undead','dead','resurrection','poltergeist','apparition',
            'specter','revenant','dead house','deathly','dead by','the killing',
            'blood moon','black mass'))
        return 'Terror';

    if (has('documentary','documental','nature','wildlife','biography','biopic',
            'true story','real story','history of','historia de','national geographic',
            'discovery','explore','expedition','investigation','investigacion',
            'untold story','making of','behind the scenes','planeta','earth from',
            'planet earth','attenborough','nonfiction','non-fiction','chronicle of'))
        return 'Documental';

    if (has('animation','animated','cartoon','pixar','dreamworks','studio ghibli',
            'looney','disney','mickey','donald duck','3d animated','cgi film'))
        return 'Animación';

    if (has('sci-fi','science fiction','alien','ufo','spaceship','spacecraft',
            'interstellar','intergalactic','galaxy','cosmos','nebula','mars','jupiter',
            'quantum','android','cyborg','robot','artificial intelligence',' ai ',
            'terminator','matrix','cyberpunk','dystopia','dystopian','clone','cloning',
            'time travel','time machine','wormhole','parallel universe','multiverse',
            'extraterrestrial','starship','star wars','star trek','prometheus',
            'predator','avp','alien vs'))
        return 'Ciencia Ficción';

    if (has('comedy','comedia','funny','humor','humour','laugh','laughing',
            'hilarious','roast','stand-up','standup','slapstick','parody','parodia',
            'sitcom','mockumentary','rom-com','bromance','absurd comedy'))
        return 'Comedia';

    if (has(' war ',' guerra ',' wwii ','world war','vietnam war','civil war',
            'battle of','battlefield','combat','soldier','soldiers','military',
            'platoon','squadron','brigade','regiment','navy seal','delta force',
            'marines','commando','sniper','raid','siege','assault','airstrike',
            'trench','operation ','special forces','mercenary','mercenaries',
            'guerrilla','warfare','warzone','insurgent','resistance fighter',
            'front line','frontline','d-day','iwo jima','normandy'))
        return 'Acción';

    if (has('action','fight','fighting','kung fu','martial art','karate','judo',
            'wushu','ninja','samurai','gladiator','boxer','boxing','mma','ufc',
            'spy','espionage','agent ','secret agent','heist','getaway','chase',
            'pursuit','mission impossible','007','james bond','bourne','hitman',
            'assassin','mercenary','bounty','gunfight','shootout','explosion',
            'car chase','avengers','superhero','super hero','batman','superman',
            'spider-man','spiderman','iron man','captain america','thor ','hulk',
            'x-men','guardians','justice league','wonder woman','black panther',
            'fast and furious','john wick','die hard','rambo','terminator',
            'transformers','godzilla','king kong','monster vs'))
        return 'Acción';

    if (has('romance','romantic','falling in love','love story','amor eterno',
            'te amo','mi amor','wedding','boda','valentine','first love',
            'second chance','love letter','sweetheart','beloved','crush','soulmate',
            'my heart','tu corazon','corazón','novio','novia','boyfriend','girlfriend',
            'marriage','casamiento','honeymoon','engagement','fiancé'))
        return 'Romance';

    if (has('love','amor ','amour') && !has('war','action','horror','terror'))
        return 'Romance';

    if (has('thriller','suspense','suspenseful','murder mystery','whodunit',
            'detective','investigation','investigator','kidnap','abduct','missing',
            'disappeared','disappear','conspiracy','cover-up','cover up','espionage',
            'blackmail','interrogation','fugitive','on the run','manhunt',
            'serial killer','profiler','criminal mind','dark secret','hidden truth'))
        return 'Thriller';

    if (has('mystery','enigma','unsolved','puzzle','clue','whodunit','cold case',
            'crime scene','forensic','csi ','ncis ','evidence','witness'))
        return 'Thriller';

    if (has('fantasy','fantasia','magic','magical','wizard','witch','sorcerer',
            'sorcery','dragon','dragons','kingdom','medieval','quest','prophecy',
            'myth','mythology','mythical','legend','legendary','fairy','elf','elves',
            'dwarf','orc','goblin','troll','enchanted','enchantment','realm',
            'dungeon','swords','sword and','epic quest','chosen one','dark lord'))
        return 'Fantasía';

    if (has('drama','dramatic','tragedy','tragic','struggle','hardship','overcome',
            'survivor','survival story','based on','inspired by','true events',
            'coming of age','growing up','family drama','social drama','inner conflict',
            'redemption','forgiveness','acceptance','identity','mental health',
            'depression','addiction','recovery','abuse','domestic','betrayal',
            'reconciliation','grief','mourning','loss of'))
        return 'Drama';

    return 'Otros';
}

try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, process.env.DATA_FILE || 'data.json'), 'utf8'));
    MOVIES = data.map((m, i) => {
        const title = m.title || 'Sin título';
        return { id: i, title, poster: m.logo || '', url: m.url || '', genre: classifyGenre(title), spanish: isSpanish(title) };
    });
    const counts = {};
    MOVIES.forEach(m => { counts[m.genre] = (counts[m.genre] || 0) + 1; });
    console.log(`✓ ${MOVIES.length} películas | Géneros:`, counts);
} catch (e) { console.error('Error:', e.message); }

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Accept-Ranges,Content-Length');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

const translationCache = new Map();

app.get('/api/translate', async (req, res) => {
    let { texts, from = 'es', to = 'en' } = req.query;
    if (!texts) return res.json({ translations: [] });
    const arr = Array.isArray(texts) ? texts : [texts];
    if (!arr.length) return res.json({ translations: [] });

    const results = new Array(arr.length);
    const toFetch = [];

    arr.forEach((t, i) => {
        const key = `${from}|${to}|${t}`;
        if (translationCache.has(key)) {
            results[i] = translationCache.get(key);
        } else {
            toFetch.push({ i, t, key });
        }
    });

    const BATCH = 5;
    for (let b = 0; b < toFetch.length; b += BATCH) {
        const chunk = toFetch.slice(b, b + BATCH);
        const combined = chunk.map(x => x.t).join(' ||| ');
        try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(combined)}&langpair=${from}|${to}`;
            const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
            const data = await r.json();
            if (data.responseStatus === 200) {
                const parts = data.responseData.translatedText.split(' ||| ');
                chunk.forEach((x, ci) => {
                    const tr = (parts[ci] || x.t).trim();
                    translationCache.set(x.key, tr);
                    results[x.i] = tr;
                });
            } else {
                chunk.forEach(x => { results[x.i] = x.t; });
            }
        } catch (e) {
            chunk.forEach(x => { results[x.i] = x.t; });
        }
    }

    res.json({ translations: results });
});

const GENRE_ORDER = ['Todas','Español','Acción','Terror','Comedia','Drama','Anime','Ciencia Ficción','Romance','Thriller','Fantasía','Animación','Documental','Otros'];

app.get('/api/genres', (req, res) => {
    const counts = { 'Todas': MOVIES.length, 'Español': MOVIES.filter(m => m.spanish).length };
    MOVIES.forEach(m => { counts[m.genre] = (counts[m.genre] || 0) + 1; });
    const genres = GENRE_ORDER.filter(g => counts[g] > 0).map(g => ({ name: g, count: counts[g] || 0 }));
    res.json(genres);
});

app.get('/api/movies', (req, res) => {
    const { page = 0, limit = 200, q = '', random, genre = '' } = req.query;
    let list = [...MOVIES];
    if (q) list = list.filter(m => m.title.toLowerCase().includes(q.toLowerCase()));
    if (genre && genre !== 'Todas') {
        if (genre === 'Español') list = list.filter(m => m.spanish);
        else list = list.filter(m => m.genre === genre);
    }
    if (random === 'true') list.sort(() => Math.random() - 0.5);
    const start = page * limit;
    res.json({ total: list.length, hasMore: start + +limit < list.length, data: list.slice(start, start + +limit) });
});

app.get('/video-proxy', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).end();
    let parsed;
    try { parsed = new URL(decodeURIComponent(url)); } catch { return res.status(400).end(); }
    const client = parsed.protocol === 'https:' ? https : http;
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Accept-Encoding': 'identity', 'Referer': parsed.origin + '/' };
    if (req.headers.range) headers['Range'] = req.headers.range;
    const proxyReq = client.request({ hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname + parsed.search, headers, timeout: 30000 }, proxyRes => {
        if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
            proxyRes.destroy();
            return res.redirect(307, '/video-proxy?url=' + encodeURIComponent(proxyRes.headers.location));
        }
        const h = { 'Content-Type': proxyRes.headers['content-type'] || 'video/mp4', 'Accept-Ranges': 'bytes' };
        if (proxyRes.headers['content-length']) h['Content-Length'] = proxyRes.headers['content-length'];
        if (proxyRes.headers['content-range']) h['Content-Range'] = proxyRes.headers['content-range'];
        res.writeHead(proxyRes.statusCode, h);
        proxyRes.pipe(res);
        proxyRes.on('error', () => res.end());
    });
    proxyReq.on('error', () => !res.headersSent && res.status(502).end());
    proxyReq.on('timeout', () => { proxyReq.destroy(); !res.headersSent && res.status(504).end(); });
    req.on('close', () => proxyReq.destroy());
    proxyReq.end();
});

app.get('/', (req, res) => res.send(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Movies+</title><style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none;-webkit-tap-highlight-color:transparent}
:root{--p:#f5c518;--bg:#0a0a0a;--s:#161616;--c:#1a1a1a;--b:#2a2a2a;--t:#e0e0e0;--t2:#888}
html,body{background:var(--bg);color:var(--t);font-family:system-ui,sans-serif;height:100%;overflow:hidden}
#app{height:100%;display:flex;flex-direction:column}
.hdr{display:flex;align-items:center;gap:10px;padding:12px;background:var(--s);border-bottom:1px solid var(--b)}
.logo{color:var(--p);font-weight:700;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.2s}
.logo:hover,.logo.f{background:rgba(245,197,24,0.1)}
.srch{flex:1;background:var(--bg);border:2px solid var(--b);color:var(--t);padding:10px;border-radius:8px;font-size:16px;outline:none;transition:border-color 0.2s}
.srch:focus,.srch.f{border-color:var(--p)}
.btn{background:var(--c);border:2px solid var(--b);color:var(--t);padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;transition:all 0.2s}
.btn:hover,.btn.f{background:var(--p);color:#000;border-color:var(--p)}
.stats{color:var(--t2);font-size:12px;margin-left:auto}
.lang-btn{background:var(--c);border:2px solid var(--b);color:var(--t);padding:10px 14px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;transition:all 0.2s;letter-spacing:1px}
.lang-btn:hover,.lang-btn.f{background:var(--p);color:#000;border-color:var(--p)}
.lang-btn.active{background:var(--p);color:#000;border-color:var(--p)}
.translating{opacity:0.5;pointer-events:none}
.main{flex:1;overflow-y:auto;padding:10px;-webkit-overflow-scrolling:touch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.card{position:relative;aspect-ratio:2/3;background:var(--c);border-radius:6px;overflow:hidden;border:2px solid transparent;cursor:pointer;transition:transform 0.15s, border-color 0.15s}
.card:hover{transform:scale(1.02)}
.card.f{border-color:var(--p);transform:scale(1.05);box-shadow:0 0 15px rgba(245,197,24,.3);z-index:10}
.card img{width:100%;height:100%;object-fit:cover;background:linear-gradient(45deg,#1a1a1a 25%,#222 25%,#222 50%,#1a1a1a 50%,#1a1a1a 75%,#222 75%,#222);background-size:20px 20px;opacity:0;transition:opacity 0.3s ease-in-out}
.card img.loaded{opacity:1}
.card-t{position:absolute;bottom:0;left:0;right:0;padding:20px 6px 6px;background:linear-gradient(transparent,#000);font-size:11px;font-weight:600;opacity:0;transform:translateY(5px);transition:opacity 0.2s, transform 0.2s}
.card.f .card-t{opacity:1;transform:translateY(0)}
.player{position:fixed;inset:0;background:#000;z-index:200;display:none}
.player.open{display:flex;flex-direction:column}
video{flex:1;width:100%;background:#000}
.p-ui{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;opacity:1;transition:.2s;background:linear-gradient(#000a,transparent 15%,transparent 85%,#000a);pointer-events:none}
.p-ui>*{pointer-events:auto}.p-ui.hide{opacity:0}.p-ui.hide>*{pointer-events:none}
.p-top{padding:12px;padding-top:max(12px,env(safe-area-inset-top))}
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
.p-btn:hover,.p-btn:active,.p-btn.f{background:var(--p);color:#000}
.p-btn.main{width:52px;height:52px;font-size:18px}
.p-load,.p-err{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;display:none}
.p-load.show,.p-err.show{display:block}
.p-spin{width:36px;height:36px;border:3px solid #333;border-top-color:var(--p);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 10px}
.msg{text-align:center;padding:40px;color:var(--t2)}
.msg.load::after{content:'';display:block;width:20px;height:20px;margin:12px auto 0;border:2px solid #333;border-top-color:var(--p);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.genre-bar{display:flex;gap:6px;padding:8px 12px;background:var(--s);border-bottom:1px solid var(--b);overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.genre-bar::-webkit-scrollbar{display:none}
.genre-pill{flex-shrink:0;background:var(--c);border:2px solid var(--b);color:var(--t2);padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap}
.genre-pill:hover{border-color:var(--p);color:var(--t)}
.genre-pill.active{background:var(--p);color:#000;border-color:var(--p)}
.genre-pill.f{border-color:var(--p);color:var(--t);box-shadow:0 0 0 2px rgba(245,197,24,.4);transform:scale(1.05)}
.genre-pill.active.f{box-shadow:0 0 0 3px rgba(245,197,24,.6)}
.genre-pill .cnt{opacity:0.7;font-size:10px;margin-left:4px}
</style></head><body><div id="app">
<div class="hdr">
    <div class="logo f" id="logo">MOVIES+</div>
    <input class="srch" id="srch" placeholder="Buscar..." autocomplete="off">
    <button class="btn" id="mix">🎲</button>
    <button class="lang-btn" id="lang" title="Cambiar idioma / Switch language">ES</button>
    <span class="stats" id="stats"></span>
</div>
<div class="genre-bar" id="genreBar"></div>
<div class="main" id="main"><div class="grid" id="grid"><div class="msg load">Cargando</div></div></div>
<div class="player" id="player">
<video id="vid" playsinline webkit-playsinline></video>
<div class="p-load" id="pLoad"><div class="p-spin"></div><div id="pLoadTxt">Cargando...</div></div>
<div class="p-err" id="pErr"><div>Error</div><div style="font-size:11px;color:#888;margin:8px 0" id="pErrTxt"></div><button class="btn" id="pRetry">Reintentar</button> <button class="btn" id="pBack">Volver</button></div>
<div class="p-center" id="pInd"></div>
<div class="p-ui" id="pUi">
<div class="p-top"><div class="p-title" id="pTitle"></div></div>
<div class="p-bottom">
<div class="p-prog"><span class="p-time" id="pCur">0:00</span><div class="p-bar" id="pBar"><div class="p-bar-buf" id="pBuf"></div><div class="p-bar-fill" id="pFill"></div></div><span class="p-time" id="pDur">0:00</span></div>
<div class="p-ctrl"><button class="p-btn" id="pRw">-10</button><button class="p-btn main" id="pPp">▶</button><button class="p-btn" id="pFw">+10</button></div>
</div></div></div></div>
<script>
(function(){
const $=id=>document.getElementById(id);
const el={
    logo:$('logo'), grid:$('grid'), main:$('main'), srch:$('srch'), mix:$('mix'), stats:$('stats'),
    lang:$('lang'), genreBar:$('genreBar'),
    player:$('player'), vid:$('vid'), pUi:$('pUi'), pTitle:$('pTitle'), pLoad:$('pLoad'), 
    pLoadTxt:$('pLoadTxt'), pErr:$('pErr'), pErrTxt:$('pErrTxt'), pInd:$('pInd'), pBar:$('pBar'), 
    pFill:$('pFill'), pBuf:$('pBuf'), pCur:$('pCur'), pDur:$('pDur'), pRw:$('pRw'), pPp:$('pPp'), 
    pFw:$('pFw'), pRetry:$('pRetry'), pBack:$('pBack')
};

const S={
    view:'home', movies:[],
    focused:null, lastFocused:null,
    playing:false, retry:0,
    imgObserver:null, cols:5,
    lang:'es', translating:false, genre:'Todas'
};

// ===== TRADUCCIÓN =====
const UI_STRINGS = {
    es: {
        search_placeholder: 'Buscar...',
        loading: 'Cargando',
        loading_dots: 'Cargando...',
        connecting: 'Conectando...',
        retrying: 'Reintentando...',
        error_load: 'Error al cargar',
        error: 'Error',
        retry_btn: 'Reintentar',
        back_btn: 'Volver',
        no_image: 'Sin imagen',
        movies_label: m => m + ' películas',
    },
    en: {
        search_placeholder: 'Search...',
        loading: 'Loading',
        loading_dots: 'Loading...',
        connecting: 'Connecting...',
        retrying: 'Retrying...',
        error_load: 'Failed to load',
        error: 'Error',
        retry_btn: 'Retry',
        back_btn: 'Back',
        no_image: 'No image',
        movies_label: m => m + ' movies',
    }
};

const titleCache = new Map(); // originalTitle -> { es, en }

function applyUIStrings(lang) {
    const s = UI_STRINGS[lang];
    el.srch.placeholder = s.search_placeholder;
    el.pRetry.textContent = s.retry_btn;
    el.pBack.textContent = s.back_btn;
    const statsNum = el.stats.textContent.match(/\d+/);
    if (statsNum) el.stats.textContent = s.movies_label(statsNum[0]);
    document.documentElement.lang = lang === 'en' ? 'en' : 'es';
}

async function translateCards(lang) {
    if (S.translating) return;
    const cards = [...el.grid.querySelectorAll('.card')];
    if (!cards.length) return;

    const needsFetch = cards.filter((c, i) => {
        const orig = c.dataset.origTitle;
        if (!orig) return false;
        if (lang === 'es') return false;
        return !titleCache.has(orig) || !titleCache.get(orig).en;
    });

    if (needsFetch.length > 0) {
        S.translating = true;
        el.lang.classList.add('translating');
        const titles = needsFetch.map(c => c.dataset.origTitle);

        try {
            const params = titles.map(t => 'texts=' + encodeURIComponent(t)).join('&');
            const r = await fetch('/api/translate?' + params + '&from=es&to=en');
            const data = await r.json();
            titles.forEach((t, i) => {
                if (!titleCache.has(t)) titleCache.set(t, {});
                titleCache.get(t).en = data.translations[i] || t;
            });
        } catch(e) {}

        S.translating = false;
        el.lang.classList.remove('translating');
    }

    cards.forEach(c => {
        const orig = c.dataset.origTitle;
        if (!orig) return;
        const titleEl = c.querySelector('.card-t');
        if (!titleEl) return;
        if (lang === 'es') {
            titleEl.textContent = orig;
        } else {
            const cached = titleCache.get(orig);
            titleEl.textContent = (cached && cached.en) ? cached.en : orig;
        }
    });
}

async function toggleLang() {
    S.lang = S.lang === 'es' ? 'en' : 'es';
    el.lang.textContent = S.lang.toUpperCase();
    el.lang.classList.toggle('active', S.lang === 'en');
    applyUIStrings(S.lang);
    await translateCards(S.lang);
}

el.lang.onclick = toggleLang;

// ===== INICIALIZACIÓN =====
history.replaceState({v:'home'},'','#home');
window.onpopstate=()=>{if(S.view==='player'){closeP();history.pushState({v:'home'},'','#home')}};

// ===== GÉNEROS =====
function loadGenres() {
    fetch('/api/genres').then(r=>r.json()).then(genres=>{
        el.genreBar.innerHTML = '';
        genres.forEach(g => {
            const pill = document.createElement('button');
            pill.className = 'genre-pill' + (g.name === S.genre ? ' active' : '');
            pill.innerHTML = esc(g.name) + '<span class="cnt">(' + g.count + ')</span>';
            pill.onclick = () => {
                if (S.genre === g.name) return;
                S.genre = g.name;
                el.genreBar.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                el.srch.value = '';
                loadMovies(false);
            };
            el.genreBar.appendChild(pill);
        });
    }).catch(() => {});
}

function init() {
    loadGenres();

    fetch('/api/movies?limit=200&random=true').then(r=>r.json()).then(d=>{
        const s = UI_STRINGS[S.lang];
        el.stats.textContent = s.movies_label(d.total);
        el.grid.innerHTML='';
        S.movies=d.data;
        d.data.forEach(m=>el.grid.appendChild(mkCard(m)));

        calcCols();
        initLazyLoading();
        setTimeout(focusFirst, 300);

    }).catch(()=>el.grid.innerHTML='<div class="msg">Error</div>');
}

// ===== LAZY LOADING CON ANIMACIÓN SUAVE =====
function initLazyLoading() {
    if(S.imgObserver) S.imgObserver.disconnect();

    S.imgObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting){
                const img = entry.target;
                if(img.dataset.src && !img.classList.contains('loaded')) {
                    loadImageWithAnimation(img);
                }
                S.imgObserver.unobserve(img);
            }
        });
    }, {
        rootMargin: '300px 0px', // Cargar antes de que entren al viewport
        threshold: 0.01
    });

    // Observar todas las imágenes
    document.querySelectorAll('.card img[data-src]').forEach(img => {
        S.imgObserver.observe(img);
    });
}

function loadImageWithAnimation(img) {
    if(!img.dataset.src) return;

    const src = img.dataset.src;
    const imgEl = new Image();

    imgEl.onload = () => {
        img.src = src;
        // Forzar reflow para activar la animación
        void img.offsetWidth;
        img.classList.add('loaded');
        img.style.background = 'none';
    };

    imgEl.onerror = () => {
        // Usar placeholder SVG con animación
        img.src = 'data:image/svg+xml;base64,' + btoa(
            '<svg xmlns="http://www.w3.org/2000/svg" width="130" height="195" viewBox="0 0 130 195">' +
            '<rect width="130" height="195" fill="#1a1a1a"/>' +
            '<text x="65" y="95" font-family="Arial" font-size="12" fill="#888" text-anchor="middle">Sin imagen</text>' +
            '</svg>'
        );
        img.classList.add('loaded');
        img.style.background = 'none';
    };

    // Pequeño delay para mostrar la animación de carga
    setTimeout(() => {
        imgEl.src = src;
    }, 100);
}

function preloadAdjacentImages(index) {
    const cards = [...el.grid.querySelectorAll('.card')];
    if(!cards.length) return;

    // Cargar imágenes en un radio de 2 elementos
    for(let i = Math.max(0, index - 2); i <= Math.min(cards.length - 1, index + 2); i++) {
        const img = cards[i].querySelector('img[data-src]');
        if(img && img.dataset.src && !img.classList.contains('loaded')) {
            loadImageWithAnimation(img);
        }
    }
}

// ===== NAVEGACIÓN UNIFICADA (TV remote) =====
function getFocusable() {
    return [...document.querySelectorAll('#logo, #srch, #mix, #lang, .genre-pill, .card')]
        .filter(e => e.offsetParent !== null);
}

function focus(elem) {
    if (S.focused) S.focused.classList.remove('f');
    S.focused = elem;
    if (!elem) return;
    elem.classList.add('f');
    elem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (elem !== el.srch) el.srch.blur();
    if (elem.classList.contains('card')) {
        const cards = [...el.grid.querySelectorAll('.card')];
        const idx = cards.indexOf(elem);
        if (idx >= 0) preloadAdjacentImages(idx);
    }
}

function focusFirst() {
    const f = getFocusable();
    if (S.lastFocused && f.includes(S.lastFocused)) { focus(S.lastFocused); return; }
    const card = f.find(e => e.classList.contains('card'));
    focus(card || f[0]);
}

function saveFocus() { S.lastFocused = S.focused; }

function calcCols() {
    const c = el.grid.querySelector('.card');
    if (c) S.cols = Math.max(1, Math.floor(el.grid.offsetWidth / (c.offsetWidth + 8)));
}

function move(dir) {
    const f = getFocusable();
    if (f.indexOf(S.focused) < 0) { focusFirst(); return; }

    const cards = f.filter(e => e.classList.contains('card'));
    const pills = f.filter(e => e.classList.contains('genre-pill'));
    const hdr   = f.filter(e => ['logo','srch','mix','lang'].includes(e.id));

    const ci = cards.indexOf(S.focused);
    const pi = pills.indexOf(S.focused);
    const hi = hdr.indexOf(S.focused);

    if (ci >= 0) {
        if (dir === 'up') {
            if (ci < S.cols) {
                const ap = pills.find(p => p.classList.contains('active')) || pills[0];
                focus(ap || hdr[hdr.length - 1] || hdr[0]);
            } else { focus(cards[ci - S.cols]); }
        }
        if (dir === 'down' && ci + S.cols < cards.length) focus(cards[ci + S.cols]);
        if (dir === 'left'  && ci > 0) focus(cards[ci - 1]);
        if (dir === 'right' && ci < cards.length - 1) focus(cards[ci + 1]);
    } else if (pi >= 0) {
        if (dir === 'up')   focus(hdr[hdr.length - 1] || hdr[0]);
        if (dir === 'down' && cards.length) focus(cards[0]);
        if (dir === 'left')  { pi > 0 ? focus(pills[pi - 1]) : focus(hdr[hdr.length - 1] || hdr[0]); }
        if (dir === 'right' && pi < pills.length - 1) focus(pills[pi + 1]);
    } else if (hi >= 0) {
        if (dir === 'left'  && hi > 0) focus(hdr[hi - 1]);
        if (dir === 'right' && hi < hdr.length - 1) focus(hdr[hi + 1]);
        if (dir === 'down') {
            const ap = pills.find(p => p.classList.contains('active')) || pills[0];
            focus(ap || (cards.length ? cards[0] : null));
        }
    }
}

function activate() {
    if (!S.focused) return;
    if (S.focused === el.srch) { el.srch.focus(); return; }
    S.focused.click();
}

document.addEventListener('keydown', e => {
    const k = e.key;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' ','Escape','Backspace','Tab'].includes(k)) {
        e.preventDefault(); e.stopPropagation();
    }
    if (S.view === 'player') { playerKey(k); return; }

    if (document.activeElement === el.srch) {
        if (k === 'ArrowDown') {
            el.srch.blur();
            const ap = document.querySelector('.genre-pill.active') || document.querySelector('.genre-pill');
            if (ap) focus(ap); else focusFirst();
        }
        if (k === 'Escape') { el.srch.value = ''; loadMovies(false); }
        return;
    }

    switch (k) {
        case 'ArrowUp':    move('up');    break;
        case 'ArrowDown':  move('down');  break;
        case 'ArrowLeft':  move('left');  break;
        case 'ArrowRight': move('right'); break;
        case 'Enter': case ' ': activate(); break;
        case 'Tab': S.focused === el.srch ? move('right') : focusFirst(); break;
        case 'Escape':
        case 'Backspace': {
            const cur = S.focused;
            if (cur && cur.classList.contains('card')) {
                const ap = document.querySelector('.genre-pill.active') || document.querySelector('.genre-pill');
                if (ap) focus(ap);
            } else if (cur && cur.classList.contains('genre-pill')) {
                focus(el.lang || el.mix);
            }
            break;
        }
    }
}, true);

el.logo.addEventListener('click', () => location.reload());

// ===== BÚSQUEDA Y CARGA DE PELÍCULAS =====
let searchTimer;
el.srch.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadMovies(false), 400);
};

el.mix.onclick = () => loadMovies(true);

function loadMovies(random) {
    const s = UI_STRINGS[S.lang];
    el.grid.innerHTML = '<div class="msg load">' + s.loading + '</div>';
    const q = el.srch.value.trim();
    const genreParam = S.genre && S.genre !== 'Todas' ? '&genre=' + encodeURIComponent(S.genre) : '';
    fetch('/api/movies?limit=200' + (q ? '&q=' + encodeURIComponent(q) : '') + (random ? '&random=true' : '') + genreParam)
        .then(r => r.json())
        .then(d => {
            el.grid.innerHTML = '';
            S.movies = d.data;
            el.stats.textContent = UI_STRINGS[S.lang].movies_label(d.total);

            d.data.forEach((m, i) => {
                setTimeout(() => {
                    el.grid.appendChild(mkCard(m));
                }, i * 10);
            });

            setTimeout(() => {
                calcCols();
                initLazyLoading();
                focusFirst();
                if (S.lang === 'en') translateCards('en');
            }, 100);
        })
        .catch(() => {
            el.grid.innerHTML = '<div class="msg">' + UI_STRINGS[S.lang].error_load + '</div>';
            focus(el.srch);
        });
}

function mkCard(m) {
    const d = document.createElement('div');
    d.className = 'card';
    d.tabIndex = -1;
    d.dataset.origTitle = m.title;

    const posterSrc = m.poster || '';
    const displayTitle = S.lang === 'en' && titleCache.has(m.title) && titleCache.get(m.title).en
        ? titleCache.get(m.title).en : m.title;
    d.innerHTML = '<img data-src="' + esc(posterSrc) + '" alt="' + esc(m.title) + '">' +
                  '<div class="card-t">' + esc(displayTitle) + '</div>';

    d.onclick = () => {
        const idx = [...el.grid.querySelectorAll('.card')].indexOf(d);
        if(idx >= 0 && S.movies[idx]) play(S.movies[idx]);
    };

    return d;
}

// ===== REPRODUCTOR =====
function play(m) {
    saveFocus();
    S.view = 'player';
    S.retry = 0;
    history.pushState({v:'player'},'','#player');
    el.pErr.classList.remove('show');
    el.pLoad.classList.add('show');
    el.pLoadTxt.textContent = 'Conectando...';
    el.pTitle.textContent = m.title;
    el.player.classList.add('open');
    el.vid.pause();
    el.vid.removeAttribute('src');
    el.vid.load();

    setTimeout(() => {
        let u = m.url;
        if(u.startsWith('http://') || location.protocol === 'https:') {
            u = '/video-proxy?url=' + encodeURIComponent(u);
        }
        el.vid.src = u;
        el.vid.play().catch(playErr);
        showUI();
    }, 50);
}

function closeP() {
    el.vid.pause();
    el.vid.removeAttribute('src');
    el.vid.load();
    el.player.classList.remove('open');
    S.view = 'home';

    setTimeout(focusFirst, 50);
}

el.vid.onloadstart = () => {
    el.pLoad.classList.add('show');
    el.pErr.classList.remove('show');
    el.pLoadTxt.textContent = 'Conectando...';
};

el.vid.oncanplay = () => {
    el.pLoad.classList.remove('show');
    S.retry = 0;
};

el.vid.onwaiting = () => {
    el.pLoad.classList.add('show');
    el.pLoadTxt.textContent = 'Buffering...';
};

el.vid.onplaying = () => {
    el.pLoad.classList.remove('show');
    S.playing = true;
    el.pPp.textContent = '⏸';
};

el.vid.onpause = () => {
    S.playing = false;
    el.pPp.textContent = '▶';
};

el.vid.ontimeupdate = () => {
    if(!el.vid.duration) return;
    el.pFill.style.width = (el.vid.currentTime / el.vid.duration * 100) + '%';
    el.pCur.textContent = fmt(el.vid.currentTime);
};

el.vid.ondurationchange = () => el.pDur.textContent = fmt(el.vid.duration);

el.vid.onprogress = () => {
    try {
        if(el.vid.buffered.length) {
            el.pBuf.style.width = (el.vid.buffered.end(el.vid.buffered.length - 1) / el.vid.duration * 100) + '%';
        }
    } catch(e) {}
};

el.vid.onerror = () => {
    const err = el.vid.error;
    el.pErrTxt.textContent = err ? ['','Abortado','Red','Decode','No soportado'][err.code] || 'Error' : 'Error';
    if(err && err.code === 2 && S.retry < 2) {
        S.retry++;
        el.pLoadTxt.textContent = 'Reintentando...';
        setTimeout(retry, 1500);
    } else {
        el.pLoad.classList.remove('show');
        el.pErr.classList.add('show');
    }
};

el.vid.onended = () => {
    S.playing = false;
    el.pPp.textContent = '▶';
    showUI();
};

function playErr(e) {
    if(e.name === 'NotAllowedError') showUI();
    else if(e.name === 'NotSupportedError') {
        el.pErrTxt.textContent = 'No soportado';
        el.pErr.classList.add('show');
        el.pLoad.classList.remove('show');
    }
}

function retry() {
    el.pErr.classList.remove('show');
    el.pLoad.classList.add('show');
    const t = el.vid.currentTime || 0;
    el.vid.pause();
    el.vid.load();
    setTimeout(() => {
        el.vid.currentTime = t;
        el.vid.play().catch(playErr);
    }, 300);
}

function playerKey(k) {
    showUI();
    if(k === 'ArrowLeft') seek(-10);
    else if(k === 'ArrowRight') seek(10);
    else if(k === 'ArrowUp') vol(.1);
    else if(k === 'ArrowDown') vol(-.1);
    else if(k === 'Enter' || k === ' ') toggle();
    else if(k === 'Escape' || k === 'Backspace') history.back();
}

function toggle() {
    if(el.vid.paused) {
        el.vid.play().catch(playErr);
        showInd('▶');
    } else {
        el.vid.pause();
        showInd('⏸');
    }
}

function seek(s) {
    if(!el.vid.duration) return;
    el.vid.currentTime = Math.max(0, Math.min(el.vid.currentTime + s, el.vid.duration));
    showInd((s > 0 ? '+' : '') + s + 's');
}

function vol(d) {
    try {
        el.vid.volume = Math.max(0, Math.min(1, el.vid.volume + d));
    } catch(e) {}
}

let hideT, indT;
function showInd(t) {
    el.pInd.textContent = t;
    el.pInd.classList.add('show');
    clearTimeout(indT);
    indT = setTimeout(() => el.pInd.classList.remove('show'), 500);
}

function showUI() {
    el.pUi.classList.remove('hide');
    clearTimeout(hideT);
    hideT = setTimeout(() => {
        if(S.playing) el.pUi.classList.add('hide');
    }, 3000);
}

function fmt(s) {
    if(!s || !isFinite(s)) return '0:00';
    const h = ~~(s / 3600);
    const m = ~~(s % 3600 / 60);
    const ss = ~~(s % 60);
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0') : m + ':' + String(ss).padStart(2, '0');
}

// Eventos del reproductor
el.pPp.onclick = toggle;
el.pRw.onclick = () => seek(-10);
el.pFw.onclick = () => seek(10);
el.pBar.onclick = e => {
    const r = el.pBar.getBoundingClientRect();
    if(el.vid.duration) el.vid.currentTime = (e.clientX - r.left) / r.width * el.vid.duration;
};
el.pRetry.onclick = retry;
el.pBack.onclick = () => history.back();
el.player.onclick = e => {
    if(e.target === el.vid) {
        toggle();
        showUI();
    }
};
el.player.onmousemove = showUI;

let tx, ty;
el.vid.ontouchstart = e => {
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
};
el.vid.ontouchend = e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if(Math.abs(dx) > 50 && Math.abs(dy) < 50) seek(dx > 0 ? 10 : -10);
    else showUI();
};
el.pBar.ontouchstart = el.pBar.ontouchmove = e => {
    e.preventDefault();
    const r = el.pBar.getBoundingClientRect();
    if(el.vid.duration) {
        el.vid.currentTime = Math.max(0, Math.min(1, (e.touches[0].clientX - r.left) / r.width)) * el.vid.duration;
    }
};

function esc(s) {
    return s ? String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]) : '';
}

// Iniciar aplicación
init();

// Recalcular columnas al redimensionar
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(calcCols, 150);
});
})();
</script></body></html>`));

app.listen(PORT,'0.0.0.0',()=>console.log('🎬 Movies+ → Puerto '+PORT+' | '+MOVIES.length+' películas'));
