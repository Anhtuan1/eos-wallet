const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Home route to read and display the content of account.txt
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'acc_morning.txt');
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error reading file');
    }

    res.send(`<pre>${data}</pre>`);
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
