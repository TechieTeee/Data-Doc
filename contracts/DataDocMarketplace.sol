// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract DataDocMarketplace {
    IERC20 public usdc = IERC20(0x9999f7fEA5938fD3b1E26A12c3f2D98ECdaB2007); // Mumbai USDC
    address public feeCollector;
    uint256 public feePercentage = 10;

    struct Dataset {
        string ipfsCid;
        string eigenDAId;
        address contributor;
        uint256 price; // USDC in 6 decimals
        bool validated;
    }

    mapping(uint256 => Dataset) public datasets;
    uint256 public datasetCount;

    event DatasetAdded(uint256 id, string ipfsCid, string eigenDAId, address contributor);
    event DatasetForked(uint256 id, address forker, uint256 amount);

    constructor() {
        feeCollector = msg.sender;
    }

    function addDataset(string memory ipfsCid, string memory eigenDAId, uint256 price) external {
        datasets[datasetCount] = Dataset(ipfsCid, eigenDAId, msg.sender, price, true); // Mock validation
        emit DatasetAdded(datasetCount, ipfsCid, eigenDAId, msg.sender);
        datasetCount++;
    }

    function forkDataset(uint256 datasetId) external {
        require(datasetId < datasetCount, "Invalid ID");
        Dataset storage dataset = datasets[datasetId];
        require(dataset.validated, "Not validated");
        uint256 fee = (dataset.price * feePercentage) / 100;
        uint256 contributorPayment = dataset.price - fee;

        usdc.transferFrom(msg.sender, feeCollector, fee);
        usdc.transferFrom(msg.sender, dataset.contributor, contributorPayment);
        emit DatasetForked(datasetId, msg.sender, dataset.price);
    }
}