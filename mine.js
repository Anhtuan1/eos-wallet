const MAX_CONCURRENT_WORKERS = 4;
const BATCH_SIZE = 50; 
const readline = require('readline');
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

  // Delay function to sleep for a specified time in milliseconds
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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

  async function processBatch(listAcc) {
    const workers = [];
    for (const acc of listAcc) {
      const [wallet, privateKey] = acc.split('|');
      if (!accountState[wallet] || Date.now() >= accountState[wallet]) {
        workers.push(createWorker(wallet, privateKey));
        if (workers.length >= MAX_CONCURRENT_WORKERS) {
          await Promise.all(workers);
          workers.length = 0;
        }
        await delay(1000);
      }else{
        await delay(2000);
      }
    }
    if (workers.length > 0) {
      await Promise.all(workers);
    }
  }

  async function processAccounts(listAcc) {
    for (let i = 0; i < listAcc.length; i += BATCH_SIZE) {
      const batch = listAcc.slice(i, i + BATCH_SIZE);
      await processBatch(batch);
    }
  }

  while (true) {
    const now = new Date();
    const hour = now.getHours();
    const listAcc = hour >= 6 && hour < 18 ? listAccMorning : listAccMoon;
    await processAccounts(listAcc);
  }
})();