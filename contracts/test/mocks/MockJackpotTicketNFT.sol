// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockJackpotTicketNFT is ERC721 {
    constructor() ERC721("Mock Megapot Ticket", "MMT") { }

    function mint(address recipient, uint256 ticketId) external {
        _safeMint(recipient, ticketId);
    }

    function burn(uint256 ticketId) external {
        _burn(ticketId);
    }
}
