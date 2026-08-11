// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MegaPlanets } from "../src/MegaPlanets.sol";
import { MintVoucherV2Lib } from "../src/libraries/MintVoucherV2Lib.sol";
import { MockJackpotTicketNFT } from "./mocks/MockJackpotTicketNFT.sol";

contract MegaPlanetsTest is Test {
    uint256 internal constant SIGNER_KEY = 0xA11CE;
    address internal signer = vm.addr(SIGNER_KEY);
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    MegaPlanets internal planets;
    MockJackpotTicketNFT internal tickets;

    function setUp() external {
        tickets = new MockJackpotTicketNFT();
        planets = new MegaPlanets(owner, signer, address(tickets));
    }

    function testMintMintsFreePlanetWithSequentialIdAndTicketProvenance() external {
        MintVoucherV2Lib.MintVoucher memory voucher = _voucher(alice, 101, "ipfs://planet-101");
        tickets.mint(alice, voucher.ticketId);
        bytes memory signature = _signature(voucher);

        vm.prank(alice);
        planets.mint(voucher, signature);

        assertEq(planets.ownerOf(1), alice);
        assertEq(planets.tokenURI(1), "ipfs://planet-101");
        assertTrue(planets.planetMinted(101));
        assertEq(planets.planetTokenIdByTicketId(101), 1);
        assertEq(planets.ticketIdByPlanetTokenId(1), 101);
        assertEq(address(planets).balance, 0);
    }

    function testMintBatchMintsEveryVoucherAtomically() external {
        MintVoucherV2Lib.MintVoucher[] memory vouchers = new MintVoucherV2Lib.MintVoucher[](2);
        bytes[] memory signatures = new bytes[](2);
        vouchers[0] = _voucher(alice, 201, "ipfs://planet-201");
        vouchers[1] = _voucher(alice, 202, "ipfs://planet-202");
        tickets.mint(alice, 201);
        tickets.mint(alice, 202);
        signatures[0] = _signature(vouchers[0]);
        signatures[1] = _signature(vouchers[1]);

        vm.prank(alice);
        planets.mintBatch(vouchers, signatures);

        assertEq(planets.ownerOf(1), alice);
        assertEq(planets.ownerOf(2), alice);
        assertEq(planets.planetTokenIdByTicketId(201), 1);
        assertEq(planets.planetTokenIdByTicketId(202), 2);
    }

    function testMintAfterBatchUsesTheNextSequentialPlanetId() external {
        MintVoucherV2Lib.MintVoucher[] memory vouchers = new MintVoucherV2Lib.MintVoucher[](2);
        bytes[] memory signatures = new bytes[](2);
        vouchers[0] = _voucher(alice, 203, "ipfs://planet-203");
        vouchers[1] = _voucher(alice, 204, "ipfs://planet-204");
        tickets.mint(alice, 203);
        tickets.mint(alice, 204);
        signatures[0] = _signature(vouchers[0]);
        signatures[1] = _signature(vouchers[1]);
        vm.prank(alice);
        planets.mintBatch(vouchers, signatures);

        MintVoucherV2Lib.MintVoucher memory nextVoucher = _voucher(alice, 205, "ipfs://planet-205");
        tickets.mint(alice, 205);
        bytes memory nextSignature = _signature(nextVoucher);
        vm.prank(alice);
        planets.mint(nextVoucher, nextSignature);

        assertEq(planets.planetTokenIdByTicketId(203), 1);
        assertEq(planets.planetTokenIdByTicketId(204), 2);
        assertEq(planets.planetTokenIdByTicketId(205), 3);
        assertEq(planets.ticketIdByPlanetTokenId(3), 205);
    }

    function testMintRejectsEth() external {
        MintVoucherV2Lib.MintVoucher memory voucher = _voucher(alice, 102, "ipfs://planet-102");
        tickets.mint(alice, 102);
        vm.deal(alice, 1 ether);
        bytes memory signature = _signature(voucher);
        vm.prank(alice);
        (bool success,) = address(planets).call{ value: 1 }(
            abi.encodeCall(MegaPlanets.mint, (voucher, signature))
        );
        assertFalse(success);
    }

    function testMintRejectsWrongSignerAndExpiredVoucher() external {
        MintVoucherV2Lib.MintVoucher memory voucher = _voucher(alice, 103, "ipfs://planet-103");
        tickets.mint(alice, 103);
        bytes memory invalidSignature = _signatureWith(0xB0B, voucher);
        vm.prank(alice);
        vm.expectRevert();
        planets.mint(voucher, invalidSignature);

        voucher = _voucher(alice, 104, "ipfs://planet-104");
        voucher.expiresAt = block.timestamp - 1;
        tickets.mint(alice, 104);
        bytes memory expiredSignature = _signature(voucher);
        vm.prank(alice);
        vm.expectRevert();
        planets.mint(voucher, expiredSignature);
    }

    function testMintRejectsRecipientAndMetadataTampering() external {
        MintVoucherV2Lib.MintVoucher memory voucher = _voucher(alice, 105, "ipfs://planet-105");
        tickets.mint(alice, 105);
        bytes memory signature = _signature(voucher);
        vm.prank(bob);
        vm.expectRevert();
        planets.mint(voucher, signature);

        voucher = _voucher(alice, 107, "ipfs://planet-107");
        voucher.metadataHash = bytes32(uint256(1));
        tickets.mint(alice, 107);
        signature = _signature(voucher);
        vm.prank(alice);
        vm.expectRevert();
        planets.mint(voucher, signature);
    }

    function testUsesEip712VersionTwoAndSeasonlessVoucherType() external {
        MintVoucherV2Lib.MintVoucher memory voucher = _voucher(alice, 113, "ipfs://planet-113");
        bytes32 digest = planets.hashVoucher(voucher);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, digest);
        vm.startPrank(alice);
        tickets.mint(alice, 113);
        planets.mint(voucher, abi.encodePacked(r, s, v));
        vm.stopPrank();

        assertEq(planets.totalSupply(), 1);
        assertEq(planets.ticketIdByPlanetTokenId(1), 113);
    }

    function testMintRejectsUsedNonOwnerAndBurnedTickets() external {
        MintVoucherV2Lib.MintVoucher memory voucher = _voucher(alice, 108, "ipfs://planet-108");
        tickets.mint(alice, 108);
        bytes memory signature = _signature(voucher);
        vm.prank(alice);
        planets.mint(voucher, signature);
        vm.prank(alice);
        vm.expectRevert();
        planets.mint(voucher, signature);

        voucher = _voucher(alice, 109, "ipfs://planet-109");
        tickets.mint(bob, 109);
        signature = _signature(voucher);
        vm.prank(alice);
        vm.expectRevert();
        planets.mint(voucher, signature);

        voucher = _voucher(alice, 110, "ipfs://planet-110");
        tickets.mint(alice, 110);
        tickets.burn(110);
        signature = _signature(voucher);
        vm.prank(alice);
        vm.expectRevert();
        planets.mint(voucher, signature);
    }

    function testBatchRejectsDuplicatesAndLeavesAllTicketsUnminted() external {
        MintVoucherV2Lib.MintVoucher[] memory vouchers = new MintVoucherV2Lib.MintVoucher[](2);
        bytes[] memory signatures = new bytes[](2);
        vouchers[0] = _voucher(alice, 111, "ipfs://planet-111");
        vouchers[1] = _voucher(alice, 111, "ipfs://planet-111-b");
        tickets.mint(alice, 111);
        signatures[0] = _signature(vouchers[0]);
        signatures[1] = _signature(vouchers[1]);
        vm.prank(alice);
        vm.expectRevert();
        planets.mintBatch(vouchers, signatures);
        assertFalse(planets.planetMinted(111));
    }

    function testTicketTransferBeforeMintUsesCurrentOwner() external {
        MintVoucherV2Lib.MintVoucher memory voucher = _voucher(bob, 112, "ipfs://planet-112");
        tickets.mint(alice, 112);
        vm.prank(alice);
        tickets.transferFrom(alice, bob, 112);
        bytes memory signature = _signature(voucher);
        vm.prank(bob);
        planets.mint(voucher, signature);
        assertEq(planets.ownerOf(1), bob);
        assertEq(planets.ticketIdByPlanetTokenId(1), 112);
    }

    function testMetadataSignerAndOwnershipControls() external {
        vm.prank(owner);
        planets.setMetadataSigner(bob);
        assertEq(planets.metadataSigner(), bob);
        vm.prank(owner);
        planets.transferOwnership(alice);
        assertEq(planets.owner(), alice);
    }

    function _voucher(address recipient, uint256 ticketId, string memory uri)
        internal
        view
        returns (MintVoucherV2Lib.MintVoucher memory)
    {
        return MintVoucherV2Lib.MintVoucher({
            recipient: recipient,
            ticketId: ticketId,
            drawingId: 12,
            originTxHash: keccak256("origin"),
            seed: keccak256("seed"),
            traitsHash: keccak256("traits"),
            metadataHash: keccak256(bytes(uri)),
            metadataURI: uri,
            expiresAt: block.timestamp + 1 days
        });
    }

    function _signature(MintVoucherV2Lib.MintVoucher memory voucher)
        internal
        view
        returns (bytes memory)
    {
        return _signatureWith(SIGNER_KEY, voucher);
    }

    function _signatureWith(uint256 privateKey, MintVoucherV2Lib.MintVoucher memory voucher)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, planets.hashVoucher(voucher));
        return abi.encodePacked(r, s, v);
    }
}
