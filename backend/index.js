const express = require("express");
const multer = require("multer");
const PinataSDK = require("@pinata/sdk");
const ethers = require("ethers");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });
const pinata = new PinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);
const provider = new ethers.providers.JsonRpcProvider(
  `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = "YOUR_SEPOLIA_CONTRACT_ADDRESS";
const contractABI = [
  "function addDataset(string ipfsCid, string eigenDAId, uint256 price)",
  "function datasetCount() view returns (uint256)"
];
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

app.post("/upload", upload.single("dataset"), async (req, res) => {
  try {
    const { IpfsHash } = await pinata.pinFileToIPFS(req.file.path, {
      pinataMetadata: { name: req.file.originalname }
    });
    const storachaCid = "mock-storacha-" + Date.now();
    const eigenDAId = "mock-eigenda-" + Math.floor(Math.random() * 1000);
    const price = ethers.utils.parseUnits("1", 6);
    const tx = await contract.addDataset(IpfsHash, eigenDAId, price);
    await tx.wait();
    const datasetId = (await contract.datasetCount()) - 1;
    res.json({ ipfsCid: IpfsHash, storachaCid, eigenDAId, datasetId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.listen(3001, () => console.log("Backend on http://localhost:3001"));