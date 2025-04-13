const pinataSDK = require("@pinata/sdk");
const fs = require("fs");
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });
const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);
const stream = fs.createReadStream("/workspace/Data-Doc/test.csv");
pinata.pinFileToIPFS(stream, { pinataMetadata: { name: "test.csv" } })
  .then(result => console.log("Pinned:", result.IpfsHash))
  .catch(console.error);
