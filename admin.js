(function () {
  const loginScreen = document.getElementById('loginScreen');
  const adminContent = document.getElementById('adminContent');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(el, msg, ok) {
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'form-status' + (msg ? (ok ? ' ok' : ' err') : '');
  }

  async function api(url, options) {
    const res = await fetch(url, Object.assign({ credentials: 'include' }, options || {}));
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401) {
      data.error = data.error || 'Connexion requise. Reconnectez-vous.';
    }
    return { ok: res.ok, status: res.status, data: data };
  }

  async function checkSession() {
    const res = await api('/api/admin/session');
    if (res.ok) showAdmin();
    else showLogin();
  }

  function showLogin() {
    loginScreen.hidden = false;
    loginScreen.style.display = '';
    adminContent.hidden = true;
  }

  function showAdmin() {
    loginScreen.hidden = true;
    loginScreen.style.display = 'none';
    adminContent.hidden = false;
    loadMessages();
    loadPlayers();
    loadMatches();
    loadGallery();
    loadSettings();
  }

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    loginError.hidden = true;
    const password = document.getElementById('adminPassword').value;
    try {
      const res = await api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password })
      });
      if (res.ok && res.data.success) {
        document.getElementById('adminPassword').value = '';
        showAdmin();
      } else {
        loginError.textContent = (res.data && res.data.error) || 'Mot de passe incorrect.';
        loginError.hidden = false;
      }
    } catch (err) {
      loginError.textContent = 'Serveur inaccessible. Lance npm start et ouvre http://localhost:3000/admin';
      loginError.hidden = false;
    }
  });

  document.getElementById('btnLogout').addEventListener('click', async function () {
    await api('/api/admin/logout', { method: 'POST' });
    showLogin();
  });

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.admin-tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  /* Messages */
  async function loadMessages() {
    const list = document.getElementById('messagesList');
    const res = await api('/api/messages');
    if (!res.ok) {
      list.textContent = 'Impossible de charger les messages.';
      return;
    }
    const rows = res.data || [];
    if (!rows.length) {
      list.textContent = 'Aucun message.';
      return;
    }
    list.innerHTML = rows.map(function (m) {
      return (
        '<article class="admin-item">' +
          '<div>' +
            '<strong>' + escapeHtml(m.name) + '</strong>' +
            '<p class="meta">' + escapeHtml(m.subject || '') +
              (m.email ? ' · ' + escapeHtml(m.email) : '') +
              (m.phone ? ' · ' + escapeHtml(m.phone) : '') +
              (m.date ? ' · ' + escapeHtml(m.date) : '') +
            '</p>' +
            '<pre>' + escapeHtml(m.message) + '</pre>' +
          '</div>' +
          '<button type="button" class="btn-danger" data-del-msg="' + m.id + '">Supprimer</button>' +
        '</article>'
      );
    }).join('');
    list.querySelectorAll('[data-del-msg]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Supprimer ce message ?')) return;
        await api('/api/messages/' + btn.dataset.delMsg, { method: 'DELETE' });
        loadMessages();
      });
    });
  }

  /* Players */
  async function loadPlayers() {
    const list = document.getElementById('playersList');
    const res = await api('/api/players');
    if (!res.ok) {
      list.textContent = 'Impossible de charger l\'effectif.';
      return;
    }
    const rows = res.data || [];
    if (!rows.length) {
      list.textContent = 'Aucun joueur.';
      return;
    }
    list.innerHTML = rows.map(function (p) {
      const num = p.number != null ? '#' + p.number + ' · ' : '';
      return (
        '<article class="admin-item">' +
          '<div>' +
            '<strong>' + escapeHtml(num + p.name) + '</strong>' +
            '<p class="meta">' + escapeHtml(p.position || '') +
              (p.bio ? ' — ' + escapeHtml(p.bio) : '') +
            '</p>' +
          '</div>' +
          '<button type="button" class="btn-danger" data-del-player="' + p.id + '">Supprimer</button>' +
        '</article>'
      );
    }).join('');
    list.querySelectorAll('[data-del-player]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Supprimer ce joueur ?')) return;
        await api('/api/players/' + btn.dataset.delPlayer, { method: 'DELETE' });
        loadPlayers();
      });
    });
  }

  document.getElementById('formPlayer').addEventListener('submit', async function (e) {
    e.preventDefault();
    const status = document.getElementById('statusPlayer');
    const fd = new FormData();
    fd.append('name', document.getElementById('pName').value.trim());
    fd.append('number', document.getElementById('pNumber').value);
    fd.append('position', document.getElementById('pPosition').value.trim());
    fd.append('bio', document.getElementById('pBio').value.trim());
    const photo = document.getElementById('pPhoto').files[0];
    if (photo) fd.append('photo', photo);

    setStatus(status, 'Enregistrement…', true);
    const res = await api('/api/players', { method: 'POST', body: fd });
    if (res.ok && res.data.success) {
      e.target.reset();
      setStatus(status, 'Joueur ajouté.', true);
      loadPlayers();
    } else {
      setStatus(status, (res.data && res.data.error) || 'Erreur', false);
    }
  });

  /* Matches */
  async function loadMatches() {
    const list = document.getElementById('matchesList');
    const res = await api('/api/matches');
    if (!res.ok) {
      list.textContent = 'Impossible de charger les matchs.';
      return;
    }
    const rows = res.data || [];
    if (!rows.length) {
      list.textContent = 'Aucun match.';
      return;
    }
    list.innerHTML = rows.map(function (m) {
      return (
        '<article class="admin-item">' +
          '<div>' +
            '<strong>vs ' + escapeHtml(m.opponent) + '</strong>' +
            '<p class="meta">' +
              escapeHtml(m.match_date || '') +
              ' · ' + (m.home_away === 'away' ? 'Extérieur' : 'Domicile') +
              (m.location ? ' · ' + escapeHtml(m.location) : '') +
              (m.result ? ' · ' + escapeHtml(m.result) : '') +
            '</p>' +
          '</div>' +
          '<button type="button" class="btn-danger" data-del-match="' + m.id + '">Supprimer</button>' +
        '</article>'
      );
    }).join('');
    list.querySelectorAll('[data-del-match]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Supprimer ce match ?')) return;
        await api('/api/matches/' + btn.dataset.delMatch, { method: 'DELETE' });
        loadMatches();
      });
    });
  }

  document.getElementById('formMatch').addEventListener('submit', async function (e) {
    e.preventDefault();
    const status = document.getElementById('statusMatch');
    const payload = {
      opponent: document.getElementById('mOpponent').value.trim(),
      match_date: document.getElementById('mDate').value,
      location: document.getElementById('mLocation').value.trim(),
      home_away: document.getElementById('mHomeAway').value,
      result: document.getElementById('mResult').value.trim(),
      notes: document.getElementById('mNotes').value.trim()
    };
    setStatus(status, 'Enregistrement…', true);
    const res = await api('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok && res.data.success) {
      e.target.reset();
      setStatus(status, 'Match ajouté.', true);
      loadMatches();
    } else {
      setStatus(status, (res.data && res.data.error) || 'Erreur', false);
    }
  });

  /* Gallery */
  async function loadGallery() {
    const list = document.getElementById('galleryAdminList');
    const res = await api('/api/gallery-images');
    const images = res.data || [];
    if (!images.length) {
      list.innerHTML = '<p class="meta">Aucune photo.</p>';
      return;
    }
    list.innerHTML = images.map(function (img) {
      return (
        '<div class="gallery-item-admin">' +
          '<img src="' + escapeHtml(img.src) + '" alt="" />' +
          '<button type="button" class="btn-danger" data-del-gal="' + escapeHtml(img.src) + '">Supprimer</button>' +
        '</div>'
      );
    }).join('');
    list.querySelectorAll('[data-del-gal]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Supprimer cette photo ?')) return;
        await api('/api/gallery-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src: btn.dataset.delGal })
        });
        loadGallery();
      });
    });
  }

  document.getElementById('btnUploadGallery').addEventListener('click', async function () {
    const input = document.getElementById('galleryPhotosInput');
    const status = document.getElementById('statusGallery');
    if (!input.files || !input.files.length) {
      setStatus(status, 'Choisissez des fichiers.', false);
      return;
    }
    const fd = new FormData();
    Array.from(input.files).forEach(function (f) { fd.append('photos', f); });
    setStatus(status, 'Upload…', true);
    const res = await api('/api/gallery-upload', { method: 'POST', body: fd });
    if (res.ok && res.data.success) {
      input.value = '';
      setStatus(status, res.data.message || 'OK', true);
      loadGallery();
    } else {
      setStatus(status, (res.data && res.data.error) || 'Erreur', false);
    }
  });

  /* Settings */
  async function loadSettings() {
    const res = await api('/api/site-settings');
    if (!res.ok) return;
    const s = res.data || {};
    document.getElementById('setHero').value = s.hero_tagline || '';
    document.getElementById('setAboutTitle').value = s.about_title || '';
    document.getElementById('setAboutText').value = s.about_text || '';
    document.getElementById('setRosterIntro').value = s.roster_intro || '';
    document.getElementById('setEmail').value = s.email || '';
    document.getElementById('setPhone').value = s.phone_display || '';
    document.getElementById('setPhoneHref').value = s.phone_href || '';
    document.getElementById('setAddress').value = s.address || '';
    document.getElementById('setInstagram').value = s.instagram || '';
    document.getElementById('setFacebook').value = s.facebook || '';
  }

  document.getElementById('formSettings').addEventListener('submit', async function (e) {
    e.preventDefault();
    const status = document.getElementById('statusSettings');
    const payload = {
      hero_tagline: document.getElementById('setHero').value.trim(),
      about_title: document.getElementById('setAboutTitle').value.trim(),
      about_text: document.getElementById('setAboutText').value.trim(),
      roster_intro: document.getElementById('setRosterIntro').value.trim(),
      email: document.getElementById('setEmail').value.trim(),
      phone_display: document.getElementById('setPhone').value.trim(),
      phone_href: document.getElementById('setPhoneHref').value.trim(),
      address: document.getElementById('setAddress').value.trim(),
      instagram: document.getElementById('setInstagram').value.trim(),
      facebook: document.getElementById('setFacebook').value.trim()
    };
    setStatus(status, 'Enregistrement…', true);
    const res = await api('/api/site-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setStatus(status, res.ok ? 'Paramètres enregistrés.' : ((res.data && res.data.error) || 'Erreur'), res.ok);
  });

  document.getElementById('formPassword').addEventListener('submit', async function (e) {
    e.preventDefault();
    const status = document.getElementById('statusPassword');
    const res = await api('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current: document.getElementById('pwCurrent').value,
        new: document.getElementById('pwNew').value
      })
    });
    if (res.ok && res.data.success) {
      e.target.reset();
      setStatus(status, 'Mot de passe mis à jour. Reconnectez-vous.', true);
      setTimeout(showLogin, 1200);
    } else {
      setStatus(status, (res.data && res.data.error) || 'Erreur', false);
    }
  });

  checkSession();
})();
