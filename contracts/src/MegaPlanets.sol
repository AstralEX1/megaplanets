// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IJackpotTicketNFT } from "./interfaces/IJackpotTicketNFT.sol";
import { MintVoucherLib } from "./libraries/MintVoucherLib.sol";

contract MegaPlanets is ERC721, EIP712, Ownable, ReentrancyGuard {
    using MintVoucherLib for MintVoucherLib.MintVoucher;

    uint256 public constant MAX_BATCH_MINT = 50;
    uint256 public constant SPECIAL_TOKEN_PREFIX = uint256(1) << 255;
    bytes32 public constant SEASON_1_ID =
        0xee23bca2927e52eeb944320241d7a6e41726dcb3f169d972044bdafe95b4b15b;

    IJackpotTicketNFT public immutable jackpotTicketNFT;
    bytes32 public immutable seasonId;
    address public metadataSigner;

    mapping(uint256 => bool) public planetMinted;
    mapping(uint256 => string) private _tokenURIs;

    error ZeroAddress();
    error EmptyBatch();
    error BatchTooLarge(uint256 size);
    error SignatureLengthMismatch(uint256 vouchersLength, uint256 signaturesLength);
    error InvalidSignature(address recovered);
    error VoucherExpired(uint256 expiresAt);
    error RecipientMismatch(address recipient, address caller);
    error InvalidSeason(bytes32 provided);
    error InvalidMetadataHash();
    error EmptyMetadataURI();
    error TicketAlreadyMinted(uint256 ticketId);
    error TicketUnavailable(uint256 ticketId);
    error TicketOwnerMismatch(uint256 ticketId, address owner, address recipient);
    error DuplicateTicketId(uint256 ticketId);
    error ReservedSpecialTokenId(uint256 tokenId);
    error SpecialEditionOutOfRange(uint256 editionId);

    event PlanetMinted(
        uint256 indexed tokenId,
        uint256 indexed ticketId,
        address indexed recipient,
        bytes32 seasonId,
        bytes32 seed,
        bytes32 metadataHash
    );
    event SpecialPlanetMinted(
        uint256 indexed tokenId,
        uint256 indexed editionId,
        address indexed recipient,
        bytes32 seasonId
    );
    event MetadataSignerUpdated(address indexed previousSigner, address indexed newSigner);

    constructor(address initialOwner, address initialMetadataSigner, address ticketNft)
        ERC721("MegaPlanets", "MPLANET")
        EIP712("MegaPlanets", "1")
        Ownable(initialOwner)
    {
        if (initialMetadataSigner == address(0) || ticketNft == address(0)) revert ZeroAddress();
        metadataSigner = initialMetadataSigner;
        jackpotTicketNFT = IJackpotTicketNFT(ticketNft);
        seasonId = SEASON_1_ID;
    }

    function setMetadataSigner(address newMetadataSigner) external onlyOwner {
        if (newMetadataSigner == address(0)) revert ZeroAddress();
        address previousSigner = metadataSigner;
        metadataSigner = newMetadataSigner;
        emit MetadataSignerUpdated(previousSigner, newMetadataSigner);
    }

    function mint(MintVoucherLib.MintVoucher calldata voucher, bytes calldata signature)
        external
        nonReentrant
    {
        _validateVoucher(voucher, signature);
        _mintPlanet(voucher);
    }

    function mintBatch(MintVoucherLib.MintVoucher[] calldata vouchers, bytes[] calldata signatures)
        external
        nonReentrant
    {
        uint256 length = vouchers.length;
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH_MINT) revert BatchTooLarge(length);
        if (length != signatures.length) revert SignatureLengthMismatch(length, signatures.length);

        for (uint256 i; i < length; ++i) {
            for (uint256 j; j < i; ++j) {
                if (vouchers[i].ticketId == vouchers[j].ticketId) {
                    revert DuplicateTicketId(vouchers[i].ticketId);
                }
            }
            _validateVoucher(vouchers[i], signatures[i]);
        }
        for (uint256 i; i < length; ++i) {
            _mintPlanet(vouchers[i]);
        }
    }

    function mintSpecial(address recipient, uint256 editionId, string calldata metadataURI)
        external
        onlyOwner
        nonReentrant
    {
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        if (editionId >= SPECIAL_TOKEN_PREFIX) revert SpecialEditionOutOfRange(editionId);
        uint256 tokenId = SPECIAL_TOKEN_PREFIX | editionId;
        if (_ownerOf(tokenId) != address(0)) revert TicketAlreadyMinted(tokenId);

        _tokenURIs[tokenId] = metadataURI;
        _safeMint(recipient, tokenId);
        emit SpecialPlanetMinted(tokenId, editionId, recipient, seasonId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    function hashVoucher(MintVoucherLib.MintVoucher calldata voucher)
        external
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(voucher.structHash());
    }

    function _validateVoucher(MintVoucherLib.MintVoucher calldata voucher, bytes calldata signature)
        private
        view
    {
        if (voucher.recipient != msg.sender) {
            revert RecipientMismatch(voucher.recipient, msg.sender);
        }
        if (voucher.ticketId >= SPECIAL_TOKEN_PREFIX) {
            revert ReservedSpecialTokenId(voucher.ticketId);
        }
        if (voucher.expiresAt < block.timestamp) revert VoucherExpired(voucher.expiresAt);
        if (voucher.seasonId != seasonId) revert InvalidSeason(voucher.seasonId);
        if (bytes(voucher.metadataURI).length == 0) revert EmptyMetadataURI();
        if (keccak256(bytes(voucher.metadataURI)) != voucher.metadataHash) {
            revert InvalidMetadataHash();
        }
        if (planetMinted[voucher.ticketId] || _ownerOf(voucher.ticketId) != address(0)) {
            revert TicketAlreadyMinted(voucher.ticketId);
        }

        address recovered = ECDSA.recover(_hashTypedDataV4(voucher.structHash()), signature);
        if (recovered != metadataSigner) revert InvalidSignature(recovered);

        try jackpotTicketNFT.ownerOf(voucher.ticketId) returns (address ticketOwner) {
            if (ticketOwner != voucher.recipient) {
                revert TicketOwnerMismatch(voucher.ticketId, ticketOwner, voucher.recipient);
            }
        } catch {
            revert TicketUnavailable(voucher.ticketId);
        }
    }

    function _mintPlanet(MintVoucherLib.MintVoucher calldata voucher) private {
        planetMinted[voucher.ticketId] = true;
        _tokenURIs[voucher.ticketId] = voucher.metadataURI;
        _safeMint(voucher.recipient, voucher.ticketId);
        emit PlanetMinted(
            voucher.ticketId,
            voucher.ticketId,
            voucher.recipient,
            voucher.seasonId,
            voucher.seed,
            voucher.metadataHash
        );
    }
}
