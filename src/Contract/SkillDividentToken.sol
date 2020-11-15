pragma solidity ^0.6.0;
import "../libs/openzeppelin-contracts/contracts/access/Ownable.sol";
import "../libs/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract SkillDividentToken is ERC20, Ownable {
    constructor() ERC20("Skill divident token", "SDT") public {

    }

    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
    }
}