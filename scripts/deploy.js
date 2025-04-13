const hre = require("hardhat");

async function main() {
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
  const DataDocMarketplace = await hre.ethers.getContractFactory("DataDocMarketplace");
  const marketplace = await DataDocMarketplace.deploy(usdcAddress);
  console.log("Deployed to Sepolia:", marketplace.address);
}

main().catch(console.error);