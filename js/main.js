/* ==========================================================================
   Observatorio Juárez — main.js
   All interactivity. Vanilla JS, no dependencies except optional global Leaflet.
   Defensive: every hook is guarded; missing elements are skipped silently.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // Respect user's motion preference (used by counters and bars).
  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Category -> color map (matches CSS palette in DESIGN.md).
  var CAT_COLORS = {
    baches: '#9E2B25',    // rust
    basura: '#4A5D3A',    // olive
    alumbrado: '#C4A575', // desert
    obras: '#1A1714',     // ink
    // denuncias categories
    gobierno: '#C4A575',
    corrupcion: '#9E2B25',
    abusos: '#6E1B17',
    investigacion: '#4A5D3A'
  };

  /* ----------------------------------------------------------------------
     1. Mobile nav toggle (#nav-toggle -> .open on #nav-menu)
     ---------------------------------------------------------------------- */
  (function initNavToggle() {
    var toggle = document.getElementById('nav-toggle');
    var menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close the menu when a link inside it is clicked (mobile UX).
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  })();

  /* ----------------------------------------------------------------------
     1b. Scroll FX: progress bar (#scroll-progress) + nav shadow (.scrolled)
     ---------------------------------------------------------------------- */
  (function initScrollFx() {
    var bar = document.getElementById('scroll-progress');
    var nav = document.getElementById('nav');
    if (!bar && !nav) return;

    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      if (bar) bar.style.transform = 'scaleX(' + pct + ')';
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 8);
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    update();
  })();

  /* ----------------------------------------------------------------------
     Helpers: number formatting + easeOut
     ---------------------------------------------------------------------- */
  function formatNumber(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function easeOutQuad(t) {
    return t * (2 - t);
  }

  // Remove static fallback notes once JS populates a container.
  function removeEmptyNotes(container) {
    if (!container) return;
    container.querySelectorAll('.empty-note').forEach(function (n) { n.remove(); });
  }

  /* ----------------------------------------------------------------------
     2. Counters (.counter[data-target]) animate 0 -> target when visible
     ---------------------------------------------------------------------- */
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute('data-target')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';

    if (prefersReducedMotion) {
      el.textContent = formatNumber(target) + suffix;
      return;
    }

    var duration = 1500; // ms
    var start = null;

    function step(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var value = target * easeOutQuad(progress);
      el.textContent = formatNumber(value) + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = formatNumber(target) + suffix;
      }
    }

    window.requestAnimationFrame(step);
  }

  /* ----------------------------------------------------------------------
     3. Infographic bars (.tema-bar[data-pct]) animate width when visible
     ---------------------------------------------------------------------- */
  function animateBar(el) {
    var pct = parseFloat(el.getAttribute('data-pct')) || 0;
    if (prefersReducedMotion) {
      el.style.width = pct + '%';
      return;
    }
    // Force a reflow-free deferred set so the CSS transition kicks in.
    el.style.width = '0%';
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        el.style.width = pct + '%';
      });
    });
  }

  /* ----------------------------------------------------------------------
     IntersectionObserver: generic .reveal + counters + bars (fire once)
     ---------------------------------------------------------------------- */
  (function initObservers() {
    if (!('IntersectionObserver' in window)) {
      // No IO support: reveal everything immediately, set final values.
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('visible');
      });
      document.querySelectorAll('.counter[data-target]').forEach(animateCounter);
      document.querySelectorAll('.tema-bar[data-pct]').forEach(function (el) {
        el.style.width = (parseFloat(el.getAttribute('data-pct')) || 0) + '%';
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;

        if (el.classList.contains('reveal')) {
          el.classList.add('visible');
        }
        if (el.classList.contains('counter')) {
          animateCounter(el);
        }
        if (el.classList.contains('tema-bar')) {
          animateBar(el);
        }
        obs.unobserve(el); // once only
      });
    }, { threshold: 0.15 });

    // Observe now. (Elements populated by JS below register themselves.)
    function observeAll() {
      document.querySelectorAll('.reveal, .counter[data-target], .tema-bar[data-pct]')
        .forEach(function (el) { observer.observe(el); });
    }
    observeAll();

    // Expose so dynamically-created nodes (timeline) can be observed too.
    window.__ojObserve = function (el) { observer.observe(el); };
  })();

  /* ----------------------------------------------------------------------
     4. Gallery grid (#galeria-grid) populated from FOTOS + lightbox
     ---------------------------------------------------------------------- */
  (function initGallery() {
    var grid = document.getElementById('galeria-grid');
    if (!grid || typeof FOTOS === 'undefined') return;

    removeEmptyNotes(grid);

    FOTOS.forEach(function (foto) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'galeria-item reveal';
      item.style.background = foto.gradient;
      item.setAttribute('aria-label', foto.tema + ' — ' + foto.colonia);
      item.setAttribute('data-caption', foto.caption);

      var label = document.createElement('span');
      label.className = 'galeria-caption';
      label.textContent = foto.tema + ' — ' + foto.colonia;
      item.appendChild(label);

      grid.appendChild(item);
      if (window.__ojObserve) window.__ojObserve(item);
    });

    // Lightbox handling.
    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightbox-img');
    var lightboxCaption = document.getElementById('lightbox-caption');
    var lightboxClose = document.getElementById('lightbox-close');

    function openLightbox(caption, gradient) {
      if (!lightbox) return;
      if (lightboxCaption) lightboxCaption.textContent = caption;
      // No real image files: mirror the placeholder gradient into the img area.
      if (lightboxImg) {
        lightboxImg.removeAttribute('src'); // clear any meme image shown before
        lightboxImg.style.background = gradient;
      }
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
    }

    function closeLightbox() {
      if (!lightbox) return;
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
    }

    grid.addEventListener('click', function (e) {
      var item = e.target.closest('.galeria-item');
      if (!item) return;
      openLightbox(item.getAttribute('data-caption'), item.style.background);
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightbox) {
      lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) closeLightbox(); // click on backdrop
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  })();

  /* ----------------------------------------------------------------------
     5. Timeline (#timeline) populated from CRONOLOGIA, alternating sides
     ---------------------------------------------------------------------- */
  (function initTimeline() {
    var timeline = document.getElementById('timeline');
    if (!timeline || typeof CRONOLOGIA === 'undefined') return;

    removeEmptyNotes(timeline);
    removeEmptyNotes(timeline.parentElement);

    CRONOLOGIA.forEach(function (evento, index) {
      var article = document.createElement('article');
      article.className = 'timeline-item reveal ' + (index % 2 === 0 ? 'left' : 'right');
      article.setAttribute('data-cat', evento.categoria);

      var card = document.createElement('div');
      card.className = 'timeline-card';

      var head = document.createElement('div');
      head.className = 'timeline-head';

      var fecha = document.createElement('span');
      fecha.className = 'timeline-date';
      fecha.textContent = evento.fecha;
      head.appendChild(fecha);

      if (evento.monto) {
        var monto = document.createElement('span');
        monto.className = 'timeline-monto';
        monto.textContent = evento.monto;
        head.appendChild(monto);
      }

      var titulo = document.createElement('h3');
      titulo.className = 'timeline-title';
      titulo.textContent = evento.titulo;

      var desc = document.createElement('p');
      desc.className = 'timeline-desc';
      desc.textContent = evento.descripcion;

      var cat = document.createElement('span');
      cat.className = 'timeline-cat';
      cat.textContent = evento.categoria;

      card.appendChild(head);
      card.appendChild(titulo);
      card.appendChild(desc);
      card.appendChild(cat);

      if (evento.fuente) {
        var fuente = document.createElement('p');
        fuente.className = 'timeline-fuente';
        fuente.textContent = 'Fuente: ' + evento.fuente;
        card.appendChild(fuente);
      }

      article.appendChild(card);
      timeline.appendChild(article);

      if (window.__ojObserve) window.__ojObserve(article);
    });
  })();

  /* ----------------------------------------------------------------------
     6a. Map helpers
     ---------------------------------------------------------------------- */
  function makeDivIcon(color) {
    return L.divIcon({
      className: 'oj-pin',
      html: '<span class="oj-pin-dot" style="background:' + color + '"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -9]
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function popupHtml(titulo, descripcion) {
    return '<strong>' + escapeHtml(titulo) + '</strong><br>' + escapeHtml(descripcion);
  }

  function showMapFallback(el) {
    if (!el) return;
    el.innerHTML = '<div class="map-fallback">El mapa requiere conexión a internet.</div>';
  }

  var JUAREZ_CENTER = [31.6904, -106.4245];

  /* ----------------------------------------------------------------------
     6b. Map 1 — servicios: now a live iframe of bachesjrz.com (no JS needed)
     ---------------------------------------------------------------------- */

  /* ----------------------------------------------------------------------
     6c. Map 2 — denuncias (#mapa-denuncias) + "hacer denuncia" mode
     ---------------------------------------------------------------------- */
  (function initDenunciasMap() {
    var el = document.getElementById('mapa-denuncias');
    if (!el) return;

    if (typeof L === 'undefined') {
      showMapFallback(el);
      return;
    }
    if (typeof PUNTOS_DENUNCIAS === 'undefined') return;

    var map = L.map(el, { scrollWheelZoom: false }).setView(JUAREZ_CENTER, 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    PUNTOS_DENUNCIAS.forEach(function (p) {
      var color = CAT_COLORS[p.cat] || '#9E2B25';
      L.marker([p.lat, p.lng], { icon: makeDivIcon(color) })
        .bindPopup(popupHtml(p.titulo, p.descripcion))
        .addTo(map);
    });

    setTimeout(function () { map.invalidateSize(); }, 200);

    /* ---- "Hacer denuncia": click on map -> form popup -> local marker ---- */
    var CATEGORIAS_DENUNCIA = [
      { value: 'gobierno',      label: 'Mal gobierno / falta de transparencia' },
      { value: 'corrupcion',    label: 'Corrupción' },
      { value: 'abusos',        label: 'Abuso policial' },
      { value: 'investigacion', label: 'Otro / caso a investigar' }
    ];
    var CONTACT_EMAIL = 'contacto@observatoriojuarez.mx';

    var btnDenunciar = document.getElementById('btn-denunciar');
    var hint = document.getElementById('denuncia-hint');
    var reportMode = false;

    function setReportMode(on) {
      reportMode = on;
      if (btnDenunciar) btnDenunciar.textContent = on ? 'Cancelar denuncia ×' : 'Hacer denuncia →';
      if (hint) hint.hidden = !on;
      el.classList.toggle('mapa--report', on);
      if (!on) map.closePopup();
    }

    if (btnDenunciar) {
      btnDenunciar.addEventListener('click', function () {
        setReportMode(!reportMode);
        if (reportMode) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    function openReportForm(latlng) {
      var form = document.createElement('form');
      form.className = 'denuncia-form';

      var catLabel = document.createElement('label');
      catLabel.textContent = 'Tipo de denuncia';
      var select = document.createElement('select');
      select.required = true;
      CATEGORIAS_DENUNCIA.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.value;
        opt.textContent = c.label;
        select.appendChild(opt);
      });
      catLabel.appendChild(select);

      var descLabel = document.createElement('label');
      descLabel.textContent = 'Descripción breve';
      var textarea = document.createElement('textarea');
      textarea.required = true;
      textarea.maxLength = 400;
      textarea.placeholder = 'Qué ocurrió, cuándo y dónde. Sin datos personales.';
      descLabel.appendChild(textarea);

      var submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'btn btn-red';
      submit.textContent = 'Agregar denuncia';

      form.appendChild(catLabel);
      form.appendChild(descLabel);
      form.appendChild(submit);

      var popup = L.popup({ maxWidth: 280, closeOnClick: false })
        .setLatLng(latlng)
        .setContent(form)
        .openOn(map);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var cat = select.value;
        var desc = textarea.value.trim();
        if (!desc) return;

        var catLabelText = (CATEGORIAS_DENUNCIA.find(function (c) { return c.value === cat; }) || {}).label || cat;
        var color = CAT_COLORS[cat] || '#9E2B25';

        // Confirmation popup with a prefilled email so the report reaches
        // the observatory (static site: no backend to persist reports).
        var coords = latlng.lat.toFixed(5) + ', ' + latlng.lng.toFixed(5);
        var mailto = 'mailto:' + CONTACT_EMAIL +
          '?subject=' + encodeURIComponent('Denuncia ciudadana — ' + catLabelText) +
          '&body=' + encodeURIComponent(
            'Tipo: ' + catLabelText + '\n' +
            'Ubicación (lat, lng): ' + coords + '\n\n' +
            'Descripción:\n' + desc + '\n'
          );

        var confirmation =
          '<div class="denuncia-ok"><strong>' + escapeHtml(catLabelText) + '</strong><br>' +
          escapeHtml(desc) + '<br><br>' +
          'Tu denuncia se marcó en el mapa (solo visible en tu navegador). ' +
          '<a href="' + mailto + '">Envíala al observatorio por correo</a> para que sea verificada y publicada.</div>';

        map.closePopup(popup);
        setReportMode(false);

        L.marker(latlng, { icon: makeDivIcon(color) })
          .bindPopup(confirmation)
          .addTo(map)
          .openPopup();
      });
    }

    map.on('click', function (e) {
      if (!reportMode) return;
      openReportForm(e.latlng);
    });
  })();

  /* ----------------------------------------------------------------------
     6d. Notas (blog): grid of 3 cards (#notas-grid) + reader modal
     ---------------------------------------------------------------------- */
  (function initNotas() {
    var grid = document.getElementById('notas-grid');
    if (!grid || typeof NOTAS === 'undefined') return;

    removeEmptyNotes(grid);

    var modal = document.getElementById('nota-modal');
    var article = document.getElementById('nota-article');
    var closeBtn = document.getElementById('nota-modal-close');

    /* ---- helpers ---- */

    function chipEl(nota) {
      var chip = document.createElement('span');
      chip.className = 'nota-chip nota-chip--' + (nota.color || 'red');
      chip.textContent = nota.categoria;
      return chip;
    }

    function readingMinutes(nota) {
      var words = nota.resumen.split(/\s+/).length;
      nota.cuerpo.forEach(function (b) { words += b.x.split(/\s+/).length; });
      return Math.max(1, Math.round(words / 200));
    }

    // Comments persist in this browser via localStorage, keyed per note.
    function commentsKey(nota) { return 'oj-comments-' + nota.id; }

    function loadComments(nota) {
      try {
        return JSON.parse(window.localStorage.getItem(commentsKey(nota))) || [];
      } catch (e) { return []; }
    }

    function saveComments(nota, list) {
      try {
        window.localStorage.setItem(commentsKey(nota), JSON.stringify(list));
      } catch (e) { /* storage unavailable: comment lives only until reload */ }
    }

    function metaItem(svgPath, text) {
      var span = document.createElement('span');
      span.className = 'nota-meta-item';
      span.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + svgPath + '</svg>';
      span.appendChild(document.createTextNode(text));
      return span;
    }

    var ICON_FECHA = '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>';
    var ICON_RELOJ = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>';
    var ICON_CHAT  = '<path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 21 12z"/>';

    /* ---- reader modal ---- */

    function openNota(nota) {
      if (!modal || !article) return;

      article.innerHTML = '';

      // Cover image with category chip.
      if (nota.imagen) {
        var cover = document.createElement('div');
        cover.className = 'nota-article-cover';
        var img = document.createElement('img');
        img.src = nota.imagen;
        img.alt = nota.imagenAlt || '';
        cover.appendChild(img);
        cover.appendChild(chipEl(nota));
        article.appendChild(cover);
      } else {
        article.appendChild(chipEl(nota));
      }

      var h = document.createElement('h2');
      h.className = 'nota-article-title';
      h.textContent = nota.titulo;
      article.appendChild(h);

      var fecha = document.createElement('span');
      fecha.className = 'nota-article-fecha';
      fecha.textContent = nota.fecha + ' — ' + (nota.autor || 'Observatorio Juárez') +
        ' — Lectura de ' + readingMinutes(nota) + ' min';
      article.appendChild(fecha);

      nota.cuerpo.forEach(function (block) {
        var el = document.createElement(block.t === 'h' ? 'h3' : 'p');
        el.textContent = block.x;
        article.appendChild(el);
      });

      article.appendChild(buildComments(nota));

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden'; // lock page scroll behind
      article.scrollTop = 0;
    }

    function closeNota() {
      if (!modal) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    /* ---- comments ---- */

    function commentEl(c) {
      var li = document.createElement('li');
      li.className = 'nota-comment';

      var head = document.createElement('div');
      head.className = 'nota-comment-head';

      var avatar = document.createElement('span');
      avatar.className = 'nota-comment-avatar';
      avatar.textContent = (c.nombre || '?').trim().charAt(0);

      var nombre = document.createElement('span');
      nombre.className = 'nota-comment-nombre';
      nombre.textContent = c.nombre;

      var fecha = document.createElement('span');
      fecha.className = 'nota-comment-fecha';
      fecha.textContent = c.fecha;

      head.appendChild(avatar);
      head.appendChild(nombre);
      head.appendChild(fecha);

      var texto = document.createElement('p');
      texto.className = 'nota-comment-texto';
      texto.textContent = c.texto;

      li.appendChild(head);
      li.appendChild(texto);
      return li;
    }

    function buildComments(nota) {
      var wrap = document.createElement('div');
      wrap.className = 'nota-comments';

      var comments = loadComments(nota);

      var title = document.createElement('h3');
      title.className = 'nota-comments-title';
      title.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_CHAT + '</svg>';
      title.appendChild(document.createTextNode('Comentarios (' + comments.length + ')'));
      wrap.appendChild(title);

      var list = document.createElement('ul');
      list.className = 'nota-comments-list';
      var empty = document.createElement('p');
      empty.className = 'nota-comments-empty';
      empty.textContent = 'Aún no hay comentarios. Sé la primera persona en opinar.';

      if (comments.length) {
        comments.forEach(function (c) { list.appendChild(commentEl(c)); });
        wrap.appendChild(list);
      } else {
        wrap.appendChild(empty);
        wrap.appendChild(list);
      }

      var form = document.createElement('form');
      form.className = 'nota-comment-form';

      var inputNombre = document.createElement('input');
      inputNombre.type = 'text';
      inputNombre.placeholder = 'Tu nombre';
      inputNombre.required = true;
      inputNombre.maxLength = 60;

      var textarea = document.createElement('textarea');
      textarea.placeholder = 'Escribe tu comentario…';
      textarea.required = true;
      textarea.maxLength = 600;

      var submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'btn btn-red';
      submit.textContent = 'Publicar comentario';

      form.appendChild(inputNombre);
      form.appendChild(textarea);
      form.appendChild(submit);

      var note = document.createElement('p');
      note.className = 'nota-comments-note';
      note.textContent = 'Los comentarios se guardan en este dispositivo. Escribe con respeto; los ataques personales podrán ser retirados.';

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var nombre = inputNombre.value.trim();
        var texto = textarea.value.trim();
        if (!nombre || !texto) return;

        var c = {
          nombre: nombre,
          texto: texto,
          fecha: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
        };
        comments.push(c);
        saveComments(nota, comments);

        empty.remove();
        list.appendChild(commentEl(c));
        title.lastChild.textContent = 'Comentarios (' + comments.length + ')';
        updateCardCommentCount(nota);
        form.reset();
      });

      wrap.appendChild(form);
      wrap.appendChild(note);
      return wrap;
    }

    var commentCounters = {}; // nota.id -> card meta span (kept in sync)

    function updateCardCommentCount(nota) {
      var el = commentCounters[nota.id];
      if (el) {
        var n = loadComments(nota).length;
        el.lastChild.textContent = n === 1 ? '1 comentario' : n + ' comentarios';
      }
    }

    /* ---- cards grid (first note = featured) ---- */

    NOTAS.forEach(function (nota, index) {
      var card = document.createElement('article');
      card.className = 'nota-card reveal' + (index === 0 ? ' nota-card--featured' : '');

      // Cover
      var cover = document.createElement('div');
      cover.className = 'nota-cover';
      var img = document.createElement('img');
      img.src = nota.imagen;
      img.alt = nota.imagenAlt || '';
      img.loading = 'lazy';
      cover.appendChild(img);
      cover.appendChild(chipEl(nota));
      card.appendChild(cover);

      // Body
      var body = document.createElement('div');
      body.className = 'nota-body';

      var meta = document.createElement('div');
      meta.className = 'nota-meta-row';
      meta.appendChild(metaItem(ICON_FECHA, nota.fecha));
      meta.appendChild(metaItem(ICON_RELOJ, readingMinutes(nota) + ' min de lectura'));
      var nComments = loadComments(nota).length;
      var chat = metaItem(ICON_CHAT, nComments === 1 ? '1 comentario' : nComments + ' comentarios');
      commentCounters[nota.id] = chat;
      meta.appendChild(chat);
      body.appendChild(meta);

      var titulo = document.createElement('h3');
      titulo.className = 'nota-card-title';
      titulo.textContent = nota.titulo;
      body.appendChild(titulo);

      var resumen = document.createElement('p');
      resumen.className = 'nota-card-resumen';
      resumen.textContent = nota.resumen;
      body.appendChild(resumen);

      var foot = document.createElement('div');
      foot.className = 'nota-card-foot';

      var autor = document.createElement('span');
      autor.className = 'nota-autor';
      autor.textContent = nota.autor || 'Observatorio Juárez';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-red nota-btn';
      btn.textContent = 'Leer nota completa →';
      btn.addEventListener('click', function () { openNota(nota); });

      foot.appendChild(autor);
      foot.appendChild(btn);
      body.appendChild(foot);
      card.appendChild(body);

      grid.appendChild(card);
      if (window.__ojObserve) window.__ojObserve(card);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeNota);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeNota(); // backdrop
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNota();
    });
  })();

  /* ----------------------------------------------------------------------
     7. Memes carousel (#memes-track) + prev/next scroll
     ---------------------------------------------------------------------- */
  (function initMemes() {
    var track = document.getElementById('memes-track');
    if (!track || typeof MEMES === 'undefined') return;

    removeEmptyNotes(track);

    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightbox-img');
    var lightboxCaption = document.getElementById('lightbox-caption');

    MEMES.forEach(function (meme) {
      var card = document.createElement('figure');
      card.className = 'meme-card meme-card--img';
      card.setAttribute('data-src', meme.src);
      card.setAttribute('data-alt', meme.alt || 'Meme');

      var img = document.createElement('img');
      img.className = 'meme-img';
      img.src = meme.src;
      img.alt = meme.alt || 'Meme';
      img.loading = 'lazy';

      card.appendChild(img);
      track.appendChild(card);
    });

    // Click (delegated so cloned marquee cards work too) -> gallery lightbox.
    track.addEventListener('click', function (e) {
      var card = e.target.closest('.meme-card');
      if (!card || !lightbox || !lightboxImg) return;
      lightboxImg.src = card.getAttribute('data-src');
      lightboxImg.alt = card.getAttribute('data-alt');
      lightboxImg.style.background = 'none';
      if (lightboxCaption) lightboxCaption.textContent = card.getAttribute('data-alt');
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
    });

    var prev = document.getElementById('memes-prev');
    var next = document.getElementById('memes-next');

    function cardWidth() {
      var first = track.querySelector('.meme-card');
      if (!first) return track.clientWidth;
      var style = window.getComputedStyle(track);
      var gap = parseFloat(style.columnGap || style.gap || '0') || 0;
      return first.getBoundingClientRect().width + gap;
    }

    if (prev) prev.addEventListener('click', function () {
      track.scrollBy({ left: -cardWidth(), behavior: 'smooth' });
    });
    if (next) next.addEventListener('click', function () {
      track.scrollBy({ left: cardWidth(), behavior: 'smooth' });
    });

    // Continuous marquee carousel: the set of memes is cloned until it
    // overflows, then scrolls forever in a seamless loop. Pauses on
    // hover/focus/touch. Skipped if the user prefers reduced motion.
    if (!prefersReducedMotion && track.children.length > 0) {
      var viewport = track.closest('.memes-viewport') || track;
      var originalCards = Array.prototype.slice.call(track.children);

      // Snap fights tiny programmatic scroll increments; disable it here.
      track.style.scrollSnapType = 'none';

      function cloneSet() {
        originalCards.forEach(function (card) {
          track.appendChild(card.cloneNode(true));
        });
      }

      var baseWidth = track.scrollWidth;
      cloneSet();
      var setWidth = track.scrollWidth - baseWidth; // one full set incl. gap

      if (setWidth > 0) {
        // Enough copies that the loop point is never visible.
        while (track.scrollWidth < track.clientWidth + setWidth * 2) {
          cloneSet();
        }

        var SPEED = 0.035; // px per ms (~35 px/s)
        var paused = false;
        var pos = 0;
        var lastTime = null;
        var touchResumeTimer = null;

        function pauseMarquee() { paused = true; }
        function resumeMarquee() {
          pos = track.scrollLeft; // re-sync after manual scroll/arrows
          paused = false;
        }

        viewport.addEventListener('mouseenter', pauseMarquee);
        viewport.addEventListener('mouseleave', resumeMarquee);
        viewport.addEventListener('focusin', pauseMarquee);
        viewport.addEventListener('focusout', resumeMarquee);
        viewport.addEventListener('touchstart', function () {
          pauseMarquee();
          if (touchResumeTimer) window.clearTimeout(touchResumeTimer);
          touchResumeTimer = window.setTimeout(resumeMarquee, 4000);
        }, { passive: true });

        function tick(time) {
          if (lastTime === null) lastTime = time;
          var dt = Math.min(time - lastTime, 80); // clamp tab-switch jumps
          lastTime = time;

          if (!paused) {
            pos += SPEED * dt;
            if (pos >= setWidth) pos -= setWidth;
            track.scrollLeft = pos;
          }
          window.requestAnimationFrame(tick);
        }
        window.requestAnimationFrame(tick);
      }
    }
  })();

  /* ----------------------------------------------------------------------
     8. Subscribe form (#subscribe-form) -> validate + confirmation msg
     ---------------------------------------------------------------------- */
  (function initSubscribe() {
    var form = document.getElementById('subscribe-form');
    var msg = document.getElementById('subscribe-msg');
    if (!form) return;

    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"], input[name="email"]');
      var value = input ? input.value.trim() : '';

      if (!emailRe.test(value)) {
        if (msg) {
          msg.textContent = 'Ingresa un correo electrónico válido.';
          msg.className = 'subscribe-msg error';
        }
        return;
      }

      if (msg) {
        msg.textContent = '¡Gracias por suscribirte! Te avisaremos de nuevas actualizaciones.';
        msg.className = 'subscribe-msg ok';
      }
      form.reset();
    });
  })();

  /* ----------------------------------------------------------------------
     9. Video placeholder (#video-placeholder) + modal (#video-modal)
     ---------------------------------------------------------------------- */
  (function initVideo() {
    var placeholder = document.getElementById('video-placeholder');
    if (!placeholder) return;

    var modal = document.getElementById('video-modal');

    function closeVideoModal() {
      if (!modal) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      var iframe = modal.querySelector('iframe');
      if (iframe) iframe.remove(); // stop playback
    }

    placeholder.addEventListener('click', function () {
      var videoId = (placeholder.getAttribute('data-video-id') || '').trim();

      // No video yet: show inline "coming soon" notice.
      if (!videoId) {
        placeholder.innerHTML =
          '<div class="video-soon">Video próximamente</div>';
        return;
      }

      // Has an id: open modal with a YouTube embed.
      if (!modal) return;
      var iframe = document.createElement('iframe');
      iframe.setAttribute('src',
        'https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '?autoplay=1&rel=0');
      iframe.setAttribute('title', 'Video introductorio — Observatorio Juárez');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');

      var body = modal.querySelector('.video-modal-body') || modal;
      body.appendChild(iframe);
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    });

    if (modal) {
      var closeBtn = modal.querySelector('#video-modal-close, .video-modal-close');
      if (closeBtn) closeBtn.addEventListener('click', closeVideoModal);
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeVideoModal(); // backdrop
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeVideoModal();
      });
    }
  })();

});
