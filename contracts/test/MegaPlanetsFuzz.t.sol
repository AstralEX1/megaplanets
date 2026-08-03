// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MegaPlanets } from "../src/MegaPlanets.sol";
import { MintVoucherLib } from "../src/libraries/MintVoucherLib.sol";
import { MockJackpotTicketNFT } from "./mocks/MockJackpotTicketNFT.sol";

contract MegaPlanetsFuzzTest is Test {
    uint256 internal constant SIGNER_KEY = 0xA11CE;
    address internal signer = vm.addr(SIGNER_KEY);
    MegaPlanets internal planets;
    MockJackpotTicketNFT internal tickets;

    function setUp() external {
        tickets = new MockJackpotTicketNFT();
        planets = new MegaPlanets(address(this), signer, address(tickets));
    }

    function testFuzz_NormalMintAlwaysUsesTicketId(uint256 rawTicketId, uint256 userKey) external {
        uint256 ticketId = bound(rawTicketId, 1, planets.SPECIAL_TOKEN_PREFIX() - 1);
        address recipient = vm.addr(bound(userKey, 1, type(uint128).max));
        MintVoucherLib.MintVoucher memory voucher = _voucher(recipient, ticketId, "ipfs://fuzz");
        tickets.mint(recipient, ticketId);
        bytes memory signature = _signature(voucher);

        vm.prank(recipient);
        planets.mint(voucher, signature);

        assertEq(planets.ownerOf(ticketId), recipient);
        assertTrue(planets.planetMinted(ticketId));
    }

    function testFuzz_InvalidBatchIsAtomic(uint256 firstId, uint256 secondId) external {
        firstId = bound(firstId, 1, planets.SPECIAL_TOKEN_PREFIX() - 2);
        secondId = bound(secondId, firstId + 1, planets.SPECIAL_TOKEN_PREFIX() - 1);
        address recipient = makeAddr("recipient");
        MintVoucherLib.MintVoucher[] memory vouchers = new MintVoucherLib.MintVoucher[](2);
        bytes[] memory signatures = new bytes[](2);
        vouchers[0] = _voucher(recipient, firstId, "ipfs://valid");
        vouchers[1] = _voucher(recipient, secondId, "ipfs://invalid");
        vouchers[1].metadataHash = bytes32(uint256(1));
        tickets.mint(recipient, firstId);
        tickets.mint(recipient, secondId);
        signatures[0] = _signature(vouchers[0]);
        signatures[1] = _signature(vouchers[1]);

        vm.prank(recipient);
        vm.expectRevert();
        planets.mintBatch(vouchers, signatures);

        assertFalse(planets.planetMinted(firstId));
        assertFalse(planets.planetMinted(secondId));
    }

    function _voucher(address recipient, uint256 ticketId, string memory uri)
        internal
        view
        returns (MintVoucherLib.MintVoucher memory)
    {
        return MintVoucherLib.MintVoucher({
            recipient: recipient,
            ticketId: ticketId,
            seasonId: planets.seasonId(),
            drawingId: 1,
            originTxHash: keccak256("origin"),
            seed: keccak256("seed"),
            traitsHash: keccak256("traits"),
            metadataHash: keccak256(bytes(uri)),
            metadataURI: uri,
            expiresAt: block.timestamp + 1
        });
    }

    function _signature(MintVoucherLib.MintVoucher memory voucher)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, planets.hashVoucher(voucher));
        return abi.encodePacked(r, s, v);
    }
}
