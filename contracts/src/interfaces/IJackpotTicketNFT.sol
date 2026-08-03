// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IJackpotTicketNFT {
    function ownerOf(uint256 ticketId) external view returns (address);
}
