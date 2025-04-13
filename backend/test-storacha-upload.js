const { Web3Storage } = require("web3.storage");
const fs = require("fs");
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });
async function main() {
  try {
    const storacha = new Web3Storage({ token: process.env.STORACHA_API_KEY });
    const buffer = fs.readFileSync("/workspace/Data-Doc/test.csv");
    const file = new File([buffer], "test.csv", { type: "text/csv" });
    console.log("Uploading to Storacha...");
    const cid = await storacha.put([file], { wrapWithDirectory: false });
    console.log("CID:", cid);
  } catch (err) {
    console.error("Storacha error:", err.message, err.stack);
  }
}
main();
