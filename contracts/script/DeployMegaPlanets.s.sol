// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { MegaPlanets } from "../src/MegaPlanets.sol";

/// @notice Deploys the ERC721A V2 collection. Do not pass --broadcast without explicit approval.
contract DeployMegaPlanets is Script {
    address internal constant BASE_SEPOLIA_JACKPOT_TICKET_NFT =
        0x45084829ac63f9dC6a3D4981A46FA896f9180ECd;
    address internal constant APPROVED_DEPLOYER = 0xCfc1044C749fD40E07FE33938414Fa573993F857;
    address internal constant APPROVED_METADATA_SIGNER = 0xCfc1044C749fD40E07FE33938414Fa573993F857;

    function run() external returns (MegaPlanets deployed) {
        bool simulation = vm.envOr("MEGAPLANETS_SIMULATION", false);
        uint256 deployerKey;
        address deployer;
        if (simulation) {
            deployer = vm.envOr("MEGAPLANETS_DEPLOYER", APPROVED_DEPLOYER);
            vm.startBroadcast(deployer);
        } else {
            deployerKey = vm.envUint("PRIVATE_KEY");
            deployer = vm.addr(deployerKey);
            vm.startBroadcast(deployerKey);
        }
        require(deployer == APPROVED_DEPLOYER, "deployer does not match approved address");
        address initialOwner = vm.envOr("MEGAPLANETS_OWNER", deployer);
        address signer = vm.envOr("MEGAPLANETS_METADATA_SIGNER", APPROVED_METADATA_SIGNER);
        address ticketNft = vm.envOr("JACKPOT_TICKET_NFT", BASE_SEPOLIA_JACKPOT_TICKET_NFT);

        console2.log("deployer", deployer);
        console2.log("initialOwner", initialOwner);
        console2.log("metadataSigner", signer);
        console2.log("jackpotTicketNFT", ticketNft);
        deployed = new MegaPlanets(initialOwner, signer, ticketNft);
        console2.log("predictedDeployment", address(deployed));
        vm.stopBroadcast();
    }
}
