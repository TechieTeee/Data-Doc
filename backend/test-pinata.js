const pinataSDK = require("@pinata/sdk");
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });
const pinata = new pinataSDK({ pinataJWT: process.env.PINATA_JWT });
pinata.testAuthentication().then(console.log).catch(console.error);
