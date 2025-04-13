const express = require("express");
const multer = require("multer");
const PinataSDK = require("@pinata/sdk");
const { ethers } = require("ethers");
const cors = require("cors");
const fs = require('fs');
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });

const app = express();

// Log environment variables (for debugging)
console.log("Env vars:", {
  privateKey: process.env.PRIVATE_KEY ? "Loaded" : "Missing",
  alchemy: process.env.ALCHEMY_API_KEY ? "Loaded" : "Missing",
  pinataApi: process.env.PINATA_API_KEY ? "Loaded" : "Missing",
  pinataSecret: process.env.PINATA_SECRET ? "Loaded" : "Missing"
});

// Enable CORS
app.use(cors({
  origin: ["https://3000-techieteee-datadoc-0jtulr7q8pd.ws-us118.gitpod.io", "http://localhost:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// Debug middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const upload = multer({ dest: "uploads/" });
let pinata;
try {
  pinata = new PinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);
  console.log("Pinata SDK initialized");
} catch (error) {
  console.error("Pinata init failed:", error);
}

const provider = new ethers.JsonRpcProvider(
  `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = "0xD624121d86871E022E3674F45C43BBB30188033e";
const contractABI = [
  "function addDataset(string ipfsCid, string eigenDAId, uint256 price)",
  "function datasetCount() view returns (uint256)"
];
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// Test endpoint
app.get("/", (req, res) => {
  res.json({ status: "Backend running", env: process.env.PRIVATE_KEY ? "Key loaded" : "Key missing" });
});

// Fixed upload endpoint with proper BigInt handling
app.post("/upload", upload.single("dataset"), async (req, res) => {
  console.log("Upload request received:", req.file, req.body);
  try {
    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }
    if (!pinata) {
      console.error("Pinata not initialized");
      return res.status(500).json({ error: "Pinata service unavailable" });
    }
    
    // Use a readable stream from the file
    const readableStreamForFile = fs.createReadStream(req.file.path);
    
    const pinataOptions = {
      pinataMetadata: { name: req.file.originalname }
    };
    
    const { IpfsHash } = await pinata.pinFileToIPFS(readableStreamForFile, pinataOptions);
    
    console.log("Pinned to IPFS:", IpfsHash);
    const storachaCid = "mock-storacha-" + Date.now();
    const eigenDAId = "mock-eigenda-" + Math.floor(Math.random() * 1000);
    
    // Fix for BigInt error - use a string representation for price
    const price = "1000000"; // 1 unit with 6 decimals
    
    // Log data being sent to contract
    console.log("Sending to contract:", {
      ipfsCid: IpfsHash,
      eigenDAId: eigenDAId,
      price: price
    });
    
    const tx = await contract.addDataset(IpfsHash, eigenDAId, price);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    
    // Use Number() to avoid BigInt in response
    const datasetCount = await contract.datasetCount();
    const datasetId = Number(datasetCount) - 1;
    
    res.json({ 
      ipfsCid: IpfsHash, 
      storachaCid, 
      eigenDAId, 
      datasetId: datasetId.toString(),
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

app.listen(3001, () => console.log("Backend listening on http://localhost:3001"));