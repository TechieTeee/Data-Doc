const express = require("express");
const multer = require("multer");
const pinataSDK = require("@pinata/sdk");
const { Web3Storage } = require("web3.storage");
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

// Log env vars at startup
console.log("Env vars at startup:", {
  PINATA_JWT: process.env.PINATA_JWT ? `Present (first few chars: ${process.env.PINATA_JWT.substring(0, 3)}...)` : "Missing",
  PINATA_API_KEY: process.env.PINATA_API_KEY ? `Present (first few chars: ${process.env.PINATA_API_KEY.substring(0, 3)}...)` : "Missing",
  PINATA_SECRET: process.env.PINATA_SECRET ? `Present (first few chars: ${process.env.PINATA_SECRET.substring(0, 3)}...)` : "Missing",
  STORACHA_API_KEY: process.env.STORACHA_API_KEY ? `Present (first few chars: ${process.env.STORACHA_API_KEY.substring(0, 3)}...)` : "Missing",
  AKAVE_NODE_ADDRESS: process.env.AKAVE_NODE_ADDRESS ? "Loaded" : "Missing",
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY ? "Loaded" : "Missing",
  PRIVATE_KEY: process.env.PRIVATE_KEY ? "Loaded" : "Missing",
});

app.use((req, res, next) => {
  req.headers['x-forwarded-for'] = '127.0.0.1';
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
  credentials: true
}));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Headers:", JSON.stringify(req.headers));
  next();
});

const upload = multer({ dest: "uploads/" });
let pinata, storacha;

// Initialize Pinata
try {
  console.log("Attempting Pinata initialization...");
  if (process.env.PINATA_JWT) {
    pinata = new pinataSDK({ pinataJWT: process.env.PINATA_JWT });
    console.log("Pinata SDK initialized with JWT");
  } else if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET) {
    pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);
    console.log("Pinata SDK initialized with API Key/Secret");
  } else {
    console.error("No Pinata credentials available");
  }
  if (pinata) {
    pinata.testAuthentication().then((result) => {
      console.log("Pinata authentication test:", result);
    }).catch((err) => {
      console.error("Pinata authentication test failed:", err.message);
    });
  }
} catch (error) {
  console.error("Pinata init failed:", error.message);
  pinata = null;
}

// Initialize Storacha
try {
  if (process.env.STORACHA_API_KEY) {
    storacha = new Web3Storage({ token: process.env.STORACHA_API_KEY });
    console.log("Storacha initialized");
  }
} catch (error) {
  console.error("Storacha init failed:", error.message);
  storacha = null;
}

// Initialize Akave
let akaveApi;
if (process.env.AKAVE_NODE_ADDRESS) {
  akaveApi = axios.create({
    baseURL: `http://${process.env.AKAVE_NODE_ADDRESS}`,
    timeout: 60000,
  });
  console.log("Akave API client created");
}

