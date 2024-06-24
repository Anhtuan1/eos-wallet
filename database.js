const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'mydatabase.db');

  const db = new sqlite3.Database(dbPath, err => {
    if (err) {
      return console.error('Lỗi kết nối đến cơ sở dữ liệu:', err.message);
    }
    console.log('Đã kết nối đến cơ sở dữ liệu SQLite.');
  });

db.serialize(() => {
  db.run(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet TEXT,
    privateKey TEXT,
    publicKey TEXT,
    accountName TEXT,
    bags TEXT,
    land TEXT,
    nft TEXT,
    lastTx TEXT,
    lastTime TEXT,
    note TEXT,
    balance TEXT,
    reward TEXT,
    updated TEXT
  )
`);
});

module.exports = db;