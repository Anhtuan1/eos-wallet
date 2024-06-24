const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const axios = require('axios');
const db = require('./database');
const fs = require('fs');
const readline = require('readline');

const app = express();
const PORT = 3000;
const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const rpc_endpoint = () => {
  var endpointList = [
    "https://wax.eosdac.io",
    "https://apiwax.3dkrender.com",
    "https://wax.blacklusion.io",
    "https://wax.blokcrafters.io",
    "https://wax.eu.eosamsterdam.net",
    "http://api.wax.alohaeos.com"
  ];
  return endpointList[~~(Math.random() * (endpointList.length - 1))];
};

const nft_endpoint = () => {
  var endpointList = [
    "https://wax.api.atomicassets.io",
    "https://aa.dapplica.io",
    "https://wax-aa.eu.eosamsterdam.net",
    "https://wax-aa.eosdac.io",
    "https://atomic.wax.eosrio.io",
    "https://atomic.wax.tgg.gg",
  ];
  return endpointList[~~(Math.random() * (endpointList.length - 1))];
};

// Home route to serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Route to import accounts from file
app.post('/import', upload.single('file'), (req, res) => {
  const filePath = req.file.path;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    const [wallet, privateKey] = line.split('|');
    db.run("INSERT OR IGNORE INTO accounts (wallet, privateKey, balance, updated) VALUES (?, ?, ?, ?)", 
      [wallet.trim(), privateKey.trim(), '0.0', new Date().toISOString()], 
      (err) => {
        if (err) {
          console.error(err.message);
        }
      });
  });

  rl.on('close', () => {
    fs.unlinkSync(filePath);  // Delete the file after processing
    res.send('Accounts imported successfully.');
  });
});

// Route to check balance
app.post('/check', async (req, res) => {
  const userAccount = req.body.account;

  try {
    var rpc = rpc_endpoint();
    const response = await axios.post(rpc + '/v1/chain/get_table_rows', {
      code: "m.federation",
      index_position: 1,
      json: true,
      key_type: "",
      limit: 10,
      lower_bound: userAccount,
      reverse: false,
      scope: "m.federation",
      show_payer: false,
      table: "minerclaim",
      table_key: "",
      upper_bound: userAccount,
    });

    const balance = response.data.rows[0].balance; // Adjust according to your response structure
    console.log(balance)
    db.run("UPDATE accounts SET balance = ?, updated = ? WHERE wallet = ?", 
      [balance, new Date().toISOString(), userAccount], 
      (err) => {
        if (err) {
          console.error(err.message);
        }
      });

    res.send(`Balance for ${userAccount} updated successfully.`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error checking balance.');
  }
});

/// Route to get accounts with limit, order, and pagination
app.get('/accounts', (req, res) => {
  const limit = parseInt(req.query.limit) || 3000; // Default limit to 50 if not specified
  const page = parseInt(req.query.page) || 1; // Default page to 1 if not specified
  const order = req.query.order || 'updated'; // Default order by 'wallet'
  const offset = (page - 1) * limit;

  db.all(`SELECT wallet, publicKey, accountName, bags, land, nft, lastTx, lastTime, note, balance, reward, updated FROM accounts ORDER BY ${order} LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Error fetching accounts.');
    } else {
      res.json(rows);
    }
  });
});

// Route to get total count of wallets
app.get('/accounts/count', (req, res) => {
  db.get("SELECT COUNT(*) as count FROM accounts", [], (err, row) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Error fetching account count.');
    } else {
      res.json({ count: row.count });
    }
  });
});


app.delete('/accounts/:wallet', (req, res) => {
  const wallet = req.params.wallet;
  db.run("DELETE FROM accounts WHERE wallet = ?", [wallet], function(err) {
    if (err) {
      console.error(err.message);
      res.status(500).send('Error deleting account.');
    } else {
      res.send(`Account ${wallet} deleted successfully.`);
    }
  });
});

app.put('/accounts/reward/:wallet', (req, res) => {
  const wallet = req.params.wallet;
  const { reward } = req.body;
  db.run(
    `UPDATE accounts SET reward = ?, updated = ? WHERE wallet = ?`,
    [reward, new Date().toISOString(), wallet],
    function(err) {
      if (err) {
        console.error(err.message);
        res.status(500).send('Error updating account.');
      } else {
        res.send(`Account ${wallet} updated successfully.`);
      }
    }
  );
});

app.put('/accounts/balance/:wallet', (req, res) => {
  const wallet = req.params.wallet;
  const { balance } = req.body;
  console.log(balance);
  db.run(
    `UPDATE accounts SET balance = ?, updated = ? WHERE wallet = ?`,
    [balance, new Date().toISOString(), wallet],
    function(err) {
      if (err) {
        console.error(err.message);
        res.status(500).send('Error updating account.');
      } else {
        res.send(`Account ${wallet} updated successfully.`);
      }
    }
  );
});

app.put('/accounts/lastTx/:wallet', (req, res) => {
  const wallet = req.params.wallet;
  const { lastTx } = req.body;
  db.run(
    `UPDATE accounts SET lastTx = ?, updated = ? WHERE wallet = ?`,
    [lastTx, new Date().toISOString(), wallet],
    function(err) {
      if (err) {
        console.error(err.message);
        res.status(500).send('Error updating account.');
      } else {
        res.send(`Account ${wallet} updated successfully.`);
      }
    }
  );
});

app.put('/accounts/:wallet', (req, res) => {
  const wallet = req.params.wallet;
  const { publicKey, accountName, bags, land, nft, lastTx, lastTime, note, balance, reward } = req.body;
  db.run(
    `UPDATE accounts SET publicKey = ?, accountName = ?, bags = ?, land = ?, nft = ?, lastTx = ?, lastTime = ?, note = ?, balance = ?, reward = ?, updated = ? WHERE wallet = ?`,
    [publicKey, accountName, bags, land, nft, lastTx, lastTime, note, balance, reward, new Date().toISOString(), wallet],
    function(err) {
      if (err) {
        console.error(err.message);
        res.status(500).send('Error updating account.');
      } else {
        res.send(`Account ${wallet} updated successfully.`);
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});