const express = require("express");
const multer = require("multer");
const pinataSDK = require("@pinata/sdk");
const { Web3Storage } = require("@web3-storage/w3");
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
  pinata: process.env.PINATA_JWT ? "Loaded" : "Missing",
  akave: process.env.AKAVE_NODE_ADDRESS ? "Loaded" : "Missing",
  storacha: process.env.STORACHA_API_KEY ? "Loaded" : "Missing",
});

app.use(cors({
  origin: ["https://3000-techieteee-datadoc-0jtulr7q8pd.ws-us118.gitpod.io", "http://localhost:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const upload = multer({ dest: "uploads/" });
let pinata, storacha;
try {
  pinata = new pinataSDK({ pinataJWT: process.env.PINATA_JWT });
  console.log("Pinata SDK initialized");
} catch (error) {
  console.error("Pinata init failed:", error);
}
try {
  storacha = new Web3Storage({ token: process.env.STORACHA_API_KEY });
  console.log("Storacha initialized");
} catch (error) {
  console.error("Storacha init failed:", error);
}

const akaveApi = axios.create({
  baseURL: `http://${process.env.AKAVE_NODE_ADDRESS}`,
  timeout: 60000,
});

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

async function streamToAkave(filePath, fileName) {
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
        const commitResponse = await akaveApi.post(`/buckets/data_doc/files/${uploadId}/commit`, {});
        console.log("Akave upload committed:", commitResponse.data.cid);
        resolve(commitResponse.data.cid);
      });
      fileStream.on("error", reject);
    });

    return commitResponse.data.cid || "akave-stream-" + Date.now();
  } catch (error) {
    console.error("Akave streaming failed:", error.message);
    if (error.response?.data?.includes("bucket")) {
      console.error("Ensure bucket 'data_doc' exists");
    }
    return "akave-failed-" + Date.now();
  }
}

async function generateZKP(datasetHash, uploaderKey) {
  const input = { datasetHash, uploaderKey: ethers.toBigInt(uploaderKey).toString() };
  fs.writeFileSync("circuits/input.json", JSON.stringify(input));
  try {
    const { proof } = await snarkjs.groth16.fullProve(
      input,
      "circuits/datasetProof.wasm",
      "circuits/datasetProof_0001.zkey"
    );
    return JSON.stringify(proof);
  } catch (error) {
    console.error("ZKP generation failed:", error);
    return "";
  }
}

app.get("/", (req, res) => {
  res.json({ status: "Backend running", env: process.env.PRIVATE_KEY ? "Key loaded" : "Missing" });
});

app.post("/upload", upload.single("dataset"), async (req, res) => {
  console.log("Upload request received:", req.file, req.body);
  try {
    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }
    if (!pinata || !storacha) {
      console.error("Storage services not initialized");
      return res.status(500).json({ error: "Storage services unavailable" });
    }

    // Pinata upload
    const readableStream = fs.createReadStream(req.file.path);
    const options = { pinataMetadata: { name: req.file.originalname } };
    const pinataResult = await pinata.pinFileToIPFS(readableStream, options);
    const ipfsCid = pinataResult.IpfsHash;
    console.log("Pinned to Pinata/IPFS:", ipfsCid);

    // Stream to Akave
    const akaveCid = await streamToAkave(req.file.path, req.file.originalname);

    // Storacha upload
    const file = new File([fs.readFileSync(req.file.path)], req.file.originalname, { type: "text/csv" });
    const storachaCid = await storacha.put([file]);
    console.log("Uploaded to Storacha:", storachaCid);

    // Dataset hash
    const datasetBuffer = fs.readFileSync(req.file.path);
    const datasetHash = crypto.createHash("sha256").update(datasetBuffer).digest("hex");

    // Croissant-like metadata
    const metadata = {
      "@context": "http://schema.org",
      "@type": "Dataset",
      name: req.file.originalname,
      creator: { "@type": "Person", identifier: wallet.address },
      datePublished: new Date().toISOString(),
      contentHash: datasetHash,
      ipfsCid,
      akaveCid,
      storachaCid,
    };
    const metadataCid = await pinata.pinJSONToIPFS(metadata, { pinataMetadata: { name: "dataset_metadata.json" } });
    console.log("Metadata pinned to Pinata:", metadataCid.IpfsHash);

    // Generate ZKP
    const zkpProof = await generateZKP(datasetHash, process.env.PRIVATE_KEY);

    // Contract interaction
    const eigenDAId = "mock-eigenda-" + Math.floor(Math.random() * 1000);
    const price = "1000000";
    console.log("Sending to contract:", { ipfsCid, eigenDAId, price, zkpProof, metadataCid: metadataCid.IpfsHash });
    const tx = await contract.addDataset(ipfsCid, eigenDAId, price, zkpProof, metadataCid.IpfsHash);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);

    const datasetCount = await contract.datasetCount();
    const datasetId = Number(datasetCount) - 1;

    res.json({
      ipfsCid,
      akaveCid,
      storachaCid,
      eigenDAId,
      datasetId: datasetId.toString(),
      transactionHash: tx.hash,
      metadataCid: metadataCid.IpfsHash,
      zkpProof,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

app.listen(3001, () => console.log("Backend listening on http://localhost:3001"));