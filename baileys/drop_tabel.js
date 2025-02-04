const sqlite3 = require('sqlite3').verbose();

// Buka koneksi ke database
const db = new sqlite3.Database('./messages.db', (err) => {
    if (err) {
        console.error('Error membuka database:', err.message);
    } else {
        console.log('Terhubung ke database SQLite.');
    }
});

// Drop tabel messages
db.run('DROP TABLE IF EXISTS messages', (err) => {
    if (err) {
        console.error('Error menghapus tabel:', err.message);
    } else {
        console.log('Tabel messages berhasil dihapus.');
    }
});

// Tutup koneksi
db.close((err) => {
    if (err) {
        console.error('Error menutup koneksi database:', err.message);
    } else {
        console.log('Koneksi database ditutup.');
    }
});
