const express = require("express");
const multer = require("multer");
const PinataSDK = require("@pinata/sdk");
const ethers = require("ethers");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });
const pinata = new PinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);
const provider = new ethers.providers.JsonRpcProvider("https://rpc-mumbai.maticvigil.com");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  "YOUR_CONTRACT_ADDRESS",
  ["function addDataset(string ipfsCid, string eigenDAId, uint256 price)"],
  wallet
);

app.post("/upload", upload.single("dataset"), async (req, res) => {
  // IPFS upload
  const { IpfsHash } = await pinata.pinFileToIPFS(req.file.path);
  // Mock EigenDA (replace with real call later)
  const eigenDAId = "mock-eigenda-id";
  // Set price (1 USDC = 1e6)
  const price = ethers.utils.parseUnits("1", 6);
  const tx = await contract.addDataset(IpfsHash, eigenDAId, price);
  await tx.wait();
  res.json({ ipfsCid: IpfsHash, eigenDAId, datasetId: (await contract.datasetCount()) - 1 });
});

app.listen(3001, () => console.log("Backend on 3001"));