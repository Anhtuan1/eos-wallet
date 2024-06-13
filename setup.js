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


const setup = async (userAccount, sponsorPrivateKey, nfts) => {
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

    const actions = [
      {
        account: "federation",
        name: "agreeterms",
        authorization: [
          {
            actor: userAccount,
            permission: "active",
          },
        ],
        data: {
          account: userAccount,
          terms_id: 1,
          terms_hash:
            "e2e07b7d7ece0d5f95d0144b5886ff74272c9873d7dbbc79bc56f047098e43ad",
        },
      },
      {
        account: "federation",
        name: "settag",
        authorization: [
          {
            actor: userAccount,
            permission: "active",
          },
        ],
        data: {
          account: userAccount,
          tag: accNameRandom(),
        },
      },
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
      {
        account: "m.federation",
        name: "setland",
        authorization: [
          {
            actor: userAccount,
            permission: "active",
          },
        ],
        data: {
          account: userAccount,
          land_id: id_map,
        },
      }
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

  } catch (e) {
    if (e instanceof RpcError) {
      console.error(JSON.stringify(e.json, null, 2));
    } else {
      console.error(e);
    }
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
    console.log(nfts);
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

const getAccName = async (userAccount) => {
  if (userAccount) {
    var rpc = rpc_endpoint();
    const res = await axios({
      method: "post",
      url: rpc + "/v1/chain/get_table_rows",
      data: JSON.stringify({
        code: "federation",
        json: true,
        lower_bound: userAccount,
        scope: "federation",
        show_payer: false,
        table: "players",
        table_key: "",
        upper_bound: userAccount,
      }),
    })
    if (res.data.rows[0]?.tag) {
      if (res.data.rows[0]?.tag != userAccount) {
        return res.data.rows[0]?.tag
      }
    } else {
      return null;
    }
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
    `&collection_name=alien.worlds&limit=100`
  );
  
  if (res.data) {
    let nftsAndPoint = res.data.data.map((x) => {
      if (x.data.ease || x.data.luck || x.data.difficulty) {
        x.totalPoints = x.data.ease + 2 * x.data.luck + x.data.difficulty;
        if (x.totalPoints > 22) {
          return x;
        }
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


(async () => {
  


  const fileMaster = path.join(__dirname, 'setup.txt');
  const dataAcc = await fs.readFile(fileMaster, 'utf8');
  const listAcc = dataAcc.split('\n');
  for(let i=1; i< listAcc.length; i++){
    const [wallet, privateKey, publicKey] = listAcc[i].split('|');
    // const accName = await getAccName(wallet);
    const nfts = await getNfts(wallet);
    
    console.log('i', i)
    // if(nfts.length > 0){
    //   await setup(wallet,privateKey,nfts);
    // }
    if(nfts.length > 0){
      await setupBags(wallet,privateKey,nfts);
    }
  }

  // const bags = await getBags(wallet);
  // const landId = await getLandId(wallet);
  // const accName2 = await getAccName(wallet);
  // const sql = `
  //   INSERT OR REPLACE INTO accounts (wallet, privateKey, publicKey, accountName, bags, land, nft, lastTx, lastTime, note, updated)
  //   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  // `;
  // db.run(sql, [
  //   wallet,
  //   privateKey,
  //   publicKey,
  //   accName2,
  //   bags.join`,`,
  //   landId,
  //   '',
  //   '',
  //   '',
  //   'Setup',
  //   ''
  // ], function(err) {
  //   if (err) {
  //     return console.error('Lỗi khi thêm hoặc cập nhật account:', err.message);
  //   }
  //   console.log(`Thêm hoặc cập nhật thành công. ID của bản ghi mới: ${this.lastID}`);
  // });
  db.close();
})()

