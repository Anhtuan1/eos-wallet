const WALLET_MASTER = 'jyora.wam';
const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');  
// const fetch = require('node-fetch');                              
const { TextEncoder, TextDecoder } = require('util'); 
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
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
      updated TEXT
    )
  `);
  });

const rpc_endpoint = () => {
  var endpointList = [
    "https://wax.eosdac.io",
    "https://wax.eosrio.io",
    "https://api.wax.alohaeos.com",
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

const accNameRandom = () => {
  let stringGroup = "zaqwsxcderfvbgtyhnujmikolp";
  var accName2 = "";
  for (let i = 0; i < 7; i++) {
    accName2 +=
      stringGroup[Math.floor(Math.random() * (stringGroup.length - 1))];
  }
  return accName2;
};


const withdraw = async (account, sponsorPrivateKey, nfts, balance) => {
  try {
    var actions = [];
    if(balance > 0.01){
      var num_tras = (Math.floor(parseFloat(balance)*100))/100;
      var num_str = (""+num_tras).split('.');
      var num_trans = num_str.length == 1 ? num_str[0]+".0000" : num_str.join('.')+"0".repeat(4-num_str[1].length)
      actions.push({
        account: 'alien.worlds',
        name: 'transfer',
        authorization: [{
          actor: account,
          permission: 'active',
        }],
        data: {
        from: account,
        to: WALLET_MASTER,
        quantity: num_trans+" TLM",
        memo: '',
        },
      })
    }
    if(nfts.length > 0){ 
      var data_bag = [];
      nfts.map((x) => {
        if(x?.name != 'Male Human' && x?.is_transferable === true){
          data_bag.push(x.asset_id)
        }
      })
      if(data_bag.length > 0 ){
        actions.push({
          account: 'atomicassets',
          name: 'transfer',
          authorization: [{
            actor: account,
            permission: 'active',
          }],
          data: {
          asset_ids: [...data_bag],
          from: account,
          to: WALLET_MASTER,
          memo: '',
          },
        })
      }
      
    }
    if(actions.length > 0){
      const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

      const signatureProvider = new JsSignatureProvider([sponsorPrivateKey]);

      // API instance
      const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
      const result = await api.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 90,
      });

      console.log('Account created successfully:', result);
    }
  } catch (e) {
    console.log(e);
  }

}

const setupBags = async (userAccount, sponsorPrivateKey, nfts) => {
  try {
    var map = ["1099512960056"];
    const id_map = map[Math.floor(Math.random() * (map.length - 1))];
    var data_bag = []
    for (let i = 0; i < 3; i++) {
      if (nfts[i]) {
        if(nfts[i].totalPoints > 22){
          data_bag.push(nfts[i].asset_id);
        }
      }
    }
    if(data_bag.length > 0){
      const actions = [
        {
          account: "m.federation",
          name: "setbag",
          authorization: [
            {
              actor: userAccount,
              permission: "active",
            },
          ],
          data: {
            account: userAccount,
            items: data_bag,
          },
        },
      ];
      const rpc = new JsonRpc('https://wax.greymass.com', { fetch });

      const signatureProvider = new JsSignatureProvider([sponsorPrivateKey]);

      // API instance
      const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
      const result = await api.transact({ actions }, {
        blocksBehind: 3,
        expireSeconds: 90,
      });

      console.log('Account created successfully:', result);
    }
  } catch (e) {
    if (e instanceof RpcError) {
      console.error(JSON.stringify(e.json, null, 2));
    } else {
      console.error(e);
    }
  }

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const getBags = async (userAccount) => {
  var rpc = rpc_endpoint();
  try {
    const resp = await axios.post(
      rpc + "/v1/chain/get_table_rows", // URL to POST to
      {
        code: "m.federation",
        index_position: 1,
        json: true,
        key_type: "",
        limit: 10,
        lower_bound: userAccount,
        reverse: false,
        scope: "m.federation",
        show_payer: false,
        table: "bags",
        table_key: "",
        upper_bound: userAccount,
      }
    );
    console.log(resp)
    if (resp?.data?.rows[0]?.items) {
      console.log("bags", [...resp.data.rows[0]?.items]);
      return [...resp.data.rows[0]?.item]
  
    } else {
      return []
    }
  } catch (error) {
    console.error('Error fetching data:', error.message);
    throw error; // Throw the error to handle it further up the call stack
  }
  
 
  
};

const getLandId = async (userAccount) => {
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
      table: "miners",
      table_key: "",
      upper_bound: userAccount,
    }),
  })
  if (res?.data?.rows) {
    if (res.data.rows[0]?.current_land) {
      return res.data.rows[0].current_land
    } else {
      return null
    }

  } else {
    return null
  }
};



const getNfts = async (userAccount) => {
  if (!userAccount) {
    return [];
  }

  var nft_rpc = nft_endpoint();
  console.log(nft_rpc);
  const res = await axios.get(
    nft_rpc +
    `/atomicassets/v1/assets?owner=` +
    userAccount +
    `&imit=100`
  );
  
  if (res.data) {
    let nftsAndPoint = res.data.data.map((x) => {
      if (x.data.ease || x.data.luck || x.data.difficulty) {
        x.totalPoints =
          x.data.ease + 2 * x.data.luck + x.data.difficulty;
        return x;
      }
    });
    var nftsSort = nftsAndPoint.sort(
      (x, y) => y.totalPoints - x.totalPoints
    );
    
    return nftsSort

  } else {
    return []
  }

};

const getBlance = async (userAccount) => {
  if (!userAccount) {
    return [];
  }
  var rpc = rpc_endpoint();
  const res = await axios.post(
    rpc + "/v1/chain/get_currency_balance",
    {
      code: "alien.worlds",
      account: userAccount,
      symbol: "TLM",
    },
  )
      if (res.status === 200) {
        return res.data[0];
      } else {
        return null;
      }
     
};


(async () => {
  


  const fileMaster = path.join(__dirname, 'setup.txt');
  const dataAcc = await fs.readFile(fileMaster, 'utf8');
  const listAcc = dataAcc.split('\n');
  for(let i=1; i< listAcc.length; i++){
    const [wallet, privateKey, publicKey] = listAcc[i].split('|');
    // const accName = await getAccName(wallet);
    const nfts = await getNfts(wallet);
    const balance = await getBlance(wallet);
    console.log('i', i)
    if(nfts.length > 0){
      await withdraw(wallet,privateKey,nfts, balance);
    }
    
  }

  
  db.close();
})()

