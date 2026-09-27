/*
 * React Native Interview Handbook — client runtime.
 *
 * Each page ships its content as Markdown inside <script type="text/markdown" id="page-content">.
 * This file builds the chrome (header, sidebar, TOC), renders the Markdown with marked.js,
 * then enhances it: callouts, code blocks (highlight.js), Mermaid diagrams (lazy-loaded),
 * collapsible Q&A cards with progress tracking, persistent checklists and cross-page search.
 */
(function () {
  'use strict';

  var SITE = window.SITE || { title: 'Handbook', nav: [] };
  var body = document.body;
  var ROOT = (body.getAttribute('data-root') || '.').replace(/\/+$/, '') || '.';
  var PAGE = body.getAttribute('data-page') || 'index.html';
  var TYPE = body.getAttribute('data-type') || 'guide';
  var MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';
  var THEME_KEY = 'rnh-theme';
  var PREFIX = 'rnh:';

  // ------------------------------------------------------------------ utils

  var store = {
    get: function (k, fallback) {
      try { var v = localStorage.getItem(PREFIX + k); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del: function (k) { try { localStorage.removeItem(PREFIX + k); } catch (e) { /* ignore */ } }
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function href(path) { return ROOT + '/' + path; }

  function slugify(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-')
      .slice(0, 80).replace(/^-+|-+$/g, '');
  }

  function dedent(text) {
    var lines = text.replace(/\r\n?/g, '\n').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    var min = Infinity;
    lines.forEach(function (l) {
      if (!l.trim()) return;
      var m = l.match(/^[ \t]*/)[0].length;
      if (m < min) min = m;
    });
    if (!isFinite(min) || min === 0) return lines.join('\n');
    return lines.map(function (l) { return l.slice(min); }).join('\n');
  }

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    if (html != null) node.innerHTML = html;
    return node;
  }

  function flatNav() {
    var out = [];
    (SITE.nav || []).forEach(function (sec) {
      sec.items.forEach(function (it) { out.push(Object.assign({ section: sec.section, sectionId: sec.id }, it)); });
    });
    return out;
  }

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve) {
      var ta = el('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove(); resolve();
    });
  }

  // ------------------------------------------------------------------ icons

  var ICONS = {
    menu: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    github: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    expand: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
    chevronsDown: '<polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>',
    chevronsUp: '<polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    reset: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    diagram: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M6.5 10v4a2 2 0 0 0 2 2H14"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    octagon: '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    card: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    cloud: '<polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>',
    checkSquare: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    keyboard: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
    moonSun: '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>'
  };

  function icon(name, cls) {
    return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.book) + '</svg>';
  }

  var PAGE_ICONS = {
    'index.html': 'home',
    'questions/beginner.html': 'book',
    'questions/intermediate.html': 'trending',
    'questions/advanced.html': 'layers',
    'questions/senior.html': 'award',
    'questions/coding-challenges.html': 'code',
    'guides/push-notifications.html': 'bell',
    'guides/deep-linking.html': 'link',
    'guides/permissions.html': 'shield',
    'guides/location.html': 'pin',
    'guides/camera.html': 'camera',
    'guides/app-icon-splash.html': 'image',
    'guides/payments.html': 'card',
    'guides/authentication.html': 'key',
    'guides/offline-storage.html': 'database',
    'guides/background-tasks.html': 'refresh',
    'guides/deployment.html': 'rocket',
    'guides/ota-updates.html': 'cloud',
    'guides/testing.html': 'checkSquare',
    'guides/monitoring.html': 'activity',
    'guides/new-architecture.html': 'cpu',
    'guides/performance.html': 'zap',
    'guides/security.html': 'lock'
  };

  var LOGO = '<svg class="brand-logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0c1a28"/>' +
    '<g fill="none" stroke="#61dafb" stroke-width="1.5"><ellipse cx="16" cy="16" rx="11" ry="4.3"/>' +
    '<ellipse cx="16" cy="16" rx="11" ry="4.3" transform="rotate(60 16 16)"/><ellipse cx="16" cy="16" rx="11" ry="4.3" transform="rotate(120 16 16)"/></g>' +
    '<circle cx="16" cy="16" r="2.3" fill="#61dafb"/></svg>';

  // ------------------------------------------------------------------ shell

  function buildShell() {
    var shortTitle = SITE.shortTitle || SITE.title;
    var repo = SITE.repoUrl ? '<a class="icon-btn" href="' + esc(SITE.repoUrl) + '" target="_blank" rel="noopener" aria-label="GitHub repository" title="GitHub repository">' + icon('github') + '</a>' : '';

    var header = el('header', { class: 'topbar' },
      '<button class="icon-btn menu-btn" type="button" aria-label="Open navigation" aria-expanded="false">' + icon('menu') + '</button>' +
      '<a class="brand" href="' + href('index.html') + '">' + LOGO + '<span class="brand-text">' + esc(shortTitle) + '<small>Beginner → Senior</small></span></a>' +
      '<span class="topbar-spacer"></span>' +
      '<button class="search-trigger" type="button" aria-label="Search">' + icon('search') + '<span>Search questions &amp; guides…</span><kbd>/</kbd></button>' +
      repo +
      '<button class="icon-btn theme-btn" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">' + icon('moon', 'i-moon') + icon('sun', 'i-sun') + '</button>');

    var sidebar = el('aside', { class: 'sidebar', 'aria-label': 'Site navigation' });
    sidebar.appendChild(buildNav());
    sidebar.appendChild(el('div', { class: 'sidebar-foot' },
      'Progress is saved in this browser. Press <kbd>/</kbd> to search.'));

    var main = el('main', { class: 'main', id: 'main' });
    var article = el('article', { class: 'content' }, '<div class="boot">Loading…</div>');
    main.appendChild(article);

    var toc = el('aside', { class: 'toc', 'aria-label': 'On this page' });

    var layout = el('div', { class: 'layout' });
    layout.appendChild(sidebar);
    layout.appendChild(main);
    layout.appendChild(toc);

    var src = document.getElementById('page-content');
    body.insertBefore(el('div', { class: 'read-progress' }), src);
    body.insertBefore(header, src);
    body.insertBefore(layout, src);
    body.appendChild(el('div', { class: 'scrim' }));
    body.appendChild(el('button', { class: 'to-top', type: 'button', 'aria-label': 'Back to top' }, icon('arrowUp')));

    body.classList.add('page-' + TYPE);
    return { article: article, toc: toc, main: main, sidebar: sidebar };
  }

  function buildNav() {
    var nav = el('nav');
    (SITE.nav || []).forEach(function (sec) {
      var wrap = el('div', { class: 'nav-section' });
      wrap.appendChild(el('p', { class: 'nav-section-title' }, esc(sec.section)));
      var ul = el('ul', { class: 'nav-list' });
      sec.items.forEach(function (it) {
        var li = el('li');
        var active = it.path === PAGE;
        var badge = '';
        var total = store.get('total:' + it.path, 0);
        if (total) {
          var done = (store.get('reviewed:' + it.path, []) || []).length;
          badge = '<span class="nav-badge' + (done >= total ? ' done' : '') + '" data-badge="' + esc(it.path) + '">' + Math.min(done, total) + '/' + total + '</span>';
        }
        li.innerHTML = '<a class="nav-link' + (active ? ' active' : '') + '" href="' + href(it.path) + '"' + (active ? ' aria-current="page"' : '') + '>' +
          '<span class="nav-title">' + esc(it.title) + '</span>' + badge + '</a>';
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
      nav.appendChild(wrap);
    });
    return nav;
  }

  function updateNavBadge(path, done, total) {
    var b = document.querySelector('[data-badge="' + path + '"]');
    if (!b) {
      var link = document.querySelector('.nav-link.active');
      if (!link || path !== PAGE) return;
      b = el('span', { class: 'nav-badge', 'data-badge': path });
      link.appendChild(b);
    }
    b.textContent = Math.min(done, total) + '/' + total;
    b.classList.toggle('done', done >= total);
  }

  // ------------------------------------------------------------------ markdown

  var LANG_ALIAS = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', terminal: 'bash',
    kt: 'kotlin', kts: 'kotlin', objc: 'objectivec', 'objective-c': 'objectivec', mm: 'objectivec', 'objc++': 'objectivec', objcpp: 'objectivec',
    yml: 'yaml', plist: 'xml', html: 'xml', svg: 'xml', storyboard: 'xml',
    env: 'properties', dotenv: 'properties', toml: 'ini', podfile: 'ruby', fastfile: 'ruby', rb: 'ruby',
    text: 'plaintext', txt: 'plaintext', plain: 'plaintext', mermaid: 'plaintext', 'c++': 'cpp', h: 'cpp', hpp: 'cpp'
  };

  function hlLang(lang) {
    var l = LANG_ALIAS[lang] || lang || 'plaintext';
    if (window.hljs && !window.hljs.getLanguage(l)) return 'plaintext';
    return l;
  }

  function codeBlockHtml(code, lang, title) {
    code = code.replace(/\n+$/, '');
    return '<div class="code-block"><div class="code-head">' +
      (title ? '<span class="code-title">' + esc(title) + '</span>' : '') +
      '<span class="code-lang">' + esc(lang || 'text') + '</span>' +
      '<button class="copy-btn" type="button" aria-label="Copy code">' + icon('copy') + '<span>Copy</span></button>' +
      '</div><pre><code class="language-' + esc(hlLang(lang)) + '">' + esc(code) + '</code></pre></div>';
  }

  function diagramKind(code) {
    var first = (code.trim().split('\n')[0] || '').trim().toLowerCase();
    if (first.indexOf('sequence') === 0) return 'Sequence';
    if (first.indexOf('state') === 0) return 'State';
    if (first.indexOf('timeline') === 0) return 'Timeline';
    if (first.indexOf('mindmap') === 0) return 'Mind map';
    if (first.indexOf('class') === 0) return 'Class';
    return 'Flow';
  }

  function diagramHtml(code) {
    return '<figure class="diagram" data-src="' + esc(code.trim()) + '">' +
      '<div class="diagram-bar"><span class="diagram-kind">' + diagramKind(code) + ' diagram</span><span class="spacer"></span>' +
      '<button type="button" class="diagram-expand" aria-label="Expand diagram">' + icon('expand') + '<span>Expand</span></button></div>' +
      '<div class="diagram-canvas pending"><span>Rendering diagram…</span></div></figure>';
  }

  function renderMarkdown(md) {
    var renderer = new window.marked.Renderer();
    renderer.code = function (code, info) {
      if (code && typeof code === 'object') { info = code.lang; code = code.text; }
      info = (info || '').trim();
      var lang = ((info.match(/^[^\s{]+/) || [''])[0]).toLowerCase();
      var tm = info.match(/title=(?:"([^"]*)"|'([^']*)'|(\S+))/);
      var title = tm ? (tm[1] || tm[2] || tm[3]) : '';
      if (lang === 'mermaid') return diagramHtml(code);
      return codeBlockHtml(code, lang, title);
    };
    return window.marked.parse(md, { renderer: renderer, gfm: true, breaks: false });
  }

  // ------------------------------------------------------------------ enhance

  var CALLOUTS = {
    note: { icon: 'info', title: 'Note' },
    tip: { icon: 'bulb', title: 'Tip' },
    important: { icon: 'message', title: 'Important' },
    warning: { icon: 'alert', title: 'Warning' },
    caution: { icon: 'octagon', title: 'Caution' },
    interview: { icon: 'users', title: 'Interviewer’s lens' }
  };

  function enhanceCallouts(root) {
    root.querySelectorAll('blockquote').forEach(function (bq) {
      var p = bq.firstElementChild;
      if (!p || p.tagName !== 'P') return;
      var m = p.innerHTML.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INTERVIEW)\][ \t]*([^\n]*?)(?:<br\s*\/?>)?\s*(?:\n|$)/i);
      if (!m) return;
      var kind = m[1].toLowerCase();
      var cfg = CALLOUTS[kind];
      var title = m[2] && m[2].trim() ? m[2].trim() : cfg.title;
      p.innerHTML = p.innerHTML.slice(m[0].length);
      if (!p.textContent.trim() && !p.querySelector('img,code')) p.remove();
      var box = el('div', { class: 'callout callout-' + kind, role: 'note' });
      box.appendChild(el('div', { class: 'callout-title' }, icon(cfg.icon) + '<span>' + title + '</span>'));
      var inner = el('div', { class: 'callout-body' });
      while (bq.firstChild) inner.appendChild(bq.firstChild);
      box.appendChild(inner);
      bq.replaceWith(box);
    });
  }

  function assignHeadingIds(root) {
    var used = {};
    root.querySelectorAll('h1, h2, h3, h4').forEach(function (h) {
      var base = slugify(h.textContent) || 'section';
      var id = base, n = 1;
      while (used[id]) id = base + '-' + (n++);
      used[id] = true;
      h.id = id;
    });
  }

  function enhanceMisc(root) {
    // tables
    root.querySelectorAll('table').forEach(function (t) {
      if (t.parentElement.classList.contains('table-wrap')) return;
      var w = el('div', { class: 'table-wrap' });
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });
    // external links
    root.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (/^https?:\/\//i.test(h) && a.hostname !== location.hostname) {
        a.target = '_blank'; a.rel = 'noopener noreferrer';
      }
    });
    // diagram captions: an italic-only paragraph right after a diagram
    root.querySelectorAll('figure.diagram').forEach(function (fig) {
      var next = fig.nextElementSibling;
      if (next && next.tagName === 'P' && next.children.length === 1 && next.firstElementChild.tagName === 'EM' &&
          next.textContent.trim() === next.firstElementChild.textContent.trim()) {
        var cap = el('figcaption', null, next.firstElementChild.innerHTML);
        fig.appendChild(cap);
        next.remove();
      }
    });
    // task lists → persistent checklists
    var tasks = root.querySelectorAll('li > input[type="checkbox"]');
    var saved = store.get('tasks:' + PAGE, []);
    tasks.forEach(function (cb, i) {
      var li = cb.parentElement;
      li.classList.add('task');
      cb.disabled = false;
      cb.checked = saved.indexOf(i) !== -1;
      var span = el('span', { class: 'task-text' });
      while (cb.nextSibling) span.appendChild(cb.nextSibling);
      li.appendChild(span);
      li.classList.toggle('checked', cb.checked);
      cb.addEventListener('change', function () {
        li.classList.toggle('checked', cb.checked);
        var list = [];
        tasks.forEach(function (c, j) { if (c.checked) list.push(j); });
        store.set('tasks:' + PAGE, list);
      });
    });
  }

  function pageMeta(article, qaCount) {
    var h1 = article.querySelector('h1');
    if (!h1) return;
    var words = (article.textContent || '').split(/\s+/).length;
    var minutes = Math.max(1, Math.round(words / 230));
    var diagrams = article.querySelectorAll('figure.diagram').length;
    var chips = '<span class="chip">' + icon('clock') + '~' + minutes + ' min read</span>';
    if (qaCount) chips += '<span class="chip">' + icon('help') + qaCount + (TYPE === 'qa' ? ' questions' : ' interview questions') + '</span>';
    if (diagrams) chips += '<span class="chip">' + icon('diagram') + diagrams + ' diagram' + (diagrams > 1 ? 's' : '') + '</span>';
    var meta = el('div', { class: 'page-meta' }, chips);
    h1.insertAdjacentElement('afterend', meta);
    var lead = meta.nextElementSibling;
    if (lead && lead.tagName === 'P') lead.classList.add('lead');
  }

  // ------------------------------------------------------------------ Q&A

  var QA = { cards: [], reviewed: new Set(), total: 0, sectionCounts: {} };

  function buildQA(article) {
    var zone = TYPE === 'qa';
    var n = 0;
    var currentH2 = null;
    var node = article.firstElementChild;
    while (node) {
      var tag = node.tagName;
      if (tag === 'H1') { node = node.nextElementSibling; continue; }
      if (tag === 'H2') {
        currentH2 = node;
        zone = TYPE === 'qa' || /^interview questions\b/i.test(node.textContent.trim());
        node = node.nextElementSibling;
        continue;
      }
      if (tag === 'H3' && zone) {
        n++;
        var det = el('details', { class: 'qa' });
        det.id = node.id;
        node.removeAttribute('id');
        article.insertBefore(det, node);
        var sib = node.nextSibling;
        var sum = el('summary');
        sum.appendChild(el('span', { class: 'qa-num' }, 'Q' + n));
        sum.appendChild(node);
        sum.appendChild(el('span', { class: 'qa-state' },
          '<span class="qa-check" title="Reviewed">' + icon('checkCircle') + '</span><span class="qa-chevron">' + icon('chevron') + '</span>'));
        var qbody = el('div', { class: 'qa-body' });
        while (sib && !(sib.nodeType === 1 && /^H[1-3]$/.test(sib.tagName))) {
          var nx = sib.nextSibling;
          qbody.appendChild(sib);
          sib = nx;
        }
        qbody.appendChild(el('div', { class: 'qa-foot' },
          '<button type="button" class="btn qa-review">' + icon('check') + '<span>Mark as reviewed</span></button>' +
          '<button type="button" class="btn qa-copylink">' + icon('link') + '<span>Copy link</span></button>' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn qa-close">' + icon('chevronsUp') + '<span>Collapse</span></button>'));
        det.appendChild(sum);
        det.appendChild(qbody);
        QA.cards.push(det);
        if (currentH2) QA.sectionCounts[currentH2.id] = (QA.sectionCounts[currentH2.id] || 0) + 1;
        node = sib && sib.nodeType === 1 ? sib : null;
        continue;
      }
      node = node.nextElementSibling;
    }
    QA.total = n;
    if (!n) return 0;

    var saved = store.get('reviewed:' + PAGE, []);
    var ids = new Set(QA.cards.map(function (c) { return c.id; }));
    QA.reviewed = new Set(saved.filter(function (id) { return ids.has(id); }));
    store.set('total:' + PAGE, n);
    QA.cards.forEach(function (c) { setReviewed(c, QA.reviewed.has(c.id), true); });

    article.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var card = btn.closest('details.qa');
      if (!card) return;
      if (btn.classList.contains('qa-review')) {
        setReviewed(card, !QA.reviewed.has(card.id));
      } else if (btn.classList.contains('qa-copylink')) {
        var url = location.href.split('#')[0] + '#' + card.id;
        copyText(url).then(function () { flashButton(btn, 'Link copied'); });
      } else if (btn.classList.contains('qa-close')) {
        card.open = false;
        var top = card.getBoundingClientRect().top;
        if (top < 70) card.scrollIntoView({ block: 'start' });
      }
    });

    return n;
  }

  function flashButton(btn, text) {
    var span = btn.querySelector('span');
    if (!span) return;
    var old = span.textContent;
    span.textContent = text;
    setTimeout(function () { span.textContent = old; }, 1400);
  }

  function setReviewed(card, value, silent) {
    card.classList.toggle('reviewed', value);
    var btn = card.querySelector('.qa-review');
    if (btn) {
      btn.classList.toggle('is-reviewed', value);
      btn.querySelector('span').textContent = value ? 'Reviewed' : 'Mark as reviewed';
    }
    if (silent) return;
    if (value) QA.reviewed.add(card.id); else QA.reviewed.delete(card.id);
    store.set('reviewed:' + PAGE, Array.from(QA.reviewed));
    updateProgress();
  }

  function updateProgress() {
    var done = QA.reviewed.size, total = QA.total;
    var bar = document.querySelector('.qa-progress-bar > span');
    var txt = document.querySelector('.qa-progress-text');
    if (bar) bar.style.width = (total ? (done / total) * 100 : 0) + '%';
    if (txt) txt.innerHTML = '<strong>' + done + '</strong> / ' + total + ' reviewed';
    if (total) updateNavBadge(PAGE, done, total);
  }

  function insertToolbar(article) {
    var bar = el('div', { class: 'qa-toolbar', role: 'toolbar', 'aria-label': 'Question tools' },
      '<div class="qa-progress"><div class="qa-progress-bar"><span></span></div><span class="qa-progress-text"></span></div>' +
      '<div class="qa-actions">' +
      '<button type="button" class="btn" data-act="expand" title="Expand all answers">' + icon('chevronsDown') + '<span>Expand all</span></button>' +
      '<button type="button" class="btn" data-act="collapse" title="Collapse all answers">' + icon('chevronsUp') + '<span>Collapse</span></button>' +
      '<button type="button" class="btn" data-act="random" title="Open a random unreviewed question">' + icon('shuffle') + '<span>Random</span></button>' +
      '<button type="button" class="btn" data-act="hide" aria-pressed="false" title="Hide questions you have reviewed">' + icon('eyeOff') + '<span>Hide reviewed</span></button>' +
      '<button type="button" class="btn" data-act="reset" title="Reset progress on this page">' + icon('reset') + '<span>Reset</span></button>' +
      '</div>');
    var anchor = article.querySelector('p.lead') || article.querySelector('.page-meta') || article.querySelector('h1');
    if (anchor) anchor.insertAdjacentElement('afterend', bar); else article.prepend(bar);

    var hide = store.get('hideReviewed', false);
    var hideBtn = bar.querySelector('[data-act="hide"]');
    body.classList.toggle('hide-reviewed', hide);
    hideBtn.setAttribute('aria-pressed', String(hide));

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'expand') QA.cards.forEach(function (c) { c.open = true; });
      if (act === 'collapse') QA.cards.forEach(function (c) { c.open = false; });
      if (act === 'random') {
        var pool = QA.cards.filter(function (c) { return !QA.reviewed.has(c.id); });
        if (!pool.length) pool = QA.cards.slice();
        var pick = pool[Math.floor(Math.random() * pool.length)];
        QA.cards.forEach(function (c) { if (c !== pick) c.open = false; });
        pick.open = true;
        history.replaceState(null, '', '#' + pick.id);
        requestAnimationFrame(function () { goToHash('#' + pick.id, true); });
      }
      if (act === 'hide') {
        var on = !body.classList.contains('hide-reviewed');
        body.classList.toggle('hide-reviewed', on);
        btn.setAttribute('aria-pressed', String(on));
        store.set('hideReviewed', on);
      }
      if (act === 'reset') {
        if (!window.confirm('Reset your reviewed progress for this page?')) return;
        QA.cards.forEach(function (c) { setReviewed(c, false, true); });
        QA.reviewed.clear();
        store.set('reviewed:' + PAGE, []);
        updateProgress();
      }
    });
  }

  // ------------------------------------------------------------------ TOC

  function buildToc(article, tocEl) {
    var selector = TYPE === 'qa' ? ':scope > h2' : ':scope > h2, :scope > h3';
    var heads = Array.prototype.slice.call(article.querySelectorAll(selector));
    if (TYPE === 'home' || heads.length < 2) {
      body.classList.add('no-toc');
      tocEl.remove();
      return [];
    }
    var html = '<div class="toc-inner"><p class="toc-title">On this page</p><ul>';
    heads.forEach(function (h) {
      var count = QA.sectionCounts[h.id];
      html += '<li class="toc-' + h.tagName.toLowerCase() + '"><a href="#' + h.id + '" data-target="' + h.id + '"><span>' + esc(h.textContent) + '</span>' +
        (count ? '<span class="toc-count">' + count + '</span>' : '') + '</a></li>';
    });
    html += '</ul><div class="toc-actions">' +
      '<button type="button" data-toc="top">' + icon('arrowUp') + 'Back to top</button>' +
      '<button type="button" data-toc="print">' + icon('printer') + 'Print / save as PDF</button></div></div>';
    tocEl.innerHTML = html;
    tocEl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-toc]');
      if (!b) return;
      if (b.getAttribute('data-toc') === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
      if (b.getAttribute('data-toc') === 'print') printPage(b);
    });
    return heads;
  }

  function decorateHeadings(article) {
    article.querySelectorAll(':scope > h2, :scope > h3, :scope > h4').forEach(function (h) {
      if (TYPE === 'qa' && h.tagName === 'H2' && QA.sectionCounts[h.id]) {
        h.appendChild(el('span', { class: 'qa-section-count' }, QA.sectionCounts[h.id] + ' questions'));
      }
      var a = el('a', { class: 'heading-anchor', href: '#' + h.id, 'aria-label': 'Link to this section' }, '#');
      h.appendChild(a);
    });
  }

  function setupScrollSpy(heads, tocEl) {
    var links = {};
    tocEl.querySelectorAll('a[data-target]').forEach(function (a) { links[a.getAttribute('data-target')] = a; });
    var progress = document.querySelector('.read-progress');
    var toTop = document.querySelector('.to-top');
    var current = null, ticking = false;

    function update() {
      ticking = false;
      var y = window.scrollY;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.width = (docH > 0 ? Math.min(100, (y / docH) * 100) : 0) + '%';
      if (toTop) toTop.classList.toggle('show', y > 900);
      if (!heads.length) return;
      var active = null;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top < 120) active = heads[i]; else break;
      }
      var id = active ? active.id : null;
      if (id === current) return;
      if (current && links[current]) links[current].classList.remove('active');
      current = id;
      if (id && links[id]) {
        var link = links[id];
        link.classList.add('active');
        var box = tocEl;
        var lt = link.offsetTop, bh = box.clientHeight;
        if (lt < box.scrollTop + 60 || lt > box.scrollTop + bh - 80) box.scrollTop = lt - bh / 2;
      }
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ------------------------------------------------------------------ code

  var hlObserver = null;
  function setupCode(root) {
    if (window.hljs) window.hljs.configure({ ignoreUnescapedHTML: true });
    var blocks = root.querySelectorAll('.code-block pre code');
    function highlight(code) {
      if (code.dataset.hl || !window.hljs) return;
      code.dataset.hl = '1';
      try { window.hljs.highlightElement(code); } catch (e) { /* leave plain */ }
    }
    if ('IntersectionObserver' in window) {
      hlObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { hlObserver.unobserve(en.target); highlight(en.target); }
        });
      }, { rootMargin: '400px 0px' });
      blocks.forEach(function (b) { hlObserver.observe(b); });
    } else {
      blocks.forEach(highlight);
    }
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('.copy-btn');
      if (!btn) return;
      var code = btn.closest('.code-block').querySelector('code');
      copyText(code.textContent).then(function () {
        btn.classList.add('copied');
        btn.querySelector('span').textContent = 'Copied';
        setTimeout(function () { btn.classList.remove('copied'); btn.querySelector('span').textContent = 'Copy'; }, 1500);
      });
    });
  }

  // ------------------------------------------------------------------ diagrams

  var mermaidPromise = null;
  var renderChain = Promise.resolve();
  var diagramSeq = 0;
  var diagramObserver = null;

  function mermaidTheme(dark) {
    if (dark) {
      return {
        darkMode: true, background: '#141c27', fontSize: '15px',
        primaryColor: '#15303d', primaryBorderColor: '#3fa9c9', primaryTextColor: '#e6edf5',
        secondaryColor: '#1b2533', secondaryBorderColor: '#51627a', secondaryTextColor: '#e6edf5',
        tertiaryColor: '#121a24', tertiaryBorderColor: '#2d3a4a', tertiaryTextColor: '#e6edf5',
        lineColor: '#8a99ab', textColor: '#dbe4ee', mainBkg: '#15303d', nodeBorder: '#3fa9c9',
        clusterBkg: '#101722', clusterBorder: '#2d3a4a', titleColor: '#e6edf5', edgeLabelBackground: '#141c27',
        actorBkg: '#15303d', actorBorder: '#3fa9c9', actorTextColor: '#e6edf5', actorLineColor: '#51627a',
        signalColor: '#a9b6c6', signalTextColor: '#e6edf5', labelBoxBkgColor: '#1b2533', labelBoxBorderColor: '#51627a',
        labelTextColor: '#e6edf5', loopTextColor: '#c3cedb', noteBkgColor: '#352f17', noteBorderColor: '#a8892c',
        noteTextColor: '#f5e7b5', activationBkgColor: '#1d4454', activationBorderColor: '#3fa9c9',
        sequenceNumberColor: '#0b1017', labelColor: '#e6edf5', altBackground: '#1b2533'
      };
    }
    return {
      darkMode: false, background: '#ffffff', fontSize: '15px',
      primaryColor: '#e3f4fa', primaryBorderColor: '#4aaecb', primaryTextColor: '#0f1b2a',
      secondaryColor: '#f1f5f9', secondaryBorderColor: '#94a3b8', secondaryTextColor: '#0f1b2a',
      tertiaryColor: '#fbfcfe', tertiaryBorderColor: '#cbd5e1', tertiaryTextColor: '#0f1b2a',
      lineColor: '#64748b', textColor: '#1e293b', mainBkg: '#e3f4fa', nodeBorder: '#4aaecb',
      clusterBkg: '#f6f9fc', clusterBorder: '#cbd5e1', titleColor: '#0f1b2a', edgeLabelBackground: '#ffffff',
      actorBkg: '#e3f4fa', actorBorder: '#4aaecb', actorTextColor: '#0f1b2a', actorLineColor: '#94a3b8',
      signalColor: '#475569', signalTextColor: '#0f1b2a', labelBoxBkgColor: '#f1f5f9', labelBoxBorderColor: '#94a3b8',
      labelTextColor: '#0f1b2a', loopTextColor: '#334155', noteBkgColor: '#fff7d6', noteBorderColor: '#e2b93b',
      noteTextColor: '#3f3000', activationBkgColor: '#cdeaf4', activationBorderColor: '#4aaecb',
      sequenceNumberColor: '#ffffff', labelColor: '#0f1b2a', altBackground: '#f1f5f9'
    };
  }

  function configureMermaid(m) {
    m.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: mermaidTheme(isDark()),
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true, padding: 12 },
      sequence: { useMaxWidth: true, mirrorActors: false, boxMargin: 8, noteMargin: 10, messageMargin: 36 },
      state: { useMaxWidth: true },
      suppressErrorRendering: true
    });
  }

  function loadMermaid() {
    if (!mermaidPromise) {
      mermaidPromise = new Promise(function (resolve, reject) {
        if (window.mermaid) return resolve(window.mermaid);
        var s = document.createElement('script');
        s.src = MERMAID_URL; s.async = true;
        s.onload = function () { resolve(window.mermaid); };
        s.onerror = function () { reject(new Error('Could not load the diagram library (offline?).')); };
        document.head.appendChild(s);
      }).then(function (m) { configureMermaid(m); return m; });
    }
    return mermaidPromise;
  }

  function renderDiagram(fig) {
    var state = fig.getAttribute('data-state');
    if (state === 'rendering' || state === 'done') return Promise.resolve();
    fig.setAttribute('data-state', 'rendering');
    var canvas = fig.querySelector('.diagram-canvas');
    var job = function () {
      return loadMermaid().then(function (m) {
        var id = 'mmd-' + (++diagramSeq);
        return m.render(id, fig.getAttribute('data-src')).then(function (res) {
          canvas.classList.remove('pending');
          canvas.innerHTML = res.svg;
          if (res.bindFunctions) res.bindFunctions(canvas);
          fitDiagram(canvas);
          fig.setAttribute('data-state', 'done');
        }, function (err) {
          var tmp = document.getElementById('d' + id);
          if (tmp) tmp.remove();
          throw err;
        });
      }).catch(function (err) {
        canvas.classList.remove('pending');
        canvas.innerHTML = '<div class="diagram-error"><strong>Diagram could not be rendered.</strong> ' +
          esc((err && (err.message || err.str)) || String(err)) + '<pre>' + esc(fig.getAttribute('data-src')) + '</pre></div>';
        fig.setAttribute('data-state', 'error');
        if (window.console) console.error('[diagram]', err);
      });
    };
    renderChain = renderChain.then(job, job);
    return renderChain;
  }

  // Wide diagrams (e.g. sequence diagrams with many participants) would shrink to unreadable text
  // when scaled to the column. Keep a minimum scale and let the canvas scroll horizontally instead.
  function fitDiagram(canvas) {
    var svg = canvas.querySelector('svg');
    if (!svg) return;
    var vb = svg.viewBox && svg.viewBox.baseVal;
    var natural = (vb && vb.width) || parseFloat(svg.style.maxWidth) || 0;
    var avail = canvas.clientWidth - 32;
    if (!natural || avail <= 0) return;
    var minScale = 0.7;
    if (natural * minScale > avail) {
      svg.style.width = Math.round(natural * minScale) + 'px';
      svg.style.maxWidth = 'none';
      svg.style.maxHeight = 'none';
      canvas.classList.add('is-wide');
    }
  }

  function setupDiagrams(root) {
    var figs = root.querySelectorAll('figure.diagram');
    if (!figs.length) return;
    // Warm the (large) diagram library up while the reader is still at the top of the page.
    var warm = function () { loadMermaid().catch(function () { /* surfaced on render */ }); };
    if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 2500 }); else setTimeout(warm, 1200);
    if ('IntersectionObserver' in window) {
      diagramObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { diagramObserver.unobserve(en.target); renderDiagram(en.target); }
        });
      }, { rootMargin: '500px 0px' });
      figs.forEach(function (f) { diagramObserver.observe(f); });
    } else {
      figs.forEach(renderDiagram);
    }
    root.addEventListener('toggle', function (e) {
      if (e.target.tagName === 'DETAILS' && e.target.open) {
        e.target.querySelectorAll('figure.diagram:not([data-state])').forEach(function (f) {
          if (diagramObserver) diagramObserver.unobserve(f);
          renderDiagram(f);
        });
      }
    }, true);
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('.diagram-expand');
      if (!btn) return;
      var fig = btn.closest('figure.diagram');
      var svg = fig.querySelector('.diagram-canvas svg');
      if (!svg) return;
      openLightbox(svg, fig.querySelector('figcaption'));
    });
  }

  function rerenderDiagrams() {
    if (!mermaidPromise) return;
    mermaidPromise.then(function (m) {
      configureMermaid(m);
      document.querySelectorAll('figure.diagram[data-state="done"], figure.diagram[data-state="error"]').forEach(function (fig) {
        fig.removeAttribute('data-state');
        var visible = fig.offsetParent !== null;
        if (visible) renderDiagram(fig);
        else if (diagramObserver) diagramObserver.observe(fig);
      });
    });
  }

  var lightbox = null;
  function openLightbox(svg, caption) {
    if (!lightbox) {
      lightbox = el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Diagram' },
        '<div class="lightbox-inner"><button type="button" class="icon-btn lightbox-close" aria-label="Close">' + icon('x') + '</button><div class="lightbox-body"></div></div>');
      body.appendChild(lightbox);
      lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox || e.target.closest('.lightbox-close')) closeLightbox();
      });
    }
    var holder = lightbox.querySelector('.lightbox-body');
    holder.innerHTML = '';
    var clone = svg.cloneNode(true);
    clone.removeAttribute('style');
    clone.setAttribute('width', '100%');
    holder.appendChild(clone);
    if (caption) holder.appendChild(el('p', { style: 'text-align:center;color:var(--text-muted);font-size:14px;margin:14px 0 0' }, caption.innerHTML));
    lightbox.classList.add('open');
    lightbox.querySelector('.lightbox-close').focus();
  }
  function closeLightbox() { if (lightbox) lightbox.classList.remove('open'); }

  // ------------------------------------------------------------------ print

  function printPage(btn) {
    var label = btn ? btn.lastChild : null;
    var old = label ? label.textContent : '';
    if (label) label.textContent = 'Preparing…';
    var opened = [];
    document.querySelectorAll('details.qa:not([open])').forEach(function (d) { d.open = true; opened.push(d); });
    var figs = Array.prototype.slice.call(document.querySelectorAll('figure.diagram'));
    document.querySelectorAll('.code-block pre code:not([data-hl])').forEach(function (c) {
      if (window.hljs) { c.dataset.hl = '1'; try { window.hljs.highlightElement(c); } catch (e) { /* ignore */ } }
    });
    Promise.all(figs.map(function (f) { return renderDiagram(f); })).then(function () {
      if (label) label.textContent = old;
      setTimeout(function () {
        window.print();
        opened.forEach(function (d) { d.open = false; });
      }, 150);
    });
  }

  // ------------------------------------------------------------------ hash

  function goToHash(hash, smooth) {
    if (!hash || hash.length < 2) return;
    var id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (e) { id = hash.slice(1); }
    var target = document.getElementById(id);
    if (!target) return;
    for (var p = target; p; p = p.parentElement) { if (p.tagName === 'DETAILS') p.open = true; }
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' });
    if (target.classList.contains('qa')) {
      target.classList.remove('flash');
      void target.offsetWidth;
      target.classList.add('flash');
    }
  }

  // ------------------------------------------------------------------ search

  var Search = { modal: null, input: null, results: null, index: null, building: null, items: [], active: -1 };
  var currentSource = '';

  function inlineText(md) {
    var d = document.createElement('div');
    d.innerHTML = window.marked.parseInline(md);
    return d.textContent.trim();
  }

  function plainText(md) {
    return md
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INTERVIEW)\]/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/`+/g, '')
      .replace(/\*\*|__|\*|~~/g, '')
      .replace(/^\s*>+/gm, ' ')
      .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, ' ')
      .replace(/\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractMarkdown(html) {
    var m = html.match(/<script[^>]*id=["']page-content["'][^>]*>([\s\S]*?)<\/script>/i);
    return m ? m[1] : '';
  }

  function indexMarkdown(md, page) {
    var lines = dedent(md).split('\n');
    var used = {}, out = [];
    var inFence = false, fenceChar = '', cur = null, h2 = '', inInterview = false;
    var isQA = page.path.indexOf('questions/') === 0;
    lines.forEach(function (line) {
      var fm = line.match(/^\s*(`{3,}|~{3,})/);
      if (fm) {
        if (!inFence) { inFence = true; fenceChar = fm[1][0]; }
        else if (fm[1][0] === fenceChar) inFence = false;
        return;
      }
      if (inFence) return;
      var hm = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
      if (hm) {
        var level = hm[1].length;
        var text = inlineText(hm[2]);
        var base = slugify(text) || 'section', id = base, n = 1;
        while (used[id]) id = base + '-' + (n++);
        used[id] = true;
        if (level === 2) { h2 = text; inInterview = /^interview questions\b/i.test(text); }
        if (level === 2 || level === 3) {
          cur = {
            path: page.path, pageTitle: page.title, heading: text, id: id,
            section: level === 3 ? h2 : '',
            kind: level === 3 && (isQA || inInterview) ? 'question' : 'section',
            text: ''
          };
          out.push(cur);
        } else if (level === 1) { cur = null; }
        return;
      }
      if (cur && cur.text.length < 900) cur.text += ' ' + line;
    });
    out.forEach(function (e) { e.text = plainText(e.text).slice(0, 420); });
    return out;
  }

  function buildIndex() {
    if (Search.index) return Promise.resolve(Search.index);
    if (Search.building) return Search.building;
    var cacheKey = 'rnh-index:' + (SITE.version || '1');
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) { Search.index = JSON.parse(cached); return Promise.resolve(Search.index); }
    } catch (e) { /* ignore */ }

    var pages = flatNav().filter(function (p) { return p.path !== 'index.html'; });
    var complete = true;
    Search.building = Promise.all(pages.map(function (p, order) {
      var pageEntry = { path: p.path, pageTitle: p.title, heading: p.title, id: '', section: p.section, kind: 'page', text: p.desc || '', order: order };
      var getMd;
      if (p.path === PAGE) getMd = Promise.resolve(currentSource);
      else if (/^https?:$/.test(location.protocol)) {
        getMd = fetch(href(p.path)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
          .then(extractMarkdown).catch(function () { complete = false; return ''; });
      } else { complete = false; getMd = Promise.resolve(''); }
      return getMd.then(function (md) {
        var entries = md ? indexMarkdown(md, p) : [];
        entries.forEach(function (e) { e.order = order; });
        return [pageEntry].concat(entries);
      });
    })).then(function (groups) {
      var entries = [].concat.apply([], groups);
      entries.forEach(function (e) {
        e._h = e.heading.toLowerCase();
        e._s = (e.section + ' ' + e.pageTitle).toLowerCase();
        e._t = e.text.toLowerCase();
      });
      Search.index = { entries: entries, complete: complete };
      if (complete) {
        try {
          var slim = entries.map(function (e) { var c = Object.assign({}, e); delete c._h; delete c._s; delete c._t; return c; });
          sessionStorage.setItem(cacheKey, JSON.stringify({ entries: slim, complete: true }));
        } catch (e) { /* quota */ }
      }
      return Search.index;
    });
    return Search.building;
  }

  function ensureLower(entries) {
    entries.forEach(function (e) {
      if (e._h === undefined) {
        e._h = e.heading.toLowerCase();
        e._s = (e.section + ' ' + e.pageTitle).toLowerCase();
        e._t = e.text.toLowerCase();
      }
    });
  }

  function searchEntries(q) {
    var idx = Search.index;
    if (!idx) return [];
    ensureLower(idx.entries);
    var query = q.toLowerCase().trim();
    var terms = query.split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var results = [];
    idx.entries.forEach(function (e) {
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i];
        var inH = e._h.indexOf(t) !== -1, inS = e._s.indexOf(t) !== -1, inT = e._t.indexOf(t) !== -1;
        if (!inH && !inS && !inT) return;
        if (inH) score += 6 + (e._h.indexOf(t) === 0 ? 2 : 0);
        if (inS) score += 1.5;
        if (inT) score += 1;
      }
      if (terms.length > 1 && e._h.indexOf(query) !== -1) score += 8;
      if (e.kind === 'page') score += 3;
      if (e.kind === 'question') score += 1;
      results.push({ e: e, score: score });
    });
    results.sort(function (a, b) { return b.score - a.score || a.e.order - b.e.order; });
    return results.slice(0, 40).map(function (r) { return r.e; });
  }

  function highlightTerms(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      var re = new RegExp('(' + esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  function snippet(text, terms) {
    if (!text) return '';
    var lower = text.toLowerCase(), pos = -1;
    for (var i = 0; i < terms.length; i++) { pos = lower.indexOf(terms[i]); if (pos !== -1) break; }
    var start = Math.max(0, pos - 60);
    var s = (start > 0 ? '…' : '') + text.slice(start, start + 180) + (text.length > start + 180 ? '…' : '');
    return s;
  }

  function buildSearchModal() {
    var m = el('div', { class: 'search-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search' },
      '<div class="search-panel">' +
      '<div class="search-input-row">' + icon('search') +
      '<input class="search-input" type="search" placeholder="Search questions, guides, APIs…" autocomplete="off" spellcheck="false" aria-label="Search">' +
      '<button type="button" class="icon-btn search-close" aria-label="Close search">' + icon('x') + '</button></div>' +
      '<div class="search-results" role="listbox"></div>' +
      '<div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>' +
      '</div>');
    body.appendChild(m);
    Search.modal = m;
    Search.input = m.querySelector('.search-input');
    Search.results = m.querySelector('.search-results');
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('.search-close')) closeSearch();
    });
    Search.input.addEventListener('input', runSearch);
    Search.input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var item = Search.items[Search.active >= 0 ? Search.active : 0];
        if (item) item.click();
      }
    });
    Search.results.addEventListener('click', function (e) {
      var a = e.target.closest('a.search-item');
      if (!a) return;
      var targetPath = a.getAttribute('data-path');
      if (targetPath === PAGE) {
        e.preventDefault();
        closeSearch();
        var h = a.getAttribute('data-hash');
        if (h) { history.pushState(null, '', h); goToHash(h, true); }
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  function moveActive(delta) {
    if (!Search.items.length) return;
    if (Search.active >= 0) Search.items[Search.active].classList.remove('active');
    Search.active = (Search.active + delta + Search.items.length) % Search.items.length;
    var it = Search.items[Search.active];
    it.classList.add('active');
    it.scrollIntoView({ block: 'nearest' });
  }

  function runSearch() {
    var q = Search.input.value;
    var res = Search.results;
    if (!q.trim()) {
      res.innerHTML = '<div class="search-hint">Try <b>useEffect cleanup</b>, <b>universal links</b>, <b>JSI</b>, <b>APNs</b>, <b>refresh token</b>…' +
        (Search.index && !Search.index.complete ? '<br><br>Full-text search across all pages works when the site is served over http(s) — e.g. on GitHub Pages or <code>python3 -m http.server</code>. Right now only this page and page titles are searchable.' : '') + '</div>';
      Search.items = []; Search.active = -1;
      return;
    }
    var terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    var found = searchEntries(q);
    if (!found.length) {
      res.innerHTML = '<div class="search-empty">No results for “' + esc(q) + '”.</div>';
      Search.items = []; Search.active = -1;
      return;
    }
    var kindLabel = { page: 'Page', question: 'Q&A', section: 'Section' };
    res.innerHTML = found.map(function (e) {
      var hash = e.id ? '#' + e.id : '';
      var path = e.pageTitle + (e.section && e.kind !== 'page' ? ' › ' + e.section : '');
      if (e.kind === 'page') path = e.section;
      return '<a class="search-item" role="option" href="' + href(e.path) + hash + '" data-path="' + esc(e.path) + '" data-hash="' + esc(hash) + '">' +
        '<div class="si-title"><span class="si-kind">' + kindLabel[e.kind] + '</span><span>' + highlightTerms(e.heading, terms) + '</span></div>' +
        '<div class="si-path">' + esc(path) + '</div>' +
        (e.text ? '<div class="si-snippet">' + highlightTerms(snippet(e.text, terms), terms) + '</div>' : '') +
        '</a>';
    }).join('');
    Search.items = Array.prototype.slice.call(res.querySelectorAll('.search-item'));
    Search.active = 0;
    Search.items[0].classList.add('active');
  }

  function openSearch() {
    if (!Search.modal) buildSearchModal();
    Search.modal.classList.add('open');
    body.style.overflow = 'hidden';
    Search.input.focus();
    Search.input.select();
    if (!Search.index) {
      Search.results.innerHTML = '<div class="search-hint">Building search index…</div>';
      buildIndex().then(runSearch);
    } else runSearch();
  }

  function closeSearch() {
    if (!Search.modal) return;
    Search.modal.classList.remove('open');
    body.style.overflow = '';
  }

  // ------------------------------------------------------------------ home

  function renderHome(article) {
    var flat = flatNav();
    article.querySelectorAll('[data-cards]').forEach(function (grid) {
      var sec = (SITE.nav || []).filter(function (s) { return s.id === grid.getAttribute('data-cards'); })[0];
      if (!sec) return;
      grid.innerHTML = sec.items.map(function (it) {
        var total = store.get('total:' + it.path, 0);
        var done = (store.get('reviewed:' + it.path, []) || []).length;
        var foot = '';
        if (sec.id === 'qa') {
          foot = '<div class="card-foot"><span class="level level-' + esc((it.level || '').toLowerCase()) + '">' + esc(it.level || '') + '</span>' +
            (total ? '<span class="card-progress"><span style="width:' + Math.round(Math.min(done, total) / total * 100) + '%"></span></span><span>' + Math.min(done, total) + '/' + total + '</span>'
              : '<span data-count="' + esc(it.path) + '"></span>') + '</div>';
        } else {
          foot = '<div class="card-foot"><span data-count="' + esc(it.path) + '"></span></div>';
        }
        return '<a class="card" href="' + href(it.path) + '"><div class="card-top"><span class="card-icon">' + icon(PAGE_ICONS[it.path] || 'book') + '</span>' +
          '<span class="card-title">' + esc(it.title) + '</span></div><div class="card-desc">' + esc(it.desc || '') + '</div>' + foot + '</a>';
      }).join('');
    });
    var guides = flat.filter(function (p) { return p.path.indexOf('guides/') === 0; }).length;
    setStat('guides', guides);
    // Live counts (needs http(s) to read other pages; falls back to static numbers in the markup).
    buildIndex().then(function (idx) {
      if (!idx.complete) return;
      var q = 0, perPage = {};
      idx.entries.forEach(function (e) {
        if (e.kind === 'question') { q++; perPage[e.path] = (perPage[e.path] || 0) + 1; }
      });
      setStat('questions', q);
      article.querySelectorAll('[data-count]').forEach(function (s) {
        var n = perPage[s.getAttribute('data-count')];
        if (n) s.textContent = n + (s.getAttribute('data-count').indexOf('questions/') === 0 ? ' questions' : ' interview Qs');
      });
    });
  }

  function setStat(name, value) {
    var s = document.querySelector('[data-stat="' + name + '"]');
    if (s) s.textContent = value;
  }

  // ------------------------------------------------------------------ global events

  function setupGlobal(refs) {
    var menuBtn = document.querySelector('.menu-btn');
    function setNav(open) {
      body.classList.toggle('nav-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    }
    menuBtn.addEventListener('click', function () { setNav(!body.classList.contains('nav-open')); });
    document.querySelector('.scrim').addEventListener('click', function () { setNav(false); });
    refs.sidebar.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });

    document.querySelector('.theme-btn').addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
      rerenderDiagrams();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (!document.documentElement.getAttribute('data-theme')) rerenderDiagrams(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    }

    document.querySelector('.search-trigger').addEventListener('click', openSearch);
    document.querySelectorAll('[data-open-search]').forEach(function (b) { b.addEventListener('click', openSearch); });
    document.querySelector('.to-top').addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openSearch(); return; }
      if (e.key === '/' && !typing) { e.preventDefault(); openSearch(); return; }
      if (e.key === 'Escape') { closeSearch(); closeLightbox(); setNav(false); }
    });

    window.addEventListener('hashchange', function () { goToHash(location.hash, true); });
    window.addEventListener('beforeprint', function () {
      document.querySelectorAll('details.qa').forEach(function (d) { d.open = true; });
    });

    // keep sidebar's active item in view
    var active = refs.sidebar.querySelector('.nav-link.active');
    if (active && refs.sidebar.scrollHeight > refs.sidebar.clientHeight) {
      refs.sidebar.scrollTop = active.offsetTop - refs.sidebar.clientHeight / 2;
    }
  }

  function buildPager(main) {
    if (TYPE === 'home') return;
    var flat = flatNav();
    var i = -1;
    flat.forEach(function (p, j) { if (p.path === PAGE) i = j; });
    if (i === -1) return;
    var prev = flat[i - 1], next = flat[i + 1];
    var html = '';
    if (prev) html += '<a class="prev" href="' + href(prev.path) + '"><small>← Previous</small><strong>' + esc(prev.title) + '</strong></a>';
    if (next) html += '<a class="next" href="' + href(next.path) + '"><small>Next →</small><strong>' + esc(next.title) + '</strong></a>';
    main.appendChild(el('nav', { class: 'pager', 'aria-label': 'Pagination' }, html));
  }

  function buildFooter(main) {
    var year = new Date().getFullYear();
    main.appendChild(el('footer', { class: 'site-footer' },
      '<span>' + esc(SITE.title) + ' · ' + year + '</span>' +
      '<span>Content reflects the React Native ecosystem as of late 2026 — always verify store policies against official docs.</span>'));
  }

  // ------------------------------------------------------------------ boot

  function boot() {
    var src = document.getElementById('page-content');
    var refs = buildShell();
    var article = refs.article;

    if (!src) { article.innerHTML = '<div class="boot-error">No content found on this page.</div>'; return; }
    var isHtml = (src.getAttribute('type') || '').indexOf('html') !== -1;
    currentSource = src.textContent || '';

    if (!isHtml && !window.marked) {
      article.innerHTML = '<div class="boot-error"><h2>Could not load the Markdown renderer</h2><p>This page loads marked.js from a CDN. Check your internet connection and reload.</p></div>';
      setupGlobal(refs);
      return;
    }

    article.innerHTML = isHtml ? currentSource : renderMarkdown(dedent(currentSource));

    enhanceCallouts(article);
    assignHeadingIds(article);
    enhanceMisc(article);
    var qaCount = buildQA(article);
    if (TYPE !== 'home') pageMeta(article, qaCount);
    if (TYPE === 'qa' && qaCount) insertToolbar(article);
    if (qaCount) updateProgress();
    var heads = buildToc(article, refs.toc);
    if (TYPE !== 'home') decorateHeadings(article);
    setupCode(article);
    setupDiagrams(article);
    buildPager(refs.main);
    buildFooter(refs.main);
    setupGlobal(refs);
    setupScrollSpy(heads, refs.toc.isConnected ? refs.toc : el('div'));
    if (TYPE === 'home') renderHome(article);

    if (location.hash) {
      requestAnimationFrame(function () { goToHash(location.hash, false); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
