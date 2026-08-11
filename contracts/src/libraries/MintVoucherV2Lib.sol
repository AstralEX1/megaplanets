// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

library MintVoucherV2Lib {
    bytes32 internal constant TYPEHASH = keccak256(
        "MintVoucher(address recipient,uint256 ticketId,uint256 drawingId,bytes32 originTxHash,bytes32 seed,bytes32 traitsHash,bytes32 metadataHash,string metadataURI,uint256 expiresAt)"
    );

    struct MintVoucher {
        address recipient;
        uint256 ticketId;
        uint256 drawingId;
        bytes32 originTxHash;
        bytes32 seed;
        bytes32 traitsHash;
        bytes32 metadataHash;
        string metadataURI;
        uint256 expiresAt;
    }

    function structHash(MintVoucher calldata voucher) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                TYPEHASH,
                voucher.recipient,
                voucher.ticketId,
                voucher.drawingId,
                voucher.originTxHash,
                voucher.seed,
                voucher.traitsHash,
                voucher.metadataHash,
                keccak256(bytes(voucher.metadataURI)),
                voucher.expiresAt
            )
        );
    }
}
