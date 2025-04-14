const { create } = require("@web3-storage/w3up-client");
const fs = require("fs");
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });

// Import Blob to use in Node.js environment
const { Blob } = require("buffer");
// We'll need this for the File implementation
const { File: NodeFile } = require("@web3-storage/upload-client");

async function main() {
  try {
    console.log("Initializing Storacha w3up client...");
    const storacha = await create();
    
    // You need to authenticate before uploading
    if (process.env.STORACHA_EMAIL) {
      console.log(`Logging in with email: ${process.env.STORACHA_EMAIL}`);
      await storacha.login(process.env.STORACHA_EMAIL);
      console.log("Login successful");
      
      // If you have a space DID, set it
      if (process.env.STORACHA_SPACE_DID) {
        console.log(`Setting space DID: ${process.env.STORACHA_SPACE_DID}`);
        await storacha.setCurrentSpace(process.env.STORACHA_SPACE_DID);
      } else {
        console.log("No space DID provided, creating a new space...");
        // Create a new space if one isn't configured
        const space = await storacha.createSpace("data-doc-space");
        await storacha.setCurrentSpace(space.did());
        console.log(`Created and set new space with DID: ${space.did()}`);
        console.log("TIP: Add this DID to your .env file as STORACHA_SPACE_DID");
      }
    } else {
      throw new Error("STORACHA_EMAIL not found in environment variables");
    }
    
    console.log("Reading file...");
    const buffer = fs.readFileSync("/workspace/Data-Doc/test.csv");
    
    // Create a Blob from the buffer
    const blob = new Blob([buffer], { type: "text/csv" });
    
    // Use the NodeFile implementation that works with w3up-client
    const file = new NodeFile([blob], "test.csv", { type: "text/csv" });
    
    console.log("Uploading file to web3.storage...");
    const uploadResult = await storacha.uploadFile(file);
    
    console.log("Upload successful!");
    console.log("CID:", uploadResult.cid.toString());
  } catch (err) {
    console.error("Storacha error:", err.message);
    console.error(err.stack);
  }
}

main();