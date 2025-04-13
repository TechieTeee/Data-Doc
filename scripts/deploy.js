const hre = require("hardhat");

async function main() {
  const usdcAddress = hre.network.name === "sepolia" 
    ? "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" // Sepolia USDC
    : "0x8267cF9254734C6F5B196a6b7D1c5E867bA7A17b"; // Holesky USDC
  const DataDocMarketplace = await hre.ethers.getContractFactory("DataDocMarketplace");
  const marketplace = await DataDocMarketplace.deploy(usdcAddress);
  await marketplace.deployed();
  console.log(`Deployed to ${hre.network.name}:`, marketplace.address);
}

main().catch(console.error);