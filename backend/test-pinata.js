const pinataSDK = require("@pinata/sdk");
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });
const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);
pinata.testAuthentication().then(console.log).catch(console.error);
