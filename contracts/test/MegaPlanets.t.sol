// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MegaPlanets } from "../src/MegaPlanets.sol";
import { MintVoucherLib } from "../src/libraries/MintVoucherLib.sol";
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

    function testMintMintsFreePlanetWithTicketIdAndImmutableUri() external {
        MintVoucherLib.MintVoucher memory voucher = _voucher(alice, 101, "ipfs://planet-101");
        tickets.mint(alice, voucher.ticketId);
        bytes memory signature = _signature(voucher);

        vm.prank(alice);
        planets.mint(voucher, signature);

        assertEq(planets.ownerOf(101), alice);
        assertEq(planets.tokenURI(101), "ipfs://planet-101");
        assertTrue(planets.planetMinted(101));
        assertEq(address(planets).balance, 0);
    }

    function testMintBatchMintsEveryVoucherAtomically() external {
        MintVoucherLib.MintVoucher[] memory vouchers = new MintVoucherLib.MintVoucher[](2);
        bytes[] memory signatures = new bytes[](2);
        vouchers[0] = _voucher(alice, 201, "ipfs://planet-201");
        vouchers[1] = _voucher(alice, 202, "ipfs://planet-202");
        tickets.mint(alice, 201);
        tickets.mint(alice, 202);
        signatures[0] = _signature(vouchers[0]);
        signatures[1] = _signature(vouchers[1]);

        vm.prank(alice);
        planets.mintBatch(vouchers, signatures);

        assertEq(planets.ownerOf(201), alice);
        assertEq(planets.ownerOf(202), alice);
    }

    function testMintRejectsEth() external {
        MintVoucherLib.MintVoucher memory voucher = _voucher(alice, 102, "ipfs://planet-102");
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
        MintVoucherLib.MintVoucher memory voucher = _voucher(alice, 103, "ipfs://planet-103");
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

    function testMintRejectsRecipientSeasonAndMetadataTampering() external {
        MintVoucherLib.MintVoucher memory voucher = _voucher(alice, 105, "ipfs://planet-105");
        tickets.mint(alice, 105);
        bytes memory signature = _signature(voucher);
        vm.prank(bob);
        vm.expectRevert();
        planets.mint(voucher, signature);

        voucher = _voucher(alice, 106, "ipfs://planet-106");
        voucher.seasonId = bytes32(uint256(9));
        tickets.mint(alice, 106);
        signature = _signature(voucher);
        vm.prank(alice);
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

    function testMintRejectsUsedNonOwnerAndBurnedTickets() external {
        MintVoucherLib.MintVoucher memory voucher = _voucher(alice, 108, "ipfs://planet-108");
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
        MintVoucherLib.MintVoucher[] memory vouchers = new MintVoucherLib.MintVoucher[](2);
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
        MintVoucherLib.MintVoucher memory voucher = _voucher(bob, 112, "ipfs://planet-112");
        tickets.mint(alice, 112);
        vm.prank(alice);
        tickets.transferFrom(alice, bob, 112);
        bytes memory signature = _signature(voucher);
        vm.prank(bob);
        planets.mint(voucher, signature);
        assertEq(planets.ownerOf(112), bob);
    }

    function testSpecialMintAndOwnershipControls() external {
        uint256 editionId = 7;
        uint256 tokenId = planets.SPECIAL_TOKEN_PREFIX() | editionId;
        vm.prank(alice);
        vm.expectRevert();
        planets.mintSpecial(alice, editionId, "ipfs://special-7");
        vm.prank(owner);
        planets.mintSpecial(alice, editionId, "ipfs://special-7");
        assertEq(planets.ownerOf(tokenId), alice);
        assertEq(planets.tokenURI(tokenId), "ipfs://special-7");

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
        returns (MintVoucherLib.MintVoucher memory)
    {
        return MintVoucherLib.MintVoucher({
            recipient: recipient,
            ticketId: ticketId,
            seasonId: planets.seasonId(),
            drawingId: 12,
            originTxHash: keccak256("origin"),
            seed: keccak256("seed"),
            traitsHash: keccak256("traits"),
            metadataHash: keccak256(bytes(uri)),
            metadataURI: uri,
            expiresAt: block.timestamp + 1 days
        });
    }

    function _signature(MintVoucherLib.MintVoucher memory voucher)
        internal
        view
        returns (bytes memory)
    {
        return _signatureWith(SIGNER_KEY, voucher);
    }

    function _signatureWith(uint256 privateKey, MintVoucherLib.MintVoucher memory voucher)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, planets.hashVoucher(voucher));
        return abi.encodePacked(r, s, v);
    }
}