const provider = new ethers.JsonRpcProvider(
  process.env.ALCHEMY_API_KEY
    ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : "https://rpc.sepolia.org"
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000", provider);
const contractAddress = "0xD624121d86871E022E3674F45C43BBB30188033e";
const contractABI = [
  "function addDataset(string ipfsCid, string eigenDAId, uint256 price, string zkpProof, string metadataCid) returns (uint256)",
  "function datasetCount() view returns (uint256)",
];
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

async function streamToAkave(filePath, fileName) {
  if (!akaveApi) {
    console.log("Akave API not initialized, skipping upload");
    return "akave-not-configured";
  }
  try {
    const createResponse = await akaveApi.post("/buckets/data_doc/files/create", { fileName });
    const uploadId = createResponse.data.uploadId;
    console.log("Akave upload created:", uploadId);

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
    return "akave-failed-" + Date.now();
  }
}

async function generateZKP(datasetHash, uploaderKey) {
  try {
    const input = { datasetHash, uploaderKey: ethers.toBigInt(uploaderKey).toString() };
    if (!fs.existsSync("circuits")) {
      fs.mkdirSync("circuits");
    }
    fs.writeFileSync("circuits/input.json", JSON.stringify(input));
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
    console.error("ZKP generation failed:", error.message);
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
    if (!fs.existsSync(req.file.path)) {
      console.error(`File not found at path: ${req.file.path}`);
      return res.status(400).json({ error: "Uploaded file not found on server" });
    }
    console.log(`File size: ${fs.statSync(req.file.path).size} bytes`);

    let ipfsCid = "pinata-not-used";
    let storachaCid = "storacha-not-used";
    let akaveCid = "akave-not-used";
    let metadataCid = "metadata-not-used";

    if (pinata) {
      try {
        console.log("Pinata upload attempt with credentials:", {
          jwt: process.env.PINATA_JWT ? "Present" : "Missing",
          apiKey: process.env.PINATA_API_KEY ? "Present" : "Missing",
          secret: process.env.PINATA_SECRET ? "Present" : "Missing"
        });
        const readableStreamForFile = fs.createReadStream(req.file.path);
        const pinataOptions = { pinataMetadata: { name: req.file.originalname || 'dataset.csv' } };
        const pinataResult = await pinata.pinFileToIPFS(readableStreamForFile, pinataOptions);
        ipfsCid = pinataResult.IpfsHash || pinataResult.ipfsHash;
        console.log("Pinned to IPFS:", ipfsCid);
      } catch (pinataError) {
        console.error("Pinata upload failed:", pinataError.message);
        ipfsCid = "pinata-upload-failed";
      }
    }

    const datasetBuffer = fs.readFileSync(req.file.path);
    const datasetHash = crypto.createHash("sha256").update(datasetBuffer).digest("hex");
    console.log("Dataset hash:", datasetHash);

    if (storacha) {
      try {
        const file = new File([datasetBuffer], req.file.originalname || 'dataset.csv', { type: "text/csv" });
        storachaCid = await storacha.put([file]);
        console.log("Uploaded to Storacha:", storachaCid);
      } catch (storachaError) {
        console.error("Storacha upload failed:", storachaError.message);
        storachaCid = "storacha-upload-failed";
      }
    }

    if (akaveApi) {
      try {
        akaveCid = await streamToAkave(req.file.path, req.file.originalname || 'dataset.csv');
        console.log("Streamed to Akave:", akaveCid);
      } catch (akaveError) {
        console.error("Akave streaming failed:", akaveError.message);
        akaveCid = "akave-stream-failed";
      }
    }

    if (pinata) {
      try {
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
        const metadataResult = await pinata.pinJSONToIPFS(metadata, { 
          pinataMetadata: { name: "dataset_metadata.json" } 
        });
        metadataCid = metadataResult.IpfsHash || metadataResult.ipfsHash;
        console.log("Metadata pinned to IPFS:", metadataCid);
      } catch (metadataError) {
        console.error("Metadata upload failed:", metadataError.message);
        metadataCid = "metadata-upload-failed";
      }
    }

    const zkpProof = await generateZKP(datasetHash, process.env.PRIVATE_KEY || "0x0");
    console.log("ZKP generated:", zkpProof);

    const eigenDAId = "mock-eigenda-" + Math.floor(Math.random() * 1000);
    const price = "1000000";

    let tx;
    try {
      console.log("Sending to contract:", { ipfsCid, eigenDAId, price, zkpProof: "proof-object", metadataCid });
      tx = await contract.addDataset(ipfsCid, eigenDAId, price, zkpProof, metadataCid);
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Transaction confirmed");
    } catch (contractError) {
      console.error("Contract interaction failed:", contractError.message);
    }

    const datasetCount = await contract.datasetCount().catch(() => 0);
    const datasetId = Number(datasetCount) - 1;

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
      transactionHash: tx?.hash || "none",
      metadataCid,
      zkpProof
    });
  } catch (error) {
    console.error("Upload error:", error.message);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

app.listen(3001, () => console.log("Backend listening on http://localhost:3001"));