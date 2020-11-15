pragma solidity ^0.6.0;

import "../libs/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "../libs/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract EnergyCellToken is ERC20 {
    constructor() ERC20("Energy cell token", "ECT") public {

    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
