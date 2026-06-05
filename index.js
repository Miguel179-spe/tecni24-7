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

const config = { DATA_FILE: process.env.DATA_FILE || 'data.json' };

// ===== CATEGORÍAS =====
const CATEGORIES = [
    'Acción',
    'Adaptaciones de libros',
    'Anime',
    'Astrología',
    'Cine de intriga',
    'Clásicas',
    'Cortos',
    'De Hollywood',
    'Deportes',
    'Documentales',
    'Dramas',
    'En Español',
    'Estados de ánimo',
    'Fantasía',
    'Fe y espiritualidad',
    'Independientes',
    'Internacionales',
    'Latinoamericanas',
    'Los favoritos de la crítica',
    'Música y musicales',
    'Orgullo',
    'Para reír',
    'Para ver en familia',
    'Pelis policiales',
    'Romances',
    'Sci-fi',
    'Terror'
];

const KEYWORDS = {
    'Acción': [
        'action','fight','battle','war','combat','mission','strike','assault','siege',
        'agent','spy','heist','sniper','soldier','warrior','hunter','shooter','raid',
        'force','fury','blaze','explosive','ambush','commando','operative','takeover',
        'revenge','retaliation','attack','operation','invasion','resistance'
    ],
    'Adaptaciones de libros': [
        'based on','from the novel','the book','chapter','volume','adaptation',
        'chronicles','saga','trilogy','part','book one','book two','tales of'
    ],
    'Anime': [
        'anime','manga','shonen','shojo','ghibli','gundam','dragon ball','naruto',
        'one piece','bleach','attack on titan','fullmetal','pokemon','digimon',
        'sailor moon','my hero','demon slayer','jujutsu','isekai','kimetsu','kawaii',
        'samurai','ninja','shinobi','otaku','sensei','san ','chan ','kun '
    ],
    'Astrología': [
        'astro','horoscope','zodiac','star sign','cosmos','celestial','lunar','solar',
        'universe','galaxy','constellation','planetary','spiritual astro','tarot'
    ],
    'Cine de intriga': [
        'thriller','mystery','suspense','conspiracy','secret','hidden','unknown',
        'vanish','disappear','unsolved','who killed','the truth','beneath','dark secret',
        'intriga','enigma','suspect','alibi','witness','evidence','clue','twist'
    ],
    'Clásicas': [
        '(1920)','(1930)','(1940)','(1950)','(1960)','(1970)','(1980)',
        'classic','golden age','vintage','retro','old hollywood','b&w','black and white',
        'chaplin','hitchcock','wilder','ford ','capra'
    ],
    'Cortos': [
        'short film','short:','corto','short ','mini film','animated short'
    ],
    'De Hollywood': [
        'marvel','dc ','avengers','batman','superman','spider','iron man',
        'disney','pixar','dreamworks','paramount','warner','universal','sony pictures',
        'blockbuster','superhero','franchise','cinematic universe','the sequel'
    ],
    'Deportes': [
        'sport','football','soccer','basketball','baseball','tennis','olympics',
        'athlete','champion','championship','race','marathon','boxing','wrestling',
        'ufc','wwe','elimination chamber','gold medal','world cup','tournament',
        'league','coach','team','player','game day','match','bout','fight night',
        'swim','golf','hockey','cycling','skating'
    ],
    'Documentales': [
        'documentary','true story','real story','inside','untold','story of',
        'history of','revealed','exposed','behind the scenes','making of',
        'investigation','report','the truth about','chronicles of','life of',
        'portrait of','in conversation','journey through'
    ],
    'Dramas': [
        'drama','family drama','grief','loss','sorrow','tears','struggle','survive',
        'redemption','forgiveness','broken','healing','journey','life','hope',
        'faith','believe','overcome','second chance','fresh start','new beginning'
    ],
    'En Español': [],
    'Estados de ánimo': [
        'mood','feeling','emotion','soul','heart','mind','spirit','inner','peace',
        'calm','zen','meditat','breathe','wellbeing','balance','harmony','anxiety',
        'depression','joy','happiness','sadness','melancholy','nostalgia'
    ],
    'Fantasía': [
        'fantasy','magic','wizard','witch','dragon','elf','dwarf','fairy','enchanted',
        'kingdom','realm','quest','sword','sorcery','myth','legend','fable','tale',
        'magical','spellbound','prophecy','chosen one','ancient evil','dark lord',
        'wand','potion','spell','curse','ring of','amulet','crystal'
    ],
    'Fe y espiritualidad': [
        'faith','god','jesus','christian','church','prayer','miracle','blessing',
        'holy','divine','scripture','bible','religious','spiritual','salvation',
        'redemption','heaven','soul','worship','pastor','angel','chapel',
        'can only imagine','testimony','revival','mission'
    ],
    'Independientes': [
        'indie','independent','sundance','film festival','arthouse','art house',
        'low budget','experimental','avant garde','short film','underground'
    ],
    'Internacionales': [],
    'Latinoamericanas': [
        'latino','latina','latin','colombia','mexico','argentina','peru','chile',
        'venezuela','brasil','brazil','cuba','bolivia','ecuador','paraguay','uruguay',
        'dominican','puerto rico','telenovela','cartel','narco','favela','barrio'
    ],
    'Los favoritos de la crítica': [
        'award','oscar','golden globe','cannes','sundance','bafta','critic',
        'acclaimed','masterpiece','cinematic','opus','magnum','prestige',
        'nomination','winner','best picture','best film','palm d\'or'
    ],
    'Música y musicales': [
        'music','musical','concert','song','songs','dance','dancer','singer',
        'band','rock','jazz','pop','rhythm','melody','opera','symphony','choir',
        'soundtrack','anthem','remix','album','tour','stage','perform',
        'bts','elvis','taylor','beatles','queen','bohemian','rapsody','rap','hip hop',
        'arirang','comeback live'
    ],
    'Orgullo': [
        'lgbtq','pride','gay','lesbian','queer','transgender','bisexual','rainbow',
        'drag','coming out','identity','love wins','same sex','two spirit'
    ],
    'Para reír': [
        'comedy','funny','hilarious','humor','humour','joke','laughing','absurd',
        'parody','satire','spoof','silly','goofy','awkward','mishap','blunder',
        'prank','standup','stand-up','comedian','roast','wit','slapstick'
    ],
    'Para ver en familia': [
        'family','kids','children','animation','animated','cartoon','pixar',
        'adventure','journey','magical','wonder','imagination','bedtime','story',
        'puppy','dog','cat','pet','animal','friend','school','young','teen',
        'princess','prince','fairy tale','holiday special'
    ],
    'Pelis policiales': [
        'police','cop','detective','crime','murder','homicide','investigation',
        'fbi','cia','interpol','forensic','evidence','case','suspect','criminal',
        'mafia','mob','gang','undercover','corrupt','justice','law','court',
        'prison','inmate','escape','heist','robbery','theft','smuggling'
    ],
    'Romances': [
        'love','romance','heart','kiss','wedding','bride','marriage','affair',
        'valentine','sweetheart','beloved','passion','desire','soulmate',
        'together','forever','couple','relationship','dating','proposal',
        'engagement','honeymoon','love story','loving','falling for'
    ],
    'Sci-fi': [
        'space','galaxy','star ','alien','robot','future','quantum','cyber',
        'android','planet','universe','cosmos','asteroid','meteor','dimension',
        'time travel','wormhole','spaceship','station','mars','moon','orbital',
        'interstellar','intergalactic','extraterrestrial','artificial intelligence',
        'clone','mutation','evolution','dystopia','utopia','cyberpunk','matrix'
    ],
    'Terror': [
        'horror','terror','evil','ghost','haunted','zombie','vampire','witch',
        'monster','demon','curse','darkness','nightmare','fear','blood','dead ',
        'killer','scream','sinister','creep','paranormal','possession','haunting',
        'supernatural','devil','satan','shadow','dread','chill','eerie','macabre',
        'slasher','psycho','hellfire','plague','reaper','undead','exorcism',
        'ritual','sacrifice','cult','occult','gravey','cemeter','coffin','crypt',
        'gothic','creature','beast','werewolf','frankenstein','dracula'
    ]
};

