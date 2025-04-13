// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract DataDocMarketplace {
    IERC20 public usdc; // No initialization
    address public feeCollector;
    uint256 public feePercentage = 10;

    struct Dataset {
        string ipfsCid;
        string eigenDAId;
        address contributor;
        uint256 price;
        bool validated;
    }

    mapping(uint256 => Dataset) public datasets;
    uint256 public datasetCount;

    event DatasetAdded(uint256 id, string ipfsCid, string eigenDAId, address contributor);
    event DatasetForked(uint256 id, address forker, uint256 amount);

    constructor(address usdcAddress) {
        feeCollector = msg.sender;
        usdc = IERC20(usdcAddress);
    }

    function addDataset(string memory ipfsCid, string memory eigenDAId, uint256 price) external {
        datasets[datasetCount] = Dataset(ipfsCid, eigenDAId, msg.sender, price, true);
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