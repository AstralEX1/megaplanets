// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { MegaPlanets } from "../src/MegaPlanets.sol";
import { MintVoucherLib } from "../src/libraries/MintVoucherLib.sol";
import { MockJackpotTicketNFT } from "./mocks/MockJackpotTicketNFT.sol";

contract MegaPlanetsHandler is Test, IERC721Receiver {
    uint256 internal constant SIGNER_KEY = 0xA11CE;
    MegaPlanets internal immutable planets;
    MockJackpotTicketNFT internal immutable tickets;
    uint256[] internal mintedTicketIds;

    constructor(MegaPlanets planets_, MockJackpotTicketNFT tickets_) {
        planets = planets_;
        tickets = tickets_;
    }

    function mintValid(uint256 rawTicketId) external {
        uint256 ticketId = bound(rawTicketId, 1, type(uint128).max);
        if (planets.planetMinted(ticketId)) return;
        MintVoucherLib.MintVoucher memory voucher = MintVoucherLib.MintVoucher({
            recipient: address(this),
            ticketId: ticketId,
            seasonId: planets.seasonId(),
            drawingId: 1,
            originTxHash: keccak256("origin"),
            seed: keccak256("seed"),
            traitsHash: keccak256("traits"),
            metadataHash: keccak256(bytes("ipfs://invariant")),
            metadataURI: "ipfs://invariant",
            expiresAt: block.timestamp + 1 days
        });
        tickets.mint(address(this), ticketId);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, planets.hashVoucher(voucher));
        planets.mint(voucher, abi.encodePacked(r, s, v));
        mintedTicketIds.push(ticketId);
    }

    function mintedCount() external view returns (uint256) {
        return mintedTicketIds.length;
    }

    function mintedTicketIdAt(uint256 index) external view returns (uint256) {
        return mintedTicketIds[index];
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract MegaPlanetsInvariantTest is Test {
    MegaPlanets internal planets;
    MegaPlanetsHandler internal handler;

    function setUp() external {
        MockJackpotTicketNFT tickets = new MockJackpotTicketNFT();
        planets = new MegaPlanets(address(this), vm.addr(0xA11CE), address(tickets));
        handler = new MegaPlanetsHandler(planets, tickets);
        targetContract(address(handler));
    }

    function invariant_EachMintedTicketHasOneSequentialPlanetWithPreservedProvenance() external view {
        uint256 count = handler.mintedCount();
        for (uint256 i; i < count; ++i) {
            uint256 ticketId = handler.mintedTicketIdAt(i);
            assertTrue(planets.planetMinted(ticketId));
            uint256 tokenId = planets.planetTokenIdByTicketId(ticketId);
            assertGt(tokenId, 0);
            assertEq(planets.ticketIdByPlanetTokenId(tokenId), ticketId);
            assertEq(planets.ownerOf(tokenId), address(handler));
            assertEq(planets.tokenURI(tokenId), "ipfs://invariant");
        }
    }
}