// Indicadores de español en el título
const SPANISH_CHARS = /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/;
const SPANISH_WORDS = /\b(el|la|los|las|un|una|de|del|en|con|por|para|hasta|como|cuando|donde|amor|vida|noche|día|dia|corazón|corazon|tiempo|hombre|mujer|familia|tierra|luz|mar|sol|muerte|guerra|rey|reina|sangre|fuego|agua|sueño|verdad|mentira|secreto|camino)\b/i;

function detectSpanish(title) {
    return SPANISH_CHARS.test(title) || SPANISH_WORDS.test(title);
}

function categorizeMovie(item) {
    // Si el JSON ya trae categoría, usarla directamente
    if (item.category) {
        const cats = Array.isArray(item.category) ? item.category : [item.category];
        return cats.filter(c => CATEGORIES.includes(c));
    }
    if (item.genre) {
        const genres = Array.isArray(item.genre) ? item.genre : [item.genre];
        const matched = genres.filter(g => CATEGORIES.includes(g));
        if (matched.length) return matched;
    }

    const t = (item.title || '').toLowerCase();
    const found = [];

    // Detección por palabras clave
    for (const [cat, keys] of Object.entries(KEYWORDS)) {
        if (cat === 'En Español' || cat === 'Internacionales') continue;
        if (keys.some(k => t.includes(k.toLowerCase()))) {
            found.push(cat);
        }
    }

    // Detección de español
    if (detectSpanish(item.title || '')) found.push('En Español');

    // Latinoamericanas implica también Internacionales
    if (found.includes('Latinoamericanas') && !found.includes('Internacionales')) {
        found.push('Internacionales');
    }

    // Si tiene idioma distinto al inglés y no es español → Internacionales
    if (item.language && item.language !== 'en' && item.language !== 'es') {
        if (!found.includes('Internacionales')) found.push('Internacionales');
    }

    return found;
}

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
                url: item.url || '',
                categories: categorizeMovie(item)
            }))
            .sort((a, b) => a.title.localeCompare(b.title));

        const catCounts = {};
        MOVIES_LIST.forEach(m => m.categories.forEach(c => { catCounts[c] = (catCounts[c] || 0) + 1; }));
        console.log('[OK] ' + MOVIES_LIST.length + ' películas');
        console.log('[CATS]', Object.entries(catCounts).map(([k,v]) => k + ':' + v).join(', '));
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

