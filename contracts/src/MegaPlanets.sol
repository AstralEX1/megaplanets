// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721A } from "erc721a/contracts/ERC721A.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IJackpotTicketNFT } from "./interfaces/IJackpotTicketNFT.sol";
import { MintVoucherLib } from "./libraries/MintVoucherLib.sol";

/// @notice Ticket-backed Planet NFT collection optimized for consecutive batch mints.
/// @dev Each Megapot ticket has exactly one Planet, but ERC721A token IDs are sequential.
contract MegaPlanets is ERC721A, EIP712, Ownable, ReentrancyGuard {
    using MintVoucherLib for MintVoucherLib.MintVoucher;

    uint256 public constant MAX_BATCH_MINT = 50;
    bytes32 public constant SEASON_1_ID =
        0xee23bca2927e52eeb944320241d7a6e41726dcb3f169d972044bdafe95b4b15b;

    IJackpotTicketNFT public immutable jackpotTicketNFT;
    bytes32 public immutable seasonId;
    address public metadataSigner;

    /// @notice Tracks whether a Megapot ticket has already been converted into a Planet.
    mapping(uint256 => bool) public planetMinted;
    /// @notice Resolves ticket provenance to the sequential ERC721A Planet token ID.
    mapping(uint256 => uint256) public planetTokenIdByTicketId;
    /// @notice Resolves a Planet token ID back to its Megapot ticket provenance.
    mapping(uint256 => uint256) public ticketIdByPlanetTokenId;
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
    error TokenDoesNotExist(uint256 tokenId);

    event PlanetMinted(
        uint256 indexed tokenId,
        uint256 indexed ticketId,
        address indexed recipient,
        bytes32 seasonId,
        bytes32 seed,
        bytes32 metadataHash
    );
    event MetadataSignerUpdated(address indexed previousSigner, address indexed newSigner);

    constructor(address initialOwner, address initialMetadataSigner, address ticketNft)
        ERC721A("MegaPlanets", "MPLANET")
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
        uint256 tokenId = _nextTokenId();
        _recordPlanet(voucher, tokenId);
        _safeMint(voucher.recipient, 1);
        _emitPlanetMinted(voucher, tokenId);
    }

    /// @notice Atomically mints one Planet for each valid ticket-backed voucher.
    /// @dev ERC721A assigns consecutive token IDs, minimizing storage writes for batch mints.
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

        uint256 firstTokenId = _nextTokenId();
        for (uint256 i; i < length; ++i) {
            _recordPlanet(vouchers[i], firstTokenId + i);
        }
        _safeMint(msg.sender, length);
        for (uint256 i; i < length; ++i) {
            _emitPlanetMinted(vouchers[i], firstTokenId + i);
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert TokenDoesNotExist(tokenId);
        return _tokenURIs[tokenId];
    }

    function hashVoucher(MintVoucherLib.MintVoucher calldata voucher)
        external
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(voucher.structHash());
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    function _validateVoucher(MintVoucherLib.MintVoucher calldata voucher, bytes calldata signature)
        private
        view
    {
        if (voucher.recipient != msg.sender) {
            revert RecipientMismatch(voucher.recipient, msg.sender);
        }
        if (voucher.expiresAt < block.timestamp) revert VoucherExpired(voucher.expiresAt);
        if (voucher.seasonId != seasonId) revert InvalidSeason(voucher.seasonId);
        if (bytes(voucher.metadataURI).length == 0) revert EmptyMetadataURI();
        if (keccak256(bytes(voucher.metadataURI)) != voucher.metadataHash) {
            revert InvalidMetadataHash();
        }
        if (planetMinted[voucher.ticketId]) revert TicketAlreadyMinted(voucher.ticketId);

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

    function _recordPlanet(MintVoucherLib.MintVoucher calldata voucher, uint256 tokenId) private {
        planetMinted[voucher.ticketId] = true;
        planetTokenIdByTicketId[voucher.ticketId] = tokenId;
        ticketIdByPlanetTokenId[tokenId] = voucher.ticketId;
        _tokenURIs[tokenId] = voucher.metadataURI;
    }

    function _emitPlanetMinted(MintVoucherLib.MintVoucher calldata voucher, uint256 tokenId) private {
        emit PlanetMinted(
            tokenId,
            voucher.ticketId,
            voucher.recipient,
            voucher.seasonId,
            voucher.seed,
            voucher.metadataHash
        );
    }
}
