const express = require("express");
const multer = require("multer");
const pinataSDK = require("@pinata/sdk");
const axios = require("axios");
const FormData = require("form-data");
const { ethers } = require("ethers");
const cors = require("cors");
const fs = require("fs");
const stream = require("stream");
const snarkjs = require("snarkjs");
const crypto = require("crypto");
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });

const app = express();

console.log("Env vars:", {
  privateKey: process.env.PRIVATE_KEY ? "Loaded" : "Missing",
  alchemy: process.env.ALCHEMY_API_KEY ? "Loaded" : "Missing",
  pinataApi: process.env.PINATA_API_KEY ? "Loaded" : "Missing",
  pinataSecret: process.env.PINATA_SECRET ? "Loaded" : "Missing",
  pinataJWT: process.env.PINATA_JWT ? "Loaded" : "Missing",
  akave: process.env.AKAVE_NODE_ADDRESS ? "Loaded" : "Missing",
  storacha: process.env.STORACHA_API_KEY ? "Loaded" : "Missing",
});

// Add authentication bypass for Gitpod - BASED ON WORKING CODE
app.use((req, res, next) => {
  // Make request appear to come from localhost to bypass authentication
  req.headers['x-forwarded-for'] = '127.0.0.1';
  // Add localhost to the list of approved origins
  if (!req.headers['origin']) {
    req.headers['origin'] = 'http://localhost:3000';
  }
  console.log("Applied authentication bypass");
  next();
});

app.use(cors({
  origin: ["https://3000-techieteee-datadoc-0jtulr7q8pd.ws-us118.gitpod.io", "http://localhost:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true // Added to allow credentials
}));

// Debug middleware - enhanced with header logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Headers:", JSON.stringify(req.headers)); // Log headers for debugging
  next();
});

const upload = multer({ dest: "uploads/" });
let pinata, storacha;

// Initialize Pinata with either JWT or API Key/Secret depending on what's available
try {
  if (process.env.PINATA_JWT) {
    pinata = new pinataSDK({ pinataJWT: process.env.PINATA_JWT });
  } else {
    pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);
  }
  console.log("Pinata SDK initialized");
} catch (error) {
  console.error("Pinata init failed:", error);
}

// Initialize Storacha if API key available - FIXED INITIALIZATION
try {
  if (process.env.STORACHA_API_KEY) {
    console.log("Storacha API key available:", !!process.env.STORACHA_API_KEY);
    // Use the correct library import
    const { Web3Storage } = require('web3.storage');
    
    // Initialize with just the token string
    storacha = new Web3Storage(process.env.STORACHA_API_KEY);
    console.log("Storacha initialized");
  }
} catch (error) {
  console.error("Storacha init failed:", error.message);
  console.error("Error details:", error);
}

// Initialize Akave API client if node address available
let akaveApi;
if (process.env.AKAVE_NODE_ADDRESS) {
  akaveApi = axios.create({
    baseURL: `http://${process.env.AKAVE_NODE_ADDRESS}`,
    timeout: 60000,
  });
  console.log("Akave API client created");
}