app.get('/api/categories', (req, res) => {
    const counts = {};
    MOVIES_LIST.forEach(m => m.categories.forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
    res.json({
        data: CATEGORIES.map(name => ({ name, count: counts[name] || 0 }))
    });
});

app.get('/api/movies', (req, res) => {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 250;
    const search = (req.query.q || '').toLowerCase();
    const cat = req.query.cat || '';
    const random = req.query.random === 'true';

    let list = [...MOVIES_LIST];
    if (cat) list = list.filter(m => m.categories.includes(cat));
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
            if (!res.headersSent) res.status(502).json({ error: 'Stream error' });
            else res.end();
        });
    });

    proxyReq.on('timeout', () => { proxyReq.destroy(); if (!res.headersSent) res.status(504).json({ error: 'Timeout' }); });
    proxyReq.on('error', (err) => { if (!res.headersSent) res.status(502).json({ error: 'Connection error' }); });
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
.logo{color:var(--accent);font-weight:700;font-size:20px;letter-spacing:-1px;flex-shrink:0}
.srch{flex:1;background:var(--bg);border:2px solid var(--border);color:var(--text);padding:10px 16px;border-radius:8px;font-size:14px;outline:none;min-width:0}
.srch:focus,.srch.f{border-color:var(--focus)}
.btn{background:var(--card);border:2px solid var(--border);color:var(--text);padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0}
.btn.f{border-color:var(--focus)}
.stats{color:var(--text2);font-size:12px;white-space:nowrap;flex-shrink:0}

