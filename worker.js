const { Api, JsonRpc, RpcError, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');  // development only
const { parentPort } = require('worker_threads');                               // node only; not needed in browsers
const { TextEncoder, TextDecoder } = require('util');               // node only; native TextEncoder/Decoder
const ecc = require('eosjs-ecc');                                   // For key pair generation
const sha256 = require('crypto-js/sha256');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const accountState = {};
const accountBalance = {};

const rpc_endpoint = () => {
  var endpointList = [
    "https://wax.eosdac.io",
    "https://wax.api.eosnation.io",
    "https://wax.eosrio.io",
    "https://api.wax.alohaeos.com",
  ];
  return endpointList[~~(Math.random() * (endpointList.length - 1))];
};



const nameToArray = (name) => {

  const sb = new Serialize.SerialBuffer({
    textEncoder: new TextEncoder(),
    textDecoder: new TextDecoder(),
  });
  sb.pushName(name);
  const arr = new Uint8Array(8);
  for (let i = 0; i < 8; i += 1) {
    arr[i] = sb.array[i];
  }
  return arr;
};

const fromHexString = (hexString) =>
  new Uint8Array(
    hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );

const getRandomArray = () => {
  const arr = new Uint8Array(8);
  for (let i = 0; i < 8; i += 1) {
    arr[i] = Math.floor(Math.random() * 255);
  }
  return arr;
};

const toHex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

function sha256Hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const doProofOfWork = async ({ lastMine, account, userAccount, sponsorPrivateKey }) => {
  try {
    var difficulty = 0;
    var lastMineTx = (
      lastMine ??
      "0000000000000000000000000000000000000000000000000000000000000000"
    ).substr(0, 16);

    var lastMineArr = fromHexString(lastMineTx);

    console.log(
      `Performing work with difficulty ${difficulty}, last tx is ${lastMineTx}...`
    );

    let good = false;
    let itr = 0;
    var hexDigest;
    let randomArr;
    const start = new Date();

    while (!good) {
      randomArr = getRandomArray();

      var combined = new Uint8Array(
        account.length + lastMineArr.length + randomArr.length
      );

      combined.set(account);
      combined.set(lastMineArr, account.length);
      // console.log(combined);
      combined.set(randomArr, account.length + lastMineArr.length);


      const hexDigest = sha256Hash(combined.slice(0, 24));

      good = hexDigest.substr(0, 4) === "0000";


      if (good) {
        const last = parseInt(hexDigest.substr(4, 1), 16);
        good = last <= difficulty;
      }

      itr += 1;

      if (itr % 1000000 === 0) {
        // console.log(
        //   `Still mining - tried ${itr}. Ramdom ${randomArr}. hashSha256 ${hashSha256}. iterations.Last: ${parseInt(
        //     hexDigest.substr(4, 1),
        //     16
        //   )} . hexDigest: ${hexDigest}`
        // );
        // good = true;
      }
    }

    var randomString = toHex(randomArr);
    let end = new Date();


    const actions = [
      {
        account: "m.federation",
        name: "mine",
        authorization: [
          {
            actor: userAccount,
            permission: "active",
          },
        ],
        data: {
          miner: userAccount,
          nonce: randomString,
        },
      },
    ];

    const endPoint = rpc_endpoint()

    const rpc = new JsonRpc(endPoint, { fetch });
    console.log(endPoint);
    const signatureProvider = new JsSignatureProvider([sponsorPrivateKey]);
    const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
    const result = await api.transact({ actions }, {
      blocksBehind: 3,
      expireSeconds: 90,
    });

    console.log('Account created successfully:', result);
    if (result.processed) {
      result.processed.action_traces[0].inline_traces.forEach((t) => {

        if (t?.act?.data?.params?.delay) {
          accountState[userAccount] = new Date().getTime() + 1000 * t.act.data.params.delay;
          console.log('NextTime', accountState[userAccount]);
          
        }

      });
      await getRewards(userAccount, sponsorPrivateKey);
    }
    return { wallet: userAccount, nextMiningTime: accountState[userAccount] };
  } catch (e) {
    console.log(JSON.stringify(e.json, null, 2));
  }
};

const getRewards = async (userAccount, sponsorPrivateKey) => {
  try {
    var rpc = rpc_endpoint();

    const res = await axios({
      method: "post",
      url: rpc + "/v1/chain/get_table_rows",
      data: JSON.stringify({
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
      }),
    })

    if (res?.data?.rows[0]?.amount) {
      accountBalance[userAccount] = res?.data?.rows[0]?.amount;
    }

    if (parseFloat(res?.data?.rows[0]?.amount) > 6) {

      const actions = [
        {
          account: "m.federation",
          name: "claimmines",
          authorization: [
            {
              actor: userAccount,
              permission: "active",
            },
          ],
          data: {
            receiver: userAccount,
          },
        },
      ];
      const endPoint = rpc_endpoint()

      const rpc = new JsonRpc(rpc_endpoint(), { fetch });
      console.log(endPoint);
      const signatureProvider = new JsSignatureProvider([sponsorPrivateKey]);
      const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
      const result = await api.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 90,
      });
    }
  } catch (error) {
    console.log('Error fetching data:', error.message);
  }
};

const minning = async (userAccount, sponsorPrivateKey) => {
  try {

    var rpc_en = rpc_endpoint();
    const res = await axios({
      method: "post",
      url: rpc_en + "/v1/chain/get_table_rows",
      data: {
        json: true,
        code: "m.federation",
        scope: "m.federation",
        table: "miners",
        lower_bound: userAccount,
        upper_bound: userAccount,
        index_position: 1,
        key_type: "",
        limit: 10,
        reverse: false,
        show_payer: false,
      },
    })

    if (res.status === 200) {
      let lastMine = "";
      if (res.data?.rows[0]?.last_mine_tx) {
        lastMine = res.data.rows[0].last_mine_tx;
      }
      const result = await doProofOfWork({
        lastMine: lastMine,
        account: nameToArray(userAccount),
        userAccount: userAccount,
        sponsorPrivateKey: sponsorPrivateKey
      });
      return result;
    }




  } catch (e) {
    console.log(e);
  }
};



parentPort.on('message', async (data) => {
  const { wallet, privateKey } = data;
  try {
    const result = await minning(wallet, privateKey);
    parentPort.postMessage({ success: true, result });
  } catch (e) {
    parentPort.postMessage({ success: false, error: e.message });
  }
});