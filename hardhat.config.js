require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY",
      accounts: [process.env.PRIVATE_KEY],
    },
    holesky: {
      url: "https://eth-holesky.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};