.cats-wrap{background:var(--surface);border-bottom:1px solid var(--border);position:relative}
.cats{display:flex;gap:8px;padding:10px 16px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.cats::-webkit-scrollbar{display:none}
.cat{padding:7px 16px;background:var(--bg);border:2px solid var(--border);border-radius:20px;color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:border-color .1s}
.cat.on{background:var(--accent);border-color:var(--accent);color:#fff}
.cat.f{border-color:var(--focus);color:var(--text)}
.cat.on.f{border-color:#fff;color:#fff}

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

    <div class="cats-wrap">
        <div class="cats" id="cats">
            <button class="cat on" data-cat="">Todas</button>
            <button class="cat" data-cat="Acción">Acción</button>
            <button class="cat" data-cat="Adaptaciones de libros">Adaptaciones de libros</button>
            <button class="cat" data-cat="Anime">Anime</button>
            <button class="cat" data-cat="Astrología">Astrología</button>
            <button class="cat" data-cat="Cine de intriga">Cine de intriga</button>
            <button class="cat" data-cat="Clásicas">Clásicas</button>
            <button class="cat" data-cat="Cortos">Cortos</button>
            <button class="cat" data-cat="De Hollywood">De Hollywood</button>
            <button class="cat" data-cat="Deportes">Deportes</button>
            <button class="cat" data-cat="Documentales">Documentales</button>
            <button class="cat" data-cat="Dramas">Dramas</button>
            <button class="cat" data-cat="En Español">En Español</button>
            <button class="cat" data-cat="Estados de ánimo">Estados de ánimo</button>
            <button class="cat" data-cat="Fantasía">Fantasía</button>
            <button class="cat" data-cat="Fe y espiritualidad">Fe y espiritualidad</button>
            <button class="cat" data-cat="Independientes">Independientes</button>
            <button class="cat" data-cat="Internacionales">Internacionales</button>
            <button class="cat" data-cat="Latinoamericanas">Latinoamericanas</button>
            <button class="cat" data-cat="Los favoritos de la crítica">Los favoritos de la crítica</button>
            <button class="cat" data-cat="Música y musicales">Música y musicales</button>
            <button class="cat" data-cat="Orgullo">Orgullo</button>
            <button class="cat" data-cat="Para reír">Para reír</button>
            <button class="cat" data-cat="Para ver en familia">Para ver en familia</button>
            <button class="cat" data-cat="Pelis policiales">Pelis policiales</button>
            <button class="cat" data-cat="Romances">Romances</button>
            <button class="cat" data-cat="Sci-fi">Sci-fi</button>
            <button class="cat" data-cat="Terror">Terror</button>
        </div>
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
    zone: 'hdr',       // 'hdr' | 'cats' | 'grid'
    movieIdx: 0,
    currentList: [],
    activeCat: '',
    page: 0,
    hasMore: true,
    loading: false,
    cols: 5,
    focused: null,
    playing: false,
    lastFocused: { hdr: null, cats: null, grid: null },
    retryCount: 0,
    maxRetries: 3
};

let hideT, volT, indT, nextT, bufferCheckT;

const el = {
    grid: $('grid'), main: $('main'), srch: $('srch'), mix: $('mix'), stats: $('stats'),
    cats: $('cats'),
    player: $('player'), vid: $('vid'), pUi: $('p-ui'), pTitle: $('p-title'), pStatus: $('p-status'),
    pLoad: $('p-load'), pLoadTxt: $('p-load-txt'), pErr: $('p-err'), pErrSub: $('p-err-sub'), pRetry: $('p-retry'), pBack: $('p-back'),
    pInd: $('p-ind'), pVol: $('p-vol'), pVolFill: $('p-vol-fill'), pVolPct: $('p-vol-pct'),
    pBar: $('p-bar'), pBarFill: $('p-bar-fill'), pBarBuf: $('p-bar-buf'), pBarDot: $('p-bar-dot'),
    pCur: $('p-cur'), pDur: $('p-dur'),
    pPrev: $('p-prev'), pRw: $('p-rw'), pPp: $('p-pp'), pFw: $('p-fw'), pNxt: $('p-nxt'),
    pNext: $('p-next'), pNextT: $('p-next-t'), pNextCd: $('p-next-cd'), pNextPlay: $('p-next-play'), pNextCancel: $('p-next-cancel')
};

// ===== INIT =====
function initHistory() {
    history.replaceState({ view: 'home' }, '', '#home');
    window.addEventListener('popstate', () => { if (state.view === 'player') closePlayerInternal(); });
}
function pushView(v) { history.pushState({ view: v }, '', '#' + v); }

initHistory();
fetch('/api/stats').then(r => r.json()).then(d => { el.stats.textContent = d.movies + ' películas'; }).catch(() => {});
load(false, false);
calcCols();
window.addEventListener('resize', calcCols);
document.addEventListener('keydown', onKey, true);
setupPlayer();
setupMouse();
setTimeout(() => focusZone('hdr'), 300);

// ===== CATEGORÍAS =====
[...el.cats.querySelectorAll('.cat')].forEach(btn => {
    btn.addEventListener('click', () => selectCat(btn));
});

function selectCat(btn) {
    [...el.cats.querySelectorAll('.cat')].forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    state.activeCat = btn.dataset.cat;
    el.srch.value = '';
    load(false, false);
}

// ===== LAYOUT =====
function calcCols() {
    const c = el.grid.querySelector('.card');
    if (c) { const w = el.grid.offsetWidth, cw = c.offsetWidth + 10; state.cols = Math.max(1, Math.floor(w / cw)); }
}

// ===== FOCUS SYSTEM =====
function focus(elem) {
    if (state.focused) state.focused.classList.remove('f');
    state.focused = elem;
    if (elem) { elem.classList.add('f'); elem.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

function focusZone(zone) {
    state.zone = zone;
    if (zone === 'hdr') {
        const prev = state.lastFocused.hdr;
        const items = [el.srch, el.mix];
        focus(prev && items.includes(prev) ? prev : el.srch);
    } else if (zone === 'cats') {
        const prev = state.lastFocused.cats;
        const cats = [...el.cats.querySelectorAll('.cat')];
        const active = cats.find(c => c.classList.contains('on'));
        focus(prev && cats.includes(prev) ? prev : active || cats[0]);
    } else if (zone === 'grid') {
        const prev = state.lastFocused.grid;
        const cards = [...el.grid.querySelectorAll('.card')].filter(e => e.offsetParent);
        focus(prev && cards.includes(prev) ? prev : cards[0]);
    }
}

function saveFocus() {
    if (state.zone === 'hdr') state.lastFocused.hdr = state.focused;
    else if (state.zone === 'cats') state.lastFocused.cats = state.focused;
    else if (state.zone === 'grid') state.lastFocused.grid = state.focused;
}

// ===== KEYBOARD =====
function onKey(e) {
    const k = e.key;
    const navKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' '];
    if (navKeys.includes(k)) { e.preventDefault(); e.stopPropagation(); }

    if (state.view === 'player') { playerKey(k); return; }

    if (document.activeElement === el.srch) {
        if (k === 'ArrowDown') { el.srch.blur(); saveFocus(); focusZone('cats'); }
        return;
    }

    switch (k) {
        case 'ArrowUp':    moveUp(); break;
        case 'ArrowDown':  moveDown(); break;
        case 'ArrowLeft':  moveLeft(); break;
        case 'ArrowRight': moveRight(); break;
        case 'Enter': case ' ': activate(); break;
    }
}

function moveUp() {
    if (state.zone === 'grid') {
        const cards = [...el.grid.querySelectorAll('.card')].filter(e => e.offsetParent);
        const ci = cards.indexOf(state.focused);
        if (ci >= 0 && ci < state.cols) {
            saveFocus(); state.lastFocused.grid = state.focused; focusZone('cats');
        } else if (ci >= state.cols) {
            focus(cards[ci - state.cols]);
        }
    } else if (state.zone === 'cats') {
        saveFocus(); focusZone('hdr');
    }
}

function moveDown() {
    if (state.zone === 'hdr') {
        saveFocus(); focusZone('cats');
    } else if (state.zone === 'cats') {
        saveFocus();
        const cards = [...el.grid.querySelectorAll('.card')].filter(e => e.offsetParent);
        if (cards.length) { state.zone = 'grid'; focus(cards[0]); }
    } else if (state.zone === 'grid') {
        const cards = [...el.grid.querySelectorAll('.card')].filter(e => e.offsetParent);
        const ci = cards.indexOf(state.focused);
        const ni = ci + state.cols;
        if (ni < cards.length) focus(cards[ni]);
        else if (state.hasMore) load(true, false);
    }
}

function moveLeft() {
    if (state.zone === 'hdr') {
        if (state.focused === el.mix) focus(el.srch);
    } else if (state.zone === 'cats') {
        const cats = [...el.cats.querySelectorAll('.cat')];
        const ci = cats.indexOf(state.focused);
        if (ci > 0) focus(cats[ci - 1]);
    } else if (state.zone === 'grid') {
        const cards = [...el.grid.querySelectorAll('.card')].filter(e => e.offsetParent);
        const ci = cards.indexOf(state.focused);
        if (ci > 0) focus(cards[ci - 1]);
    }
}

function moveRight() {
    if (state.zone === 'hdr') {
        if (state.focused === el.srch) focus(el.mix);
    } else if (state.zone === 'cats') {
        const cats = [...el.cats.querySelectorAll('.cat')];
        const ci = cats.indexOf(state.focused);
        if (ci < cats.length - 1) focus(cats[ci + 1]);
    } else if (state.zone === 'grid') {
        const cards = [...el.grid.querySelectorAll('.card')].filter(e => e.offsetParent);
        const ci = cards.indexOf(state.focused);
        if (ci < cards.length - 1) focus(cards[ci + 1]);
    }
}

function activate() {
    if (!state.focused) return;
    if (state.focused === el.srch) { el.srch.focus(); return; }
    state.focused.click();
}

// ===== PLAYER KEYS =====
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
    el.vid.currentTime = Math.max(0, Math.min(el.vid.currentTime + s, el.vid.duration || 0));
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

// ===== PLAYER SETUP =====
function setupPlayer() {
    const v = el.vid;
    v.preload = 'auto'; v.playsInline = true;

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
    if (error) { switch(error.code) { case 1: msg='Carga abortada'; break; case 2: msg='Error de red'; break; case 3: msg='Error de decodificación'; break; case 4: msg='Formato no soportado'; break; } }
    el.pErrSub.textContent = msg;
    if (error && error.code === 2 && state.retryCount < state.maxRetries) {
        state.retryCount++;
        el.pLoadTxt.textContent = 'Reintentando... (' + state.retryCount + '/' + state.maxRetries + ')';
        updateStatus('Reintentando...');
        setTimeout(retry, 2000);
    } else { el.pLoad.classList.remove('show'); el.pErr.classList.add('show'); stopBufferMonitor(); }
}

function handlePlayError(e) { if (e.name === 'NotAllowedError') el.pPp.textContent = 'PLAY'; }
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
    el.pErr.classList.remove('show'); el.pLoad.classList.add('show'); el.pLoadTxt.textContent = 'Reintentando...';
    const t = el.vid.currentTime, s = el.vid.src;
    el.vid.src = '';
    setTimeout(() => { el.vid.src = s; el.vid.currentTime = t; el.vid.play().catch(handlePlayError); }, 500);
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
    nextT = setInterval(() => { c--; el.pNextCd.textContent = 'En ' + c + 's'; if (c <= 0) { clearInterval(nextT); nextT = null; nextMovie(); } }, 1000);
    showUI();
}

function hideNext() { el.pNext.classList.remove('show'); if (nextT) { clearInterval(nextT); nextT = null; } }
function cancelNext() { hideNext(); }
function hasNext() { return state.movieIdx < state.currentList.length - 1; }
function nextMovie() { hideNext(); if (hasNext()) { state.movieIdx++; playMovie(state.currentList[state.movieIdx]); } }
function prevMovie() { if (state.movieIdx > 0) { state.movieIdx--; playMovie(state.currentList[state.movieIdx]); } }

function playMovie(movie) {
    state.retryCount = 0; hideNext(); el.pErr.classList.remove('show'); el.pLoad.classList.add('show'); el.pLoadTxt.textContent = 'Conectando...';
    let u = movie.url;
    if (u.startsWith('http://')) u = '/video-proxy?url=' + encodeURIComponent(u);
    el.vid.pause(); el.vid.removeAttribute('src'); el.vid.load();
    setTimeout(() => { el.vid.src = u; el.pTitle.textContent = movie.title; el.vid.play().catch(handlePlayError); showUI(); }, 100);
}

function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = Math.floor(s%60);
    return h > 0 ? h+':'+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0') : m+':'+String(ss).padStart(2,'0');
}

// ===== CARGA =====
function load(append, random) {
    if (state.loading || (append && !state.hasMore)) return;
    state.loading = true;
    if (!append) { el.grid.innerHTML = '<div class="msg load">Cargando</div>'; state.page = 0; state.hasMore = true; state.currentList = []; }

    let u = '/api/movies?page=' + state.page + '&limit=250';
    if (el.srch.value.trim()) u += '&q=' + encodeURIComponent(el.srch.value.trim());
    if (state.activeCat) u += '&cat=' + encodeURIComponent(state.activeCat);
    if (random) u += '&random=true';

    fetch(u).then(r => r.json()).then(d => {
        if (!append) el.grid.innerHTML = '';
        if (!d.data.length && !append) { el.grid.innerHTML = '<div class="msg">Sin resultados en esta categoría</div>'; return; }
        d.data.forEach(m => { state.currentList.push(m); el.grid.appendChild(mkCard(m, state.currentList.length - 1)); });
        state.page++; state.hasMore = d.hasMore;
        calcCols();
        if (!append) setTimeout(() => focusZone('grid'), 50);
    }).catch(() => { if (!append) el.grid.innerHTML = '<div class="msg">Error al cargar</div>'; })
    .finally(() => state.loading = false);
}

function mkCard(m, idx) {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = '<img data-src="' + esc(m.logo) + '"><div class="card-t">' + esc(m.title) + '</div>';
    obs.observe(d.querySelector('img'));
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
    saveFocus(); state.view = 'player'; state.movieIdx = idx;
    pushView('player'); playMovie(state.currentList[idx]); el.player.classList.add('open');
}

function closePlayerInternal() {
    el.vid.pause(); el.vid.removeAttribute('src'); el.vid.load();
    el.player.classList.remove('open'); state.view = 'home'; hideNext(); stopBufferMonitor();
    setTimeout(() => focusZone('grid'), 50);
}

// ===== MOUSE =====
function setupMouse() {
    el.mix.onclick = () => load(false, true);
    let t;
    el.srch.oninput = () => { clearTimeout(t); t = setTimeout(() => { state.activeCat = ''; [...el.cats.querySelectorAll('.cat')].forEach(b => b.classList.toggle('on', !b.dataset.cat)); load(false, false); }, 300); };
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
