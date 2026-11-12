/* CampusNex - application script (vanilla JavaScript, no libraries).
   Runs on both pages; data-page on <body> selects the behaviour. */
(function () {
  'use strict';

  var STUDENT_KEY = 'campusnex.student';
  var API_KEY = 'campusnex.apiBase';
  var TZ = 'Asia/Kolkata';

  /* ------------------------------------------------------------------ helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad(n) { return String(n).padStart(2, '0'); }

  function getStudent() {
    try { return JSON.parse(sessionStorage.getItem(STUDENT_KEY)); } catch (e) { return null; }
  }
  function setStudent(s) {
    try { sessionStorage.setItem(STUDENT_KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }
  function clearStudent() {
    try { sessionStorage.removeItem(STUDENT_KEY); } catch (e) { /* ignore */ }
  }

  function apiBase() {
    var v = '';
    try { v = localStorage.getItem(API_KEY) || ''; } catch (e) { /* storage blocked */ }
    if (!v && window.CAMPUSNEX_CONFIG) v = window.CAMPUSNEX_CONFIG.apiBase || '';
    return v.replace(/\/+$/, '');
  }
  function apiUrl(path) {
    var b = apiBase();
    return (b ? b + '/' : '') + 'api/' + path;
  }
  function absolute(url) {
    try { return new URL(url, window.location.href).href; } catch (e) { return url; }
  }

  /** fetch() wrapper with timeout; always resolves with a result object or rejects with Error. */
  function apiFetch(path, opts) {
    opts = opts || {};
    var url = apiUrl(path);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, opts.timeout || 6000);
    var init = { method: opts.method || 'GET', signal: ctrl.signal, cache: 'no-store' };
    if (apiBase()) init.credentials = 'include';
    if (opts.body) {
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
      init.body = opts.body;
    }
    var t0 = performance.now();
    return fetch(url, init).then(function (res) {
      return res.text().then(function (text) {
        var json = null;
        try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
        return {
          url: absolute(url), method: init.method, status: res.status, statusText: res.statusText,
          text: text, json: json, ms: Math.round(performance.now() - t0),
          headers: Array.from(res.headers.entries()), body: opts.body || ''
        };
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw new Error('request timed out');
      throw err;
    }).finally(function () { clearTimeout(timer); });
  }

  /* ============================================================== LOGIN PAGE */
  function initLogin() {
    var form = $('#login-form');
    var banner = $('#resumeBanner');
    var existing = getStudent();
    if (existing && existing.name) {
      $('#resumeName').textContent = existing.name;
      banner.hidden = false;
    }

    var rules = {
      studentName: function (v) {
        if (!v) return 'Enter your full name.';
        if (!/^[A-Za-z][A-Za-z .'-]{2,59}$/.test(v)) return 'Use 3 to 60 letters (spaces, dots and hyphens allowed).';
        return '';
      },
      rrn: function (v) {
        if (!v) return 'Enter your registration number.';
        if (!/^\d{12}$/.test(v)) return 'The RRN must be exactly 12 digits.';
        return '';
      },
      className: function (v) {
        if (!v) return 'Enter your class, for example CSE - B.';
        if (!/^[A-Za-z0-9 .\-]{2,20}$/.test(v)) return 'Use 2 to 20 letters, digits, spaces or hyphens.';
        return '';
      },
      year: function (v) { return v ? '' : 'Select your year of study.'; },
      password: function (v) {
        if (!v) return 'Enter a password.';
        if (v.length < 6) return 'The demo password needs at least 6 characters.';
        return '';
      }
    };

    function value(id) {
      var el = document.getElementById(id);
      return id === 'password' ? el.value : el.value.trim();
    }
    function check(id, show) {
      var msg = rules[id](value(id));
      var el = document.getElementById(id);
      var out = document.getElementById(id + '-error');
      if (show) {
        out.textContent = msg;
        if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      }
      return msg === '';
    }

    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('blur', function () { check(id, true); });
      el.addEventListener('input', function () { if (el.hasAttribute('aria-invalid')) check(id, true); });
    });

    $('#togglePassword').addEventListener('click', function () {
      var pw = $('#password');
      var show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      this.textContent = show ? 'Hide' : 'Show';
      this.setAttribute('aria-pressed', String(show));
    });

    $('#fillDemo').addEventListener('click', function () {
      $('#studentName').value = 'Mohammed Rahil';
      $('#rrn').value = '240071601104';
      $('#className').value = 'CSE - B';
      $('#year').value = '3rd Year';
      $('#password').value = 'campusnex';
      Object.keys(rules).forEach(function (id) { check(id, true); });
      $('#formError').textContent = '';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      Object.keys(rules).forEach(function (id) {
        if (!check(id, true) && !firstBad) firstBad = id;
      });
      var err = $('#formError');
      if (firstBad) {
        err.textContent = 'Please correct the highlighted fields.';
        document.getElementById(firstBad).focus();
        return;
      }
      err.textContent = '';
      var ok = setStudent({
        name: value('studentName').replace(/\s+/g, ' '),
        rrn: value('rrn'),
        className: value('className'),
        year: value('year'),
        loginAt: new Date().toISOString()
      });
      if (!ok) {
        err.textContent = 'Your browser blocked session storage, so the demo sign-in cannot continue. Enable storage and try again.';
        return;
      }
      window.location.href = 'dashboard.html';
    });
  }

  /* ========================================================== DASHBOARD PAGE */
  var student = null;

  /* ---------- clock (Laboratory 5) ---------- */
  var clock = { offset: 0, kind: 'pending', label: 'Waiting for first sync', meta: '', syncing: false };
  var fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  var fmtDate = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });

  function nowMs() { return Date.now() + clock.offset; }

  function renderClock() {
    var d = new Date(nowMs());
    var t = fmtTime.format(d);
    var el = $('#clockTime');
    if (el.textContent !== t) el.textContent = t;
    $('#clockDate').textContent = fmtDate.format(d);
  }

  function renderClockStatus() {
    var src = $('#clockSource');
    src.textContent = clock.label;
    src.setAttribute('data-kind', clock.kind);
    $('#clockMeta').textContent = clock.meta || '\u00a0';
    $('#labClockSource').textContent = clock.label;
    $('#labClockMeta').textContent = clock.meta || '\u00a0';
  }

  function sign(n) { return (n >= 0 ? '+' : '') + Math.round(n) + ' ms'; }

  function tryServletNtp() {
    var t0 = Date.now();
    return apiFetch('ntp', { timeout: 5000 }).then(function (r) {
      var t1 = Date.now();
      if (r.status !== 200 || !r.json || typeof r.json.epochMillis !== 'number') throw new Error('servlet unavailable');
      var rtt = t1 - t0;
      var offset = r.json.epochMillis + rtt / 2 - t1;
      if (r.json.source === 'NTP') {
        return { kind: 'ntp', offset: offset, rtt: rtt,
          label: 'NTP via Java servlet (' + r.json.ntpServer + ', stratum ' + r.json.stratum + ')',
          note: 'UDP NTP query made by the servlet, not the browser' };
      }
      return { kind: 'servlet', offset: offset, rtt: rtt,
        label: 'Servlet host clock (server could not reach NTP)',
        note: r.json.fallbackReason || 'NTP unreachable from server' };
    });
  }

  function tryHttpApi() {
    function once(url, parse, name) {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 3500);
      var t0 = Date.now();
      return fetch(url, { cache: 'no-store', signal: ctrl.signal }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (json) {
        var t1 = Date.now();
        var server = parse(json);
        if (!isFinite(server)) throw new Error('bad time value');
        var rtt = t1 - t0;
        return { kind: 'http', offset: server + rtt / 2 - t1, rtt: rtt,
          label: 'HTTP time API (' + name + ')', note: 'HTTP over TCP, not the NTP protocol' };
      }).finally(function () { clearTimeout(timer); });
    }
    return once('https://worldtimeapi.org/api/timezone/Etc/UTC', function (j) { return Date.parse(j.utc_datetime); }, 'worldtimeapi.org')
      .catch(function () {
        return once('https://timeapi.io/api/Time/current/zone?timeZone=UTC', function (j) { return Date.parse(String(j.dateTime).slice(0, 23) + 'Z'); }, 'timeapi.io');
      });
  }

  function tryDateHeader() {
    var t0 = Date.now();
    return fetch(window.location.pathname, { method: 'HEAD', cache: 'no-store' }).then(function (res) {
      var t1 = Date.now();
      var h = res.headers.get('Date');
      var server = Date.parse(h);
      if (!isFinite(server)) throw new Error('no Date header');
      var rtt = t1 - t0;
      return { kind: 'http', offset: server + 500 + rtt / 2 - t1, rtt: rtt,
        label: 'HTTP Date header of this site (\u00b11 s)', note: 'Resolution is one second' };
    });
  }

  function syncClock() {
    if (clock.syncing) return Promise.resolve();
    clock.syncing = true;
    ['syncBtn', 'labSync'].forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = true; });
    $('#clockSource').textContent = 'Synchronising\u2026';
    $('#clockSource').setAttribute('data-kind', 'pending');

    var servletResult = null;
    return tryServletNtp().then(function (r) { servletResult = r; return r; }).catch(function () { return null; })
      .then(function (r) {
        if (r && r.kind === 'ntp') return r;
        return tryHttpApi().catch(function () { return null; }).then(function (h) {
          if (h) return h;
          if (servletResult) return servletResult;
          return tryDateHeader().catch(function () { return null; });
        });
      })
      .then(function (r) {
        if (r) {
          clock.offset = r.offset; clock.kind = r.kind; clock.label = r.label;
          clock.meta = 'Offset ' + sign(r.offset) + ' \u00b7 round trip ' + r.rtt + ' ms \u00b7 synced ' + fmtTime.format(new Date(nowMs())) + ' IST \u00b7 ' + r.note;
        } else {
          clock.offset = 0; clock.kind = 'local'; clock.label = 'Device clock (no network time source reachable)';
          clock.meta = 'Showing your device time. Check the connection and press Synchronise.';
        }
      })
      .finally(function () {
        clock.syncing = false;
        ['syncBtn', 'labSync'].forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = false; });
        renderClockStatus(); renderClock(); updateGreeting();
      });
  }

  function initClock() {
    renderClock();
    setInterval(renderClock, 250);
    $('#syncBtn').addEventListener('click', syncClock);
    $('#labSync').addEventListener('click', syncClock);
    syncClock();
    setInterval(syncClock, 5 * 60 * 1000);
  }

  /* ---------- profile & greeting ---------- */
  function greetingPart() {
    var h = parseInt(fmtHour.format(new Date(nowMs())), 10);
    return h < 12 ? 'morning' : (h < 17 ? 'afternoon' : 'evening');
  }
  function updateGreeting() {
    var first = student.name.split(' ')[0];
    $('#greeting').textContent = 'Good ' + greetingPart() + ', ' + first;
  }
  function initProfile() {
    $('#avatar').textContent = student.name.charAt(0).toUpperCase();
    $('#profName').textContent = student.name;
    $('#profRrn').textContent = student.rrn;
    $('#profClass').textContent = student.className;
    $('#profYear').textContent = student.year;
    $('#profSigned').textContent = new Date(student.loginAt).toLocaleTimeString('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) + ' IST';
    $('#reqName').value = student.name;
    updateGreeting();
    $('#logoutBtn').addEventListener('click', function () {
      clearStudent();
      window.location.href = 'index.html';
    });
  }

  /* ---------- navigation ---------- */
  function initNav() {
    var toggle = $('#navToggle');
    var nav = $('#mainNav');
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $all('a', nav).forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); });
    });
    var links = $all('a', nav);
    var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    var ticking = false;
    function mark() {
      var current = 0;
      sections.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= 140) current = i; });
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = sections.length - 1;
      links.forEach(function (a, i) {
        if (i === current) a.classList.add('is-active'); else a.classList.remove('is-active');
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
    mark();
  }

  /* ---------- servlet hit counter (Laboratory 9) ---------- */
  function setBackend(online, detail) {
    var chip = $('#backendChip');
    chip.setAttribute('data-state', online ? 'ok' : 'off');
    chip.textContent = online ? 'Servlet: online' : 'Servlet: offline';
    chip.title = detail || '';
  }

  function showHits(json, counted) {
    ['ovSession', 'labSession'].forEach(function (id) { $('#' + id).textContent = json.sessionHits; });
    ['ovApp', 'labApp'].forEach(function (id) { $('#' + id).textContent = json.applicationHits; });
    var msg = (counted ? 'Hit counted' : 'Read only, nothing counted') + ' \u00b7 session ' + json.sessionId +
      (json.newSession ? ' (new)' : '') + ' \u00b7 app started ' + String(json.applicationStartedAt).replace('T', ' ').slice(0, 19) + ' UTC';
    $('#ovStatus').textContent = msg;
    $('#labHitStatus').textContent = msg;
  }
  function hitsOffline(err) {
    ['ovSession', 'ovApp', 'labSession', 'labApp'].forEach(function (id) { $('#' + id).textContent = '-'; });
    var msg = 'Servlet not reachable (' + (err && err.message ? err.message : 'error') + '). Tried ' + absolute(apiUrl('hits')) + '. Start Tomcat or set the backend URL in Web Labs.';
    $('#ovStatus').textContent = msg;
    $('#labHitStatus').textContent = msg;
    setBackend(false, msg);
  }
  function callHits(peek) {
    return apiFetch('hits' + (peek ? '?peek=true' : '')).then(function (r) {
      if (r.status !== 200 || !r.json || typeof r.json.sessionHits !== 'number') throw new Error('HTTP ' + r.status + ', not the CampusNex servlet');
      setBackend(true, 'Connected to ' + r.url);
      showHits(r.json, !peek);
      return r;
    }).catch(function (e) { hitsOffline(e); });
  }
  function initHits() {
    $('#hitRaw').href = apiUrl('hits') + '?format=html';
    $('#ovCount').addEventListener('click', function () { callHits(false); });
    $('#hitCount').addEventListener('click', function () { callHits(false); });
    $('#hitPeek').addEventListener('click', function () { callHits(true); });
    $('#hitReset').addEventListener('click', function () {
      apiFetch('hits', { method: 'POST', body: 'action=reset-session' }).then(function (r) {
        if (r.status !== 200) throw new Error('HTTP ' + r.status);
        return callHits(true).then(function () {
          $('#labHitStatus').textContent = 'New session started. ' + $('#labHitStatus').textContent;
        });
      }).catch(hitsOffline);
    });
    callHits(false); // opening the dashboard counts as one visit
  }

  /* ---------- slideshow (Laboratory 6) ---------- */
  function initSlideshow() {
    var root = $('#slideshow');
    var slides = $all('.slide', root);
    var dotsBox = $('#dots');
    var progress = $('#progress');
    var status = $('#slideStatus');
    var playBtn = $('#playToggle');
    var INTERVAL = 4500;
    var index = 0, timer = null, playing = true, hovering = false;
    progress.style.setProperty('--slide-ms', INTERVAL + 'ms');

    var dots = slides.map(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'dot';
      b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      b.addEventListener('click', function () { show(i); restart(); });
      dotsBox.appendChild(b);
      return b;
    });

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) {
        s.classList.toggle('is-active', n === index);
        s.setAttribute('aria-hidden', String(n !== index));
      });
      dots.forEach(function (d, n) { d.setAttribute('aria-current', String(n === index)); });
      var cap = $('strong', slides[index]).textContent;
      status.textContent = 'Slide ' + (index + 1) + ' of ' + slides.length + ': ' + cap;
    }
    function runProgress() {
      progress.classList.remove('run');
      void progress.offsetWidth; // restart CSS animation
      if (playing && !hovering) progress.classList.add('run');
    }
    function schedule() {
      clearTimeout(timer);
      if (!playing || hovering) { progress.classList.remove('run'); return; }
      runProgress();
      timer = setTimeout(function () { show(index + 1); schedule(); }, INTERVAL);
    }
    function restart() { schedule(); }

    $('#prevSlide').addEventListener('click', function () { show(index - 1); restart(); });
    $('#nextSlide').addEventListener('click', function () { show(index + 1); restart(); });
    playBtn.addEventListener('click', function () {
      playing = !playing;
      playBtn.textContent = playing ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', String(!playing));
      schedule();
    });
    root.addEventListener('mouseenter', function () { hovering = true; schedule(); });
    root.addEventListener('mouseleave', function () { hovering = false; schedule(); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { show(index - 1); restart(); }
      if (e.key === 'ArrowRight') { show(index + 1); restart(); }
    });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      playing = false; playBtn.textContent = 'Play'; playBtn.setAttribute('aria-pressed', 'true');
    }
    show(0);
    schedule();
  }

  /* ---------- map + directory (Laboratories 1 and 3) ---------- */
  function initMapAndDirectory() {
    var rows = $all('#dirBody tr[data-loc]');
    var data = {};
    rows.forEach(function (tr) {
      var c = tr.children;
      data[tr.dataset.loc] = {
        id: tr.dataset.loc, row: tr, name: c[0].textContent.trim(), category: tr.dataset.category,
        desc: tr.dataset.desc, block: c[2].textContent.trim(), floor: c[3].textContent.trim(),
        hours: c[4].textContent.trim(), ext: c[5].textContent.trim()
      };
    });

    var chips = $('#chips');
    Object.keys(data).forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.loc = id;
      b.textContent = data[id].name; b.setAttribute('aria-pressed', 'false');
      chips.appendChild(b);
    });

    var selected = null;
    function select(id) {
      var d = data[id];
      if (!d) return;
      selected = id;
      $all('.map-pin, .chip').forEach(function (el) { el.setAttribute('aria-pressed', String(el.dataset.loc === id)); });
      rows.forEach(function (tr) { tr.classList.toggle('is-selected', tr.dataset.loc === id); });
      $('#infoTag').textContent = d.category;
      $('#infoName').textContent = d.name;
      $('#infoDesc').textContent = d.desc;
      $('#infoBlock').textContent = d.block;
      $('#infoFloor').textContent = d.floor;
      $('#infoHours').textContent = d.hours;
      $('#infoExt').textContent = d.ext;
      $('#infoToDirectory').disabled = false;
    }
    $all('.map-pin, .chip').forEach(function (el) {
      el.addEventListener('click', function () { select(el.dataset.loc); });
    });
    $('#infoToDirectory').addEventListener('click', function () {
      if (!selected) return;
      var row = data[selected].row;
      if (row.hidden) { $('#dirClear').click(); }
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $all('[data-show-map]').forEach(function (b) {
      b.addEventListener('click', function () {
        select(b.dataset.showMap);
        $('#map-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // directory filtering
    var search = $('#dirSearch'), cat = $('#dirCategory'), count = $('#dirCount'), empty = $('#dirEmpty');
    function filter() {
      var q = search.value.trim().toLowerCase();
      var c = cat.value;
      var shown = 0;
      rows.forEach(function (tr) {
        var text = tr.textContent.toLowerCase();
        var ok = (!q || text.indexOf(q) !== -1) && (!c || tr.dataset.category === c);
        tr.hidden = !ok;
        if (ok) shown++;
      });
      empty.hidden = shown !== 0;
      count.textContent = 'Showing ' + shown + ' of ' + rows.length + ' locations';
    }
    search.addEventListener('input', filter);
    cat.addEventListener('change', filter);
    $('#dirClear').addEventListener('click', function () { search.value = ''; cat.value = ''; filter(); search.focus(); });
  }

  /* ---------- servlet request / response (Laboratory 8) ---------- */
  function initServletForm() {
    var form = $('#reqForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var method = $('#reqMethod').value;
      var name = $('#reqName').value.trim();
      var message = $('#reqMessage').value.trim();
      var params = new URLSearchParams();
      if (name) params.set('name', name);
      if (message) params.set('message', message);

      var path = 'hello', body = '';
      if (method === 'GET') { if (params.toString()) path += '?' + params.toString(); }
      else { body = params.toString(); }

      var target = absolute(apiUrl(path));
      var u = new URL(target);
      var req = method + ' ' + u.pathname + u.search + ' HTTP/1.1\nHost: ' + u.host;
      if (method === 'POST') req += '\nContent-Type: application/x-www-form-urlencoded;charset=UTF-8\n\n' + body;
      req += (method === 'GET' ? '\n' : '') + '\n(The browser adds more headers such as User-Agent and Accept.)';
      $('#reqOut').textContent = req;
      $('#resOut').textContent = 'Waiting for the servlet\u2026';
      var btn = $('#reqSend'); btn.disabled = true;

      apiFetch(path, { method: method, body: body }).then(function (r) {
        var out = 'HTTP ' + r.status + ' ' + r.statusText + '   (' + r.ms + ' ms)\n';
        r.headers.forEach(function (h) {
          if (/^(content-type|x-served-by|date|set-cookie)$/i.test(h[0])) out += h[0] + ': ' + h[1] + '\n';
        });
        out += '\n';
        out += r.json ? JSON.stringify(r.json, null, 2) : r.text.slice(0, 1200);
        if (r.status !== 200 || !r.json) out += '\n\nThis does not look like a CampusNex servlet response. Is Tomcat running with the WAR deployed?';
        $('#resOut').textContent = out;
      }).catch(function (err) {
        $('#resOut').textContent = 'No response: ' + err.message + '\nTried ' + target + '\nStart Apache Tomcat and deploy campusnex.war (see README), or set the backend URL below.';
      }).finally(function () { btn.disabled = false; });
    });
  }

  /* ---------- static to dynamic (Laboratory 10) ---------- */
  function sanitizeFragment(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    $all('script, iframe, object, embed, link, style', tpl.content).forEach(function (n) { n.remove(); });
    $all('*', tpl.content).forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || /^javascript:/i.test(a.value)) n.removeAttribute(a.name);
      });
    });
    return tpl.content;
  }
  function initStaticDynamic() {
    var out = $('#dynOut'), label = $('#dynSource');
    var initial = out.innerHTML, initialLabel = label.textContent;

    $('#btnJs').addEventListener('click', function () {
      var d = new Date(nowMs());
      var art = document.createElement('article');
      art.className = 'servlet-fragment';
      var h = document.createElement('h4');
      h.textContent = 'Good ' + greetingPart() + ', ' + student.name;
      var p1 = document.createElement('p');
      p1.textContent = 'This text was built by JavaScript in your browser from your sign-in details. It is ' +
        fmtDate.format(d) + ', ' + fmtTime.format(d) + ' IST.';
      var p2 = document.createElement('p');
      p2.className = 'fine';
      p2.textContent = 'Class ' + student.className + ', ' + student.year + '. No server was involved: the DOM was changed locally.';
      art.appendChild(h); art.appendChild(p1); art.appendChild(p2);
      out.replaceChildren(art);
      label.textContent = 'Dynamic: generated by JavaScript in the browser';
    });

    $('#btnServlet').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      label.textContent = 'Requesting /api/notices from the servlet\u2026';
      apiFetch('notices?name=' + encodeURIComponent(student.name)).then(function (r) {
        var ct = (r.headers.filter(function (h) { return h[0].toLowerCase() === 'content-type'; })[0] || ['', ''])[1];
        if (r.status !== 200 || ct.indexOf('text/html') === -1 || r.text.indexOf('servlet-fragment') === -1) throw new Error('HTTP ' + r.status + ', unexpected response');
        out.replaceChildren(sanitizeFragment(r.text));
        label.textContent = 'Dynamic: HTML generated by Java Servlet (' + r.ms + ' ms)';
      }).catch(function (err) {
        out.innerHTML = '';
        var p = document.createElement('p');
        p.className = 'state-bad';
        p.textContent = 'Servlet not reachable (' + err.message + '). Tried ' + absolute(apiUrl('notices')) + '. Start Tomcat to see server-generated content.';
        out.appendChild(p);
        label.textContent = 'Error: no servlet response';
      }).finally(function () { btn.disabled = false; });
    });

    $('#btnStaticReset').addEventListener('click', function () {
      out.innerHTML = initial; label.textContent = initialLabel;
    });
  }

  /* ---------- W3C helper (Laboratory 4) ---------- */
  function initW3c() {
    var status = $('#copyStatus');
    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    $('#copyHtml').addEventListener('click', function () {
      fetch(window.location.pathname, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (html) {
        var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(html) : Promise.reject(new Error('no clipboard API'));
        return p.catch(function () { if (!fallbackCopy(html)) throw new Error('copy blocked'); });
      }).then(function () {
        status.textContent = 'Copied. Paste it into the "Validate by Direct Input" box at validator.w3.org.';
      }).catch(function (e) {
        status.textContent = 'Could not copy automatically (' + e.message + '). Use your browser\u2019s View Source, or the File Upload option.';
      });
    });
  }

  /* ---------- backend settings ---------- */
  function initApiSettings() {
    var input = $('#apiBase'), status = $('#apiStatus');
    try { input.value = localStorage.getItem(API_KEY) || ''; } catch (e) { /* ignore */ }
    $('#apiSave').addEventListener('click', function () {
      var v = input.value.trim().replace(/\/+$/, '');
      if (v && !/^https?:\/\/[^\s]+$/i.test(v)) { status.textContent = 'Enter a full http:// or https:// URL, or leave the box empty.'; input.focus(); return; }
      try { if (v) localStorage.setItem(API_KEY, v); else localStorage.removeItem(API_KEY); } catch (e) { status.textContent = 'Storage blocked; the URL applies only until you reload.'; }
      $('#hitRaw').href = apiUrl('hits') + '?format=html';
      status.textContent = 'Testing ' + absolute(apiUrl('hits')) + '\u2026';
      callHits(true).then(function () {
        status.textContent = $('#backendChip').getAttribute('data-state') === 'ok' ? 'Connected to the servlet backend.' : 'Could not connect. Check the URL, that Tomcat is running, and the CORS allowedOrigins setting.';
        syncClock();
      });
    });
    $('#apiReset').addEventListener('click', function () {
      try { localStorage.removeItem(API_KEY); } catch (e) { /* ignore */ }
      input.value = '';
      $('#hitRaw').href = apiUrl('hits') + '?format=html';
      status.textContent = 'Using the same origin as this page.';
      callHits(true);
    });
  }

  /* ---------- scroll reveal ---------- */
  function initReveal() {
    if (!('IntersectionObserver' in window)) return;
    var els = $all('.card, .slideshow, .map-canvas, .table-wrap');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  function initDashboard() {
    student = getStudent();
    if (!student || !student.name) { window.location.replace('index.html'); return; }
    initProfile();
    initNav();
    initSlideshow();
    initMapAndDirectory();
    initServletForm();
    initStaticDynamic();
    initW3c();
    initApiSettings();
    initClock();
    initHits();
    initReveal();
  }

  /* ------------------------------------------------------------------ boot */
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    if (page === 'login') initLogin();
    else if (page === 'dashboard') initDashboard();
  });
})();
