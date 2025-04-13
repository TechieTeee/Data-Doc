const hre = require("hardhat");

async function main() {
  const DataDocMarketplace = await hre.ethers.getContractFactory("DataDocMarketplace");
  const marketplace = await DataDocMarketplace.deploy();
  await marketplace.deployed();
  console.log("Deployed to:", marketplace.address);
}

main().catch(console.error);