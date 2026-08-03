// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";
import { MegaPlanets } from "../src/MegaPlanets.sol";

/// @notice Stage 4 preparation only. Do not pass --broadcast until Stage 6 authorizes deployment.
contract DeployMegaPlanets is Script {
    address internal constant BASE_SEPOLIA_JACKPOT_TICKET_NFT =
        0x45084829ac63f9dC6a3D4981A46FA896f9180ECd;

    function run() external returns (MegaPlanets deployed) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address initialOwner = vm.envOr("MEGAPLANETS_OWNER", deployer);
        address signer = vm.envAddress("MEGAPLANETS_METADATA_SIGNER");
        address ticketNft = vm.envOr("JACKPOT_TICKET_NFT", BASE_SEPOLIA_JACKPOT_TICKET_NFT);

        vm.startBroadcast(deployerKey);
        deployed = new MegaPlanets(initialOwner, signer, ticketNft);
        vm.stopBroadcast();
    }
}
