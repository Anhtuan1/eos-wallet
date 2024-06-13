var MAX = 30;
const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');  // development only
// const fetch = require('node-fetch');                                // node only; not needed in browsers
const { TextEncoder, TextDecoder } = require('util');               // node only; native TextEncoder/Decoder
const ecc = require('eosjs-ecc');                                   // For key pair generation
const fs = require('fs').promises;
const path = require('path');
// EOSIO endpoint
const rpc = new JsonRpc('https://wax.greymass.com', { fetch }); // replace with your node endpoint

const generateRandomAccountName = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz12345';
  let accountName = '';
  for (let i = 0; i < 12; i++) {
    accountName += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return accountName;
};
const filePath = path.join(__dirname, `${new Date()}.txt`);

const dataSignature = async () => {
  try {
    const fileMaster = path.join(__dirname, 'master.txt');
    const data = await fs.readFile(fileMaster, 'utf8');
    const masterAcc = data.split('|');
    console.log(masterAcc);

    const sponsorPrivateKey = masterAcc[1]; // replace with your sponsor's private key
    const creatorAccountName = masterAcc[0];

    return {
      creatorAccountName: creatorAccountName,
      sponsorPrivateKey: sponsorPrivateKey,
    };
  } catch (err) {
    console.error('Error reading file:', err);
    throw err; // or handle the error as needed
  }
};

const create = async () => {
  return new Promise(resolve => {
    try {
      dataSignature().then(async (masterAcc) => {
        const sponsorPrivateKey = masterAcc.sponsorPrivateKey;
        const creatorAccountName = masterAcc.creatorAccountName;
        const signatureProvider = new JsSignatureProvider([sponsorPrivateKey]);
        const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

        const newAccountName = generateRandomAccountName();
        console.log('New Account Name:', newAccountName);
        // Generate key pairs for the new account
        const newPrivateKey = await ecc.randomKey();
        const newPublicKey = ecc.privateToPublic(newPrivateKey);

        console.log('New Private Key:', newPrivateKey);
        console.log('New Public Key:', newPublicKey);

        // New account details
        // replace with the sponsor account name

        // Create new account action
        const actions = [
          {
            account: 'eosio',
            name: 'newaccount',
            authorization: [{
              actor: creatorAccountName,
              permission: 'active',
            }],
            data: {
              creator: creatorAccountName,
              name: newAccountName,
              owner: {
                threshold: 1,
                keys: [{ key: newPublicKey, weight: 1 }],
                accounts: [],
                waits: [],
              },
              active: {
                threshold: 1,
                keys: [{ key: newPublicKey, weight: 1 }],
                accounts: [],
                waits: [],
              },
            },
          },
          {
            account: 'eosio',
            name: 'buyrambytes',
            authorization: [{
              actor: creatorAccountName,
              permission: 'active',
            }],
            data: {
              payer: creatorAccountName,
              receiver: newAccountName,
              bytes: 3000, // 8 KB of RAM
            },
          },
          //   {
          //     account: 'eosio',
          //     name: 'delegatebw',
          //     authorization: [{
          //       actor: creatorAccountName,
          //       permission: 'active',
          //     }],
          //     data: {
          //       from: creatorAccountName,
          //       receiver: newAccountName,
          //       stake_net_quantity: '0.1000 EOS',
          //       stake_cpu_quantity: '0.1000 EOS',
          //       transfer: false,
          //     },
          //   },
        ];

        // Push transaction
        const result = await api.transact({ actions }, {
          blocksBehind: 3,
          expireSeconds: 90,
        });

        console.log('Account created successfully:', result);
        if (result) {
          await fs.appendFile(filePath, [newAccountName, newPrivateKey, newPublicKey].join`|` + '\n', 'utf8', (err) => {
            if (err) {
              console.error('Error writing to file:', err);
              return res.status(500).send('Error writing to file');
            }
          })
        }

      })

    } catch (e) {
      if (e instanceof RpcError) {
        console.error(JSON.stringify(e.json, null, 2));
      } else {
        console.error(e);
      }
    }
    resolve();
  }, Math.random() * 1000);
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {

  for (let i = 1; i <= MAX; i++) {
    await create();
    await sleep(4000);
  }

})()