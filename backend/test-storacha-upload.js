const { Web3Storage } = require("web3.storage");
const fs = require("fs");
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });
const storacha = new Web3Storage({ token: process.env.STORACHA_API_KEY });
const buffer = fs.readFileSync("/workspace/Data-Doc/test.csv");
const file = new File([buffer], "test.csv", { type: "text/csv" });
storacha.put([file]).then(cid => console.log("CID:", cid)).catch(console.error);
