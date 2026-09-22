require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_COOKIE_NAME = 'admin_session';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'supbasket2026';

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname));

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Impossible d\'ouvrir la base :', err.message);
        process.exit(1);
    }
});
db.configure('busyTimeout', 8000);
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA synchronous = NORMAL');
db.run('PRAGMA foreign_keys = ON');

const SESSION_COOKIE_OPTS = {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
    sameSite: 'lax',
    path: '/'
};

const defaultSettings = {
    phone_display: '',
    phone_href: '',
    email: 'supbasket@supcom.tn',
    address: 'SUP\'COM, El Ghazala, Ariana, Tunisie',
    instagram: '',
    facebook: '',
    about_title: 'Le club SUP\'BASKET',
    about_text: 'SUP\'BASKET est le club de basketball de SUP\'COM. Compétition, esprit d\'équipe et passion du jeu au cœur de l\'école.',
    roster_intro: 'L\'effectif actuel du club.',
    hero_tagline: 'Club de basketball de SUP\'COM'
};

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admin_config (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        expires_at INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        number INTEGER,
        position TEXT,
        image TEXT,
        bio TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opponent TEXT NOT NULL,
        match_date TEXT,
        location TEXT,
        home_away TEXT DEFAULT 'home',
        result TEXT,
        notes TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        phone TEXT,
        subject TEXT,
        message TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.get(`SELECT value FROM admin_config WHERE key = 'admin_password'`, (err, row) => {
        if (!row) {
            const hash = crypto.createHash('sha256').update(DEFAULT_ADMIN_PASSWORD).digest('hex');
            db.run(`INSERT INTO admin_config (key, value) VALUES ('admin_password', ?)`, [hash]);
            console.log('Admin password set to:', DEFAULT_ADMIN_PASSWORD);
        }
    });

    db.get(`SELECT value FROM admin_config WHERE key = 'site_settings'`, (err, row) => {
        if (!row) {
            db.run(`INSERT INTO admin_config (key, value) VALUES ('site_settings', ?)`, [JSON.stringify(defaultSettings)]);
            console.log('Default site settings created');
        }
    });
});

function verifyPassword(plain, hash) {
    return crypto.createHash('sha256').update(plain).digest('hex') === hash;
}

function requireAdmin(req, res, next) {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (!token) {
        return res.status(401).json({ error: 'Connexion requise' });
    }
    db.get(
        `SELECT * FROM admin_sessions WHERE token = ? AND expires_at > ?`,
        [token, Date.now()],
        (err, row) => {
            if (err || !row) {
                return res.status(401).json({ error: 'Session invalide' });
            }
            next();
        }
    );
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(path.join(__dirname, 'assets/images/gallery'));
ensureDir(path.join(__dirname, 'assets/images/players'));

function makeImageUpload(subdir) {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, 'assets/images', subdir);
            ensureDir(dir);
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, unique + path.extname(file.originalname).toLowerCase());
        }
    });
    return multer({
        storage,
        limits: { fileSize: 12 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
            cb(ok ? null : new Error('Type de fichier non supporté'), ok);
        }
    });
}

const galleryUpload = makeImageUpload('gallery');
const playerUpload = makeImageUpload('players');

// ---- Auth ----
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (!password) {
        return res.status(400).json({ success: false, error: 'Mot de passe requis' });
    }
    db.get(`SELECT value FROM admin_config WHERE key = 'admin_password'`, (err, row) => {
        if (err || !row) {
            return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
        if (!verifyPassword(password, row.value)) {
            return res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
        }
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
        db.run(`INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)`, [token, expiresAt], (e) => {
            if (e) return res.status(500).json({ success: false, error: 'Erreur de session' });
            res.cookie(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTS);
            res.json({ success: true });
        });
    });
});

app.get('/api/admin/session', requireAdmin, (req, res) => {
    res.json({ ok: true });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (token) db.run(`DELETE FROM admin_sessions WHERE token = ?`, [token]);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true });
});

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    const { current, new: newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 8) {
        return res.status(400).json({ success: false, error: 'Nouveau mot de passe trop court (8 min.)' });
    }
    db.get(`SELECT value FROM admin_config WHERE key = 'admin_password'`, (err, row) => {
        if (err || !row) return res.status(500).json({ success: false, error: 'Erreur serveur' });
        if (!verifyPassword(current, row.value)) {
            return res.status(401).json({ success: false, error: 'Mot de passe actuel incorrect' });
        }
        const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
        db.run(`UPDATE admin_config SET value = ? WHERE key = 'admin_password'`, [newHash], (e) => {
            if (e) return res.status(500).json({ success: false, error: e.message });
            db.run(`DELETE FROM admin_sessions`, () => res.json({ success: true }));
        });
    });
});

// ---- Site settings ----
app.get('/api/site-public', (req, res) => {
    db.get(`SELECT value FROM admin_config WHERE key = 'site_settings'`, (err, row) => {
        if (err || !row) return res.json(defaultSettings);
        try {
            res.json(Object.assign({}, defaultSettings, JSON.parse(row.value)));
        } catch (e) {
            res.json(defaultSettings);
        }
    });
});

app.get('/api/site-settings', requireAdmin, (req, res) => {
    db.get(`SELECT value FROM admin_config WHERE key = 'site_settings'`, (err, row) => {
        if (err || !row) return res.json(defaultSettings);
        try {
            res.json(Object.assign({}, defaultSettings, JSON.parse(row.value)));
        } catch (e) {
            res.json(defaultSettings);
        }
    });
});

app.post('/api/site-settings', requireAdmin, (req, res) => {
    const settingsJson = JSON.stringify(req.body || {});
    db.run(
        `INSERT INTO admin_config (key, value) VALUES ('site_settings', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [settingsJson],
        (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        }
    );
});

// ---- Players ----
app.get('/api/players-public', (req, res) => {
    db.all(`SELECT * FROM players ORDER BY number ASC, name ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/players', requireAdmin, (req, res) => {
    db.all(`SELECT * FROM players ORDER BY number ASC, name ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/players', requireAdmin, playerUpload.single('photo'), (req, res) => {
    const body = req.body || {};
    const name = (body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'Nom requis' });

    const parsedNumber = parseInt(body.number, 10);
    const number = Number.isInteger(parsedNumber) ? parsedNumber : null;
    const position = body.position || '';
    const bio = body.bio || '';
    let image = body.image || '';
    if (req.file) image = '/assets/images/players/' + req.file.filename;

    db.run(
        `INSERT INTO players (name, number, position, image, bio) VALUES (?, ?, ?, ?, ?)`,
        [name, number, position, image, bio],
        function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.delete('/api/players/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.get(`SELECT image FROM players WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        db.run(`DELETE FROM players WHERE id = ?`, [id], function (e) {
            if (e) return res.status(500).json({ success: false, error: e.message });
            if (row && row.image && row.image.includes('/assets/images/players/')) {
                const fp = path.join(__dirname, row.image.replace(/^\//, ''));
                if (fp.startsWith(path.join(__dirname, 'assets/images/players'))) {
                    fs.unlink(fp, () => {});
                }
            }
            res.json({ success: true });
        });
    });
});

// ---- Matches ----
app.get('/api/matches-public', (req, res) => {
    db.all(`SELECT * FROM matches ORDER BY match_date DESC, id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/matches', requireAdmin, (req, res) => {
    db.all(`SELECT * FROM matches ORDER BY match_date DESC, id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/matches', requireAdmin, (req, res) => {
    const { opponent, match_date, location, home_away, result, notes } = req.body || {};
    if (!opponent || !String(opponent).trim()) {
        return res.status(400).json({ success: false, error: 'Adversaire requis' });
    }
    db.run(
        `INSERT INTO matches (opponent, match_date, location, home_away, result, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [
            String(opponent).trim(),
            match_date || '',
            location || '',
            home_away || 'home',
            result || '',
            notes || ''
        ],
        function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.delete('/api/matches/:id', requireAdmin, (req, res) => {
    db.run(`DELETE FROM matches WHERE id = ?`, [parseInt(req.params.id, 10)], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// ---- Gallery ----
app.get('/api/gallery-images', (req, res) => {
    const galleryDir = path.join(__dirname, 'assets/images/gallery');
    ensureDir(galleryDir);
    fs.readdir(galleryDir, (err, files) => {
        if (err) return res.json([]);
        const exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const images = (files || [])
            .filter((f) => exts.includes(path.extname(f).toLowerCase()))
            .map((f) => ({
                src: '/assets/images/gallery/' + f,
                filename: f,
                alt: 'Photo SUP\'BASKET'
            }));
        res.json(images);
    });
});

app.post('/api/gallery-upload', requireAdmin, galleryUpload.array('photos', 20), (req, res) => {
    if (!req.files || !req.files.length) {
        return res.status(400).json({ success: false, error: 'Aucun fichier uploadé' });
    }
    res.json({
        success: true,
        message: req.files.length + ' photo(s) ajoutée(s)',
        files: req.files.map((f) => f.filename)
    });
});

app.post('/api/gallery-delete', requireAdmin, (req, res) => {
    const { src } = req.body || {};
    if (!src) return res.status(400).json({ success: false, error: 'Chemin manquant' });
    const filename = path.basename(src);
    const filePath = path.join(__dirname, 'assets/images/gallery', filename);
    if (!filePath.startsWith(path.join(__dirname, 'assets/images/gallery'))) {
        return res.status(403).json({ success: false, error: 'Chemin non autorisé' });
    }
    fs.unlink(filePath, (err) => {
        if (err) return res.status(500).json({ success: false, error: 'Impossible de supprimer' });
        res.json({ success: true });
    });
});

// ---- Contact / messages ----
app.post('/api/contact', (req, res) => {
    const { name, email, phone, subject, message } = req.body || {};
    if (!name || !message) {
        return res.status(400).json({ success: false, error: 'Nom et message requis' });
    }
    db.run(
        `INSERT INTO messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)`,
        [name, email || '', phone || '', subject || 'Contact', message],
        function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        }
    );
});

app.get('/api/messages', requireAdmin, (req, res) => {
    db.all(`SELECT * FROM messages ORDER BY date DESC, id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.delete('/api/messages/:id', requireAdmin, (req, res) => {
    db.run(`DELETE FROM messages WHERE id = ?`, [parseInt(req.params.id, 10)], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// ---- Pages ----
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(400).json({ success: false, error: err.message || 'Erreur serveur' });
});

app.listen(PORT, () => {
    console.log(`SUP'BASKET running at http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
});
