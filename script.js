(function () {
  const baseUrl = '';

  /* Header scroll + mobile nav */
  const header = document.querySelector('.site-header');
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');

  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      const open = mainNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Section reveal */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.section').forEach(function (sec) {
      io.observe(sec);
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMatchDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return escapeHtml(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  /* Site settings */
  fetch(baseUrl + '/api/site-public')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      const tag = document.getElementById('heroTagline');
      if (tag && data.hero_tagline) tag.textContent = data.hero_tagline;
      const aboutTitle = document.getElementById('aboutTitle');
      if (aboutTitle && data.about_title) aboutTitle.textContent = data.about_title;
      const aboutText = document.getElementById('aboutText');
      if (aboutText && data.about_text) aboutText.textContent = data.about_text;
      const rosterIntro = document.getElementById('rosterIntro');
      if (rosterIntro && data.roster_intro) rosterIntro.textContent = data.roster_intro;

      const meta = document.getElementById('contactMeta');
      if (meta) {
        const items = [];
        if (data.address) items.push('<li>' + escapeHtml(data.address) + '</li>');
        if (data.email) items.push('<li><a href="mailto:' + escapeHtml(data.email) + '">' + escapeHtml(data.email) + '</a></li>');
        if (data.phone_display) {
          const href = data.phone_href || ('tel:' + String(data.phone_display).replace(/\s+/g, ''));
          items.push('<li><a href="' + escapeHtml(href) + '">' + escapeHtml(data.phone_display) + '</a></li>');
        }
        if (data.instagram) {
          items.push('<li><a href="' + escapeHtml(data.instagram) + '" target="_blank" rel="noopener">Instagram</a></li>');
        }
        if (data.facebook) {
          items.push('<li><a href="' + escapeHtml(data.facebook) + '" target="_blank" rel="noopener">Facebook</a></li>');
        }
        meta.innerHTML = items.join('');
      }
    })
    .catch(function () {});

  /* Roster */
  fetch(baseUrl + '/api/players-public')
    .then(function (r) { return r.json(); })
    .then(function (players) {
      const grid = document.getElementById('rosterGrid');
      const empty = document.getElementById('rosterEmpty');
      if (!grid) return;
      if (!players || !players.length) {
        if (empty) empty.style.display = 'block';
        return;
      }
      if (empty) empty.remove();
      grid.innerHTML = players.map(function (p) {
        const num = p.number != null ? '#' + p.number : '';
        const photo = p.image
          ? '<img class="player-photo" src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" />'
          : '<div class="player-photo placeholder" aria-hidden="true">' + (p.number != null ? escapeHtml(String(p.number)) : '?') + '</div>';
        return (
          '<article class="player-card">' +
            photo +
            '<div class="player-meta">' +
              (num ? '<div class="player-number">' + escapeHtml(num) + '</div>' : '') +
              '<p class="player-name">' + escapeHtml(p.name) + '</p>' +
              (p.position ? '<p class="player-pos">' + escapeHtml(p.position) + '</p>' : '') +
            '</div>' +
          '</article>'
        );
      }).join('');
    })
    .catch(function () {});

  /* Matches */
  fetch(baseUrl + '/api/matches-public')
    .then(function (r) { return r.json(); })
    .then(function (matches) {
      const list = document.getElementById('matchList');
      const empty = document.getElementById('matchEmpty');
      if (!list) return;
      if (!matches || !matches.length) {
        if (empty) empty.style.display = 'list-item';
        return;
      }
      if (empty) empty.remove();
      list.innerHTML = matches.map(function (m) {
        const where = m.home_away === 'away' ? 'Extérieur' : 'Domicile';
        const loc = m.location ? ' · ' + m.location : '';
        const result = m.result
          ? '<span class="match-result">' + escapeHtml(m.result) + '</span>'
          : '<span class="match-result pending">À venir</span>';
        return (
          '<li class="match-item">' +
            '<div class="match-date">' + formatMatchDate(m.match_date) + '</div>' +
            '<div class="match-info">' +
              '<h3>vs ' + escapeHtml(m.opponent) + '</h3>' +
              '<p>' + escapeHtml(where + loc) + '</p>' +
            '</div>' +
            result +
          '</li>'
        );
      }).join('');
    })
    .catch(function () {});

  /* Gallery */
  (function initGallery() {
    const img = document.getElementById('galleryImage');
    const empty = document.getElementById('galleryEmpty');
    const prev = document.getElementById('galleryPrev');
    const next = document.getElementById('galleryNext');
    const counter = document.getElementById('galleryCounter');
    let images = [];
    let index = 0;

    function render() {
      if (!images.length) {
        if (img) img.hidden = true;
        if (empty) empty.style.display = 'block';
        if (counter) counter.textContent = '';
        if (prev) prev.disabled = true;
        if (next) next.disabled = true;
        return;
      }
      if (empty) empty.style.display = 'none';
      if (img) {
        img.hidden = false;
        img.src = images[index].src;
        img.alt = images[index].alt || "Photo SUP'BASKET";
      }
      if (counter) counter.textContent = 'Photo ' + (index + 1) + ' / ' + images.length;
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === images.length - 1;
    }

    fetch(baseUrl + '/api/gallery-images')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        images = Array.isArray(data) ? data : [];
        index = 0;
        render();
      })
      .catch(function () { render(); });

    if (prev) prev.addEventListener('click', function () {
      if (index > 0) { index -= 1; render(); }
    });
    if (next) next.addEventListener('click', function () {
      if (index < images.length - 1) { index += 1; render(); }
    });
  })();

  /* Contact form */
  const form = document.getElementById('contactForm');
  const status = document.getElementById('contactStatus');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (status) {
        status.textContent = 'Envoi…';
        status.className = 'form-status';
      }
      const payload = {
        name: document.getElementById('cName').value.trim(),
        email: document.getElementById('cEmail').value.trim(),
        phone: document.getElementById('cPhone').value.trim(),
        subject: document.getElementById('cSubject').value.trim(),
        message: document.getElementById('cMessage').value.trim()
      };
      fetch(baseUrl + '/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j.success) {
            form.reset();
            document.getElementById('cSubject').value = 'Candidature / Contact';
            if (status) {
              status.textContent = 'Message envoyé. Merci !';
              status.className = 'form-status ok';
            }
          } else {
            throw new Error((res.j && res.j.error) || 'Erreur');
          }
        })
        .catch(function (err) {
          if (status) {
            status.textContent = err.message || 'Impossible d\'envoyer.';
            status.className = 'form-status err';
          }
        });
    });
  }
})();
