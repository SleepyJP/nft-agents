// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IAgentNFTStarter {
    function mintStarter(uint8 starterChoice) external;
    function mintStarterFor(address to, uint8 starterChoice) external;
    function hasClaimedStarter(address user) external view returns (bool);
}

/**
 * @title StarterPack
 * @notice Free starter agent mint for new users
 * @dev One per wallet. User pays only gas. Choose from 3 starter agents.
 *      0 = Embertrade (FIRE), 1 = Aquascan (WATER), 2 = Voltbot (ELECTRIC)
 */
contract StarterPack is Ownable, ReentrancyGuard, Pausable {
    // ---------------------------------------------------------------
    // STATE
    // ---------------------------------------------------------------

    IAgentNFTStarter public agentNFT;

    uint256 public totalClaimed;
    uint256 public maxStarters = 5000; // Cap on free starters

    // Track which starter each address chose (for analytics)
    mapping(address => uint8) public chosenStarter;

    // Per-starter-type counts
    uint256[3] public starterCounts;

    // ---------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------

    event StarterClaimed(address indexed user, uint8 starterChoice, uint256 totalClaimed);

    // ---------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------

    constructor(address _agentNFT) Ownable(msg.sender) {
        require(_agentNFT != address(0), "Invalid address");
        agentNFT = IAgentNFTStarter(_agentNFT);
    }

    // ---------------------------------------------------------------
    // CLAIM
    // ---------------------------------------------------------------

    function claimStarter(uint8 starterChoice) external nonReentrant whenNotPaused {
        require(starterChoice < 3, "Invalid choice: 0=Embertrade, 1=Aquascan, 2=Voltbot");
        require(!agentNFT.hasClaimedStarter(msg.sender), "Already claimed");
        require(totalClaimed < maxStarters, "All starters claimed");

        totalClaimed++;
        starterCounts[starterChoice]++;
        chosenStarter[msg.sender] = starterChoice;

        // Delegate to AgentNFT — mint directly to user (not this contract)
        agentNFT.mintStarterFor(msg.sender, starterChoice);

        emit StarterClaimed(msg.sender, starterChoice, totalClaimed);
    }

    // ---------------------------------------------------------------
    // READ
    // ---------------------------------------------------------------

    function getStarterCounts() external view returns (uint256[3] memory) {
        return starterCounts;
    }

    function canClaim(address user) external view returns (bool) {
        return !agentNFT.hasClaimedStarter(user) && totalClaimed < maxStarters;
    }

    // ---------------------------------------------------------------
    // OWNER SETTERS — PAISLEY RULE
    // ---------------------------------------------------------------

    function setAgentNFT(address _addr) external onlyOwner { agentNFT = IAgentNFTStarter(_addr); }
    function setMaxStarters(uint256 _max) external onlyOwner { maxStarters = _max; }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function rescueETH(address to) external onlyOwner {
        (bool sent, ) = to.call{value: address(this).balance}("");
        require(sent, "Rescue failed");
    }
}
