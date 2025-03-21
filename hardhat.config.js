require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    mumbai: { ... },
    holesky: {
      url: "https://rpc.holesky.ethpandaops.io",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};