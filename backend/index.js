const express = require("express");
const multer = require("multer");
const PinataSDK = require("@pinata/sdk");
const { ethers } = require("ethers");
const cors = require("cors");
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: ["https://3000-techieteee-datadoc-0jtulr7q8pd.ws-us118.gitpod.io", "http://localhost:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Debug middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const pinata = new PinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);
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

app.post("/upload", upload.single("dataset"), async (req, res) => {
  console.log("Upload request received:", req.file, req.body);
  try {
    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }
    const { IpfsHash } = await pinata.pinFileToIPFS(req.file.path, {
      pinataMetadata: { name: req.file.originalname }
    });
    console.log("Pinned to IPFS:", IpfsHash);
    const storachaCid = "mock-storacha-" + Date.now();
    const eigenDAId = "mock-eigenda-" + Math.floor(Math.random() * 1000);
    const price = ethers.parseUnits("1", 6);
    const tx = await contract.addDataset(IpfsHash, eigenDAId, price);
    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    const datasetId = (await contract.datasetCount()) - 1;
    res.json({ ipfsCid: IpfsHash, storachaCid, eigenDAId, datasetId });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

app.listen(3001, () => console.log("Backend listening on http://localhost:3001"));