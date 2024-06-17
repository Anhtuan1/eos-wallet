const THREAD_NUMBER = 4;
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

      worker.on('message', (result) => {
        if (result.success) {
          // Update the account state if mining was successful
          accountState[result.wallet] = Date.now() + 60000; // Assuming you update state with a 1-minute delay
          resolve(result);
        } else {
          reject(result.error);
        }
      });

      worker.on('error', (err) => {
        reject(err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  while (true) {
    const now = new Date();
    const hour = now.getHours();
    const listAcc = hour >= 6 && hour < 18 ? listAccMorning : listAccMoon;

    const workers = [];
    for (let i = 0; i < listAcc.length; i++) {
      const [wallet, privateKey] = listAcc[i].split('|');
      if (!accountState[wallet] || now.getTime() >= accountState[wallet]) {
        workers.push(createWorker(wallet, privateKey));
        if (workers.length >= THREAD_NUMBER) {
          await Promise.all(workers);
          workers.length = 0;
        }
      }
    }
    // Wait for all remaining workers to finish
    if (workers.length > 0) {
      await Promise.all(workers);
    }
  }
})();