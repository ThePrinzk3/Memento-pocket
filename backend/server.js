const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const db = new sqlite3.Database('./memento.sqlite', (err) => {
    if (err) throw err;
    console.log("ESP32 Simulado: Conectado a la MicroSD (SQLite local).");
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sd_storage (
        id INTEGER PRIMARY KEY, total_capacity INTEGER DEFAULT 17179869184, used_capacity INTEGER DEFAULT 0
    )`);
    db.run(`INSERT OR IGNORE INTO sd_storage (id, total_capacity, used_capacity) VALUES (1, 17179869184, 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS encrypted_files (
        file_id INTEGER PRIMARY KEY AUTOINCREMENT, file_name TEXT NOT NULL, file_type TEXT NOT NULL,
        encrypted_content TEXT NOT NULL, access_pin TEXT NOT NULL, file_size INTEGER NOT NULL, transfer_mode TEXT NOT NULL
    )`);
});

app.get('/api/status', (req, res) => {
    db.get('SELECT * FROM sd_storage WHERE id = 1', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: 'Conectado', battery: '100%', storage: row });
    });
});

app.post('/api/transfer', (req, res) => {
    const { fileName, fileType, content, pin, size, mode } = req.body;
    db.serialize(() => {
        db.run(`INSERT INTO encrypted_files (file_name, file_type, encrypted_content, access_pin, file_size, transfer_mode) 
                VALUES (?, ?, ?, ?, ?, ?)`, [fileName, fileType, content, pin, size, mode], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run(`UPDATE sd_storage SET used_capacity = used_capacity + ? WHERE id = 1`, [size]);
            db.get('SELECT * FROM sd_storage WHERE id = 1', (err, row) => res.json({ message: `Transferido`, storage: row }));
        });
    });
});

app.get('/api/files', (req, res) => {
    db.all('SELECT file_id, file_name, file_type, file_size, transfer_mode FROM encrypted_files', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/read-file', (req, res) => {
    const { file_id, pin } = req.body;
    db.get('SELECT file_name, file_type, encrypted_content FROM encrypted_files WHERE file_id = ? AND access_pin = ?', [file_id, pin], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) res.json({ success: true, file: row });
        else res.status(401).json({ success: false, message: 'PIN Incorrecto' });
    });
});

// NUEVO: Actualizar PIN y contenido re-encriptado
app.put('/api/files/:id/pin', (req, res) => {
    const { new_pin, new_content, new_size } = req.body;
    db.run('UPDATE encrypted_files SET access_pin = ?, encrypted_content = ?, file_size = ? WHERE file_id = ?', 
        [new_pin, new_content, new_size, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/files/:id', (req, res) => {
    db.get('SELECT file_size FROM encrypted_files WHERE file_id = ?', [req.params.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'No encontrado' });
        db.run('DELETE FROM encrypted_files WHERE file_id = ?', [req.params.id], function(err) {
            db.run(`UPDATE sd_storage SET used_capacity = used_capacity - ? WHERE id = 1`, [row.file_size]);
            res.json({ success: true });
        });
    });
});

// NUEVO: Formatear SD (Configuración)
app.delete('/api/format', (req, res) => {
    db.run('DELETE FROM encrypted_files', function(err) {
        db.run(`UPDATE sd_storage SET used_capacity = 0 WHERE id = 1`);
        res.json({ success: true });
    });
});

app.post('/api/buzzer', (req, res) => { res.json({ success: true }); });
app.listen(3000, () => console.log('ESP32 Server ejecutándose en puerto 3000'));