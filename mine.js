const MAX_CONCURRENT_WORKERS = 4;
const { Api, JsonRpc, RpcError, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');  // development only
const fs = require('fs').promises;
const path = require('path');
const { Worker } = require('worker_threads');

(async () => {
  const fileMorning = path.join(__dirname, 'acc_morning.txt');
  const acc_morning = await fs.readFile(fileMorning, 'utf8');
  const listAccMorning = acc_morning.split('\n');

  const fileMoon = path.join(__dirname, 'acc_moon.txt');
  const acc_moon = await fs.readFile(fileMoon, 'utf8');
  const listAccMoon = acc_moon.split('\n');

  const accountState = {};

  function createWorker(wallet, privateKey) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'worker.js'));
      worker.postMessage({ wallet, privateKey }); 

      worker.on('message', (message) => {
        console.log(message)
        if (message?.result) {
          const { wallet, nextMiningTime } = message.result;
          
          accountState[wallet] = nextMiningTime;
          resolve();
        } else {
          console.error(`Mining failed for wallet ${wallet}: ${message.error}`);
          resolve(); // Continue processing other accounts even if one fails
        }
      });

      worker.on('error', (err) => {
        console.error(`Worker error for wallet ${wallet}: ${err}`);
        resolve(); // Continue processing other accounts even if one fails
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker stopped with exit code ${code}`);
        }
      });
    });
  }

  async function processAccounts(listAcc) {
    const workers = [];
    for (let i = 0; i < listAcc.length; i++) {
      const [wallet, privateKey] = listAcc[i].split('|');
      if (!accountState[wallet] || Date.now() >= accountState[wallet]) {
        if (workers.length >= MAX_CONCURRENT_WORKERS) {
          await Promise.all(workers);
          workers.length = 0;
        }
        workers.push(createWorker(wallet, privateKey));
      }
    }
    if (workers.length > 0) {
      await Promise.all(workers);
    }
  }

  while (true) {

    const now = new Date();
    const hour = now.getHours();
    const listAcc = hour >= 6 && hour < 18 ? listAccMorning : listAccMoon;
    await processAccounts(listAcc);

  }
})();