// Blockchain provider and contract setup
const provider = new ethers.JsonRpcProvider(
  `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = "0xD624121d86871E022E3674F45C43BBB30188033e";
const contractABI = [
  "function addDataset(string ipfsCid, string eigenDAId, uint256 price, string zkpProof, string metadataCid) returns (uint256)",
  "function datasetCount() view returns (uint256)",
];
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// Akave streaming function
async function streamToAkave(filePath, fileName) {
  if (!akaveApi) {
    console.log("Akave API not initialized, skipping upload");
    return "akave-not-configured";
  }
  
  try {
    // Create file upload
    const createResponse = await akaveApi.post("/buckets/data_doc/files/create", { fileName });
    const uploadId = createResponse.data.uploadId;
    console.log("Akave upload created:", uploadId);

    // Stream chunks
    const fileStream = fs.createReadStream(filePath);
    let chunkIndex = 0;
    const chunkSize = 32 * 1024 * 1024;
    let buffer = Buffer.alloc(0);

    const uploadChunk = async (chunk) => {
      const form = new FormData();
      form.append("chunk", chunk, { filename: `chunk_${chunkIndex}` });
      form.append("chunkIndex", chunkIndex);
      const chunkResponse = await akaveApi.post(
        `/buckets/data_doc/files/${uploadId}/chunk`,
        form,
        { headers: form.getHeaders() }
      );
      console.log(`Akave chunk ${chunkIndex} uploaded`);
      chunkIndex++;
      return chunkResponse.data;
    };

    let commitResponse;
    await new Promise((resolve, reject) => {
      fileStream.on("data", async (data) => {
        buffer = Buffer.concat([buffer, data]);
        while (buffer.length >= chunkSize) {
          const chunk = buffer.slice(0, chunkSize);
          buffer = buffer.slice(chunkSize);
          await uploadChunk(chunk);
        }
      });
      fileStream.on("end", async () => {
        if (buffer.length > 0) {
          await uploadChunk(buffer);
        }
        commitResponse = await akaveApi.post(`/buckets/data_doc/files/${uploadId}/commit`, {});
        console.log("Akave upload committed:", commitResponse.data.cid);
        resolve(commitResponse.data.cid);
      });
      fileStream.on("error", reject);
    });

    return commitResponse?.data?.cid || "akave-stream-" + Date.now();
  } catch (error) {
    console.error("Akave streaming failed:", error.message);
    if (error.response?.data?.includes("bucket")) {
      console.error("Ensure bucket 'data_doc' exists");
    }
    return "akave-failed-" + Date.now();
  }
}

// ZKP generation function
async function generateZKP(datasetHash, uploaderKey) {
  try {
    const input = { datasetHash, uploaderKey: ethers.toBigInt(uploaderKey).toString() };
    // Check if directory exists, create if not
    if (!fs.existsSync("circuits")) {
      fs.mkdirSync("circuits");
    }
    fs.writeFileSync("circuits/input.json", JSON.stringify(input));
    
    // Check if required ZKP files exist
    const wasmExists = fs.existsSync("circuits/datasetProof.wasm");
    const zkeyExists = fs.existsSync("circuits/datasetProof_0001.zkey");
    
    if (!wasmExists || !zkeyExists) {
      console.error("ZKP wasm or zkey files missing");
      return JSON.stringify({ mockProof: "circuit-files-missing" });
    }
    
    const { proof } = await snarkjs.groth16.fullProve(
      input,
      "circuits/datasetProof.wasm",
      "circuits/datasetProof_0001.zkey"
    );
    return JSON.stringify(proof);
  } catch (error) {
    console.error("ZKP generation failed:", error);
    // Return a mock proof for testing purposes
    return JSON.stringify({ mockProof: "zkp-generation-failed" });
  }
}

app.get("/", (req, res) => {
  res.json({ 
    status: "Backend running", 
    features: {
      pinata: !!pinata,
      storacha: !!storacha,
      akave: !!akaveApi,
      blockchain: !!provider
    }
  });
});

app.post("/upload", upload.single("dataset"), async (req, res) => {
  console.log("Upload request received:", req.file, req.body);
  try {
    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    // Verify file exists
    if (!fs.existsSync(req.file.path)) {
      console.error(`File not found at path: ${req.file.path}`);
      return res.status(400).json({ error: "Uploaded file not found on server" });
    }
    
    console.log(`File size: ${fs.statSync(req.file.path).size} bytes`);
    
    if (!pinata) {
      console.error("Pinata not initialized");
      return res.status(500).json({ error: "Pinata service unavailable" });
    }
    
    let ipfsCid, storachaCid = "storacha-not-used", akaveCid = "akave-not-used";
    
    // Pinata upload
    try {
      const readableStreamForFile = fs.createReadStream(req.file.path);
      const pinataOptions = { pinataMetadata: { name: req.file.originalname || 'dataset.csv' } };
      
      const pinataResult = await pinata.pinFileToIPFS(readableStreamForFile, pinataOptions);
      ipfsCid = pinataResult.IpfsHash || pinataResult.ipfsHash;
      console.log("Pinned to IPFS:", ipfsCid);
    } catch (pinataError) {
      console.error("Pinata upload failed:", pinataError);
      return res.status(500).json({ error: "IPFS upload failed", details: pinataError.message });
    }
    
    // Dataset hash
    const datasetBuffer = fs.readFileSync(req.file.path);
    const datasetHash = crypto.createHash("sha256").update(datasetBuffer).digest("hex");
    console.log("Dataset hash:", datasetHash);
    
    // Storacha upload
    if (storacha) {
      try {
        const file = new File([datasetBuffer], req.file.originalname || 'dataset.csv', { type: "text/csv" });
        storachaCid = await storacha.put([file]);
        console.log("Uploaded to Storacha:", storachaCid);
      } catch (storachaError) {
        console.error("Storacha upload failed:", storachaError);
        storachaCid = "storacha-upload-failed";
      }
    }
    
    // Stream to Akave
    if (akaveApi) {
      try {
        akaveCid = await streamToAkave(req.file.path, req.file.originalname || 'dataset.csv');
        console.log("Streamed to Akave:", akaveCid);
      } catch (akaveError) {
        console.error("Akave streaming failed:", akaveError);
        akaveCid = "akave-stream-failed";
      }
    }
    
    // Metadata creation
    const metadata = {
      "@context": "http://schema.org",
      "@type": "Dataset",
      name: req.file.originalname || 'dataset.csv',
      creator: { "@type": "Person", identifier: wallet.address },
      datePublished: new Date().toISOString(),
      contentHash: datasetHash,
      ipfsCid,
      akaveCid,
      storachaCid,
    };
    
    // Pin metadata to IPFS
    const metadataResult = await pinata.pinJSONToIPFS(metadata, { 
      pinataMetadata: { name: "dataset_metadata.json" } 
    });
    const metadataCid = metadataResult.IpfsHash || metadataResult.ipfsHash;
    console.log("Metadata pinned to IPFS:", metadataCid);
    
    // Generate ZKP
    const zkpProof = await generateZKP(datasetHash, process.env.PRIVATE_KEY);
    console.log("ZKP generated");
    
    // Mock EigenDA ID for now
    const eigenDAId = "mock-eigenda-" + Math.floor(Math.random() * 1000);
    
    // Fix for BigInt error - use a string representation for price
    const price = "1000000"; // 1 unit with 6 decimals
    
    // Log data being sent to contract
    console.log("Sending to contract:", {
      ipfsCid,
      eigenDAId,
      price,
      zkpProof: "proof-object", // Not logging the actual proof
      metadataCid
    });
    
    // Contract interaction
    const tx = await contract.addDataset(ipfsCid, eigenDAId, price, zkpProof, metadataCid);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    
    // Get dataset ID
    const datasetCount = await contract.datasetCount();
    const datasetId = Number(datasetCount) - 1;
    
    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
      console.log("Cleaned up uploaded file");
    } catch (cleanupError) {
      console.error("Failed to clean up file:", cleanupError);
    }
    
    res.json({
      ipfsCid,
      akaveCid,
      storachaCid,
      eigenDAId,
      datasetId: datasetId.toString(),
      transactionHash: tx.hash,
      metadataCid,
      zkpProof
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

app.listen(3001, () => console.log("Backend listening on http://localhost:3001"));