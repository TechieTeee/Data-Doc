const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pinataSDK = require("@pinata/sdk");
const fs = require("fs");
const { Readable } = require("stream");
const crypto = require("crypto");
require("dotenv").config({ path: "/workspace/Data-Doc/.env" });

const app = express();
const port = 3001;

console.log("Env vars at startup:", {
  PINATA_API_KEY: process.env.PINATA_API_KEY ? `Present (first few chars: ${process.env.PINATA_API_KEY.substring(0, 3)}...)` : "Missing",
  PINATA_SECRET: process.env.PINATA_SECRET ? `Present (first few chars: ${process.env.PINATA_SECRET.substring(0, 3)}...)` : "Missing"
});

// CORS Configuration
app.use(cors({
  origin: [
    "https://3000-techieteee-datadoc-0jtulr7q8pd.ws-us118.gitpod.io",
    "https://3001-techieteee-datadoc-0jtulr7q8pd.ws-us118.gitpod.io",
    "http://localhost:3000",
    "http://localhost:3001",
    "*"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Gitpod-Workspace-Auth"],
  credentials: true
}));
app.options("*", cors());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  next();
});

// Multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Initialize Pinata
let pinata;
try {
  if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET) {
    pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);
    console.log("Pinata SDK initialized");
    pinata.testAuthentication()
      .then((result) => console.log("Pinata authentication test:", result))
      .catch((err) => console.error("Pinata authentication test failed:", err.message));
  } else {
    console.log("Pinata credentials missing, skipping Pinata");
  }
} catch (error) {
  console.error("Pinata init failed:", error.message);
  pinata = null;
}

// Health endpoint
app.get("/health", async (req, res) => {
  const health = {
    server: "running",
    pinata: pinata ? "initialized" : "not initialized"
  };
  if (pinata) {
    try {
      await pinata.testAuthentication();
      health.pinata = "connected";
    } catch (error) {
      health.pinata = `error: ${error.message}`;
    }
  }
  res.json(health);
});

// Upload endpoint
app.post("/upload", upload.single("dataset"), async (req, res) => {
  console.log("Upload request received:", req.file);
  try {
    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }
    if (!fs.existsSync(req.file.path)) {
      console.error(`File not found: ${req.file.path}`);
      return res.status(400).json({ error: "Uploaded file not found" });
    }
    console.log(`File size: ${fs.statSync(req.file.path).size} bytes`);

    let ipfsCid = "pinata-not-used";
    let storachaCid = "mock-storacha-" + Date.now();
    let akaveCid = "mock-akave-" + Date.now();
    let metadataCid = "metadata-not-used";

    // Pinata upload
    if (pinata) {
      try {
        console.log("Uploading to Pinata...");
        const fileStream = fs.createReadStream(req.file.path);
        const pinataOptions = { pinataMetadata: { name: req.file.originalname || "dataset.csv" } };
        const pinataResult = await pinata.pinFileToIPFS(fileStream, pinataOptions);
        ipfsCid = pinataResult.IpfsHash;
        console.log("Pinned to IPFS:", ipfsCid);
      } catch (pinataError) {
        console.error("Pinata upload failed:", pinataError.message);
        ipfsCid = "pinata-failed-" + Date.now();
      }
    }

    // Dataset hash
    const datasetBuffer = fs.readFileSync(req.file.path);
    const datasetHash = crypto.createHash("sha256").update(datasetBuffer).digest("hex");
    console.log("Dataset hash:", datasetHash);

    // Metadata upload
    if (pinata) {
      try {
        const metadata = {
          "@context": "http://schema.org",
          "@type": "Dataset",
          name: req.file.originalname || "dataset.csv",
          creator: { "@type": "Person", identifier: "0xmock" },
          datePublished: new Date().toISOString(),
          contentHash: datasetHash,
          ipfsCid,
          akaveCid,
          storachaCid
        };
        const metadataStream = Readable.from(JSON.stringify(metadata));
        const metadataResult = await pinata.pinFileToIPFS(metadataStream, {
          pinataMetadata: { name: "dataset_metadata.json" }
        });
        metadataCid = metadataResult.IpfsHash;
        console.log("Metadata pinned:", metadataCid);
      } catch (metadataError) {
        console.error("Metadata upload failed:", metadataError.message);
        metadataCid = "metadata-failed-" + Date.now();
      }
    }

    // Mock EigenDA, dataset ID, ZKP, blockchain
    const eigenDAId = "mock-eigenda-" + Math.floor(Math.random() * 1000);
    const datasetId = Math.floor(Math.random() * 1000).toString();
    const transactionHash = "none";
    const zkpProof = JSON.stringify({ mockProof: "zkp-mocked" });

    // Clean up
    try {
      fs.unlinkSync(req.file.path);
      console.log("Cleaned up file");
    } catch (cleanupError) {
      console.error("Cleanup failed:", cleanupError.message);
    }

    res.json({
      ipfsCid,
      storachaCid,
      akaveCid,
      eigenDAId,
      datasetId,
      transactionHash,
      metadataCid,
      zkpProof
    });
  } catch (error) {
    console.error("Upload error:", error.message);
    res.status(500).json({
      error: "Upload failed",
      details: error.message || "Unknown error"
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});