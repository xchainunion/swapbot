pragma solidity ^0.6.0;

import "../libs/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../libs/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "../libs/openzeppelin-contracts/contracts/token/ERC20/SafeERC20.sol";
import "../libs/openzeppelin-contracts/contracts/math/SafeMath.sol";
import "../libs/openzeppelin-contracts/contracts/utils/Counters.sol";
import "../libs/openzeppelin-contracts/contracts/access/Ownable.sol";
import "./SkillDividentToken.sol";

contract Skill is Ownable, ERC721 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct SkillBase {
        string name;
        string desc;
        string officialUrl;   // 官网URL

        // 技能等级，由发行方自行确定，等级越高，发行的时候需要消耗的原石也越多
        // 当技能被首次转让出去后，可将原石计入开发者共享的交易分红池中
        // 开发者可以根据不同等级，给予用户不同的技能体验
        uint256 level;

        uint256 consumedECT;  // 消耗的原石数量
        bool hasRobot;
        uint256 robotId;
    }

    uint256 tokenCount = 0;
    SkillBase[] public skillBaseList;
    IERC20 public energyCellToken;   // 原石token，是一种能源，需要通过抵押挖矿产生
    mapping(uint256 => uint256) public levelSkillNumMap;   // 每个等级对应的技能数量

    SkillDividentToken public skillDividentToken;  // 分红Token
    mapping(uint256 => bool) public dividentTokenRecordMap;   // 每个等级对应的技能数量

    uint256 public maxLevel;

    event TransferToParent(address indexed _from, address indexed _toContract, uint256 indexed _parentTokenId, uint256 indexed _childTokenId);
    event TransferFromParent(address indexed _fromContract, uint256 indexed _parentTokenId, address indexed _to, uint256 indexed _childTokenId);
    event Mint(address indexed _to, string _name, uint256 _level);


    constructor (address _energyCellToken) ERC721("Robot's skill", "RST") public {
        energyCellToken = IERC20(_energyCellToken);
        skillDividentToken = new SkillDividentToken();
    }

    function setMaxLevel(uint256 _maxLevel) public onlyOwner {
        maxLevel = _maxLevel;
    }

    // 任何用户在满足条件下，都可以生成自己的技能
    function mint(address _to, string memory _name, string memory _desc, string memory _tokenURI, string memory _officialUrl, uint256 _level) public returns (uint256) {
        require(_to != address(0));
        require(bytes(_name).length >= 3 && bytes(_name).length <= 15, "The lenght of name should be [3, 15].");
        require(bytes(_desc).length >= 3 && bytes(_desc).length <= 50, "The lenght of desc should be [3, 50].");

        require(_level >= 1 && _level <= maxLevel);
        if (_level > 1) {   // 此处用于控制每个等级技能的比例
            require(levelSkillNumMap[_level - 1].div(3) > levelSkillNumMap[_level], "The number of skill is too much in this level.");
        }

        // 此处用于控制每生成一个技能需要消耗的原石
        uint256 tokenOfSkillPool = energyCellToken.balanceOf(address(this));
        uint256 consumedECT = tokenOfSkillPool.mul(_level).div(100);  // 需要消耗的原石数量 = 合约中原石量 / 100 * level of skill
        if (consumedECT < 1) {
            consumedECT = 1;
        }
        energyCellToken.safeTransferFrom(address(msg.sender), address(this), consumedECT);  // 将消耗的原石转移到本合约，此合约的原石不可提取，相当于销毁

        // 生成技能
        SkillBase memory skillBase = SkillBase({name: _name, desc: _desc, officialUrl: _officialUrl,
                                                level: _level, consumedECT: consumedECT, hasRobot: false, robotId: 0});
        skillBaseList.push(skillBase);
        levelSkillNumMap[_level] += 1;
        tokenCount++;
        _safeMint(_to, tokenCount);
        _setTokenURI(tokenCount, _tokenURI);
        dividentTokenRecordMap[tokenCount] = false;  // 表示此技能尚未加入分红池，需要等到首次转让后才能加入
        emit Mint(_to, _name, _level);
        return tokenCount;
    }

    function getSkill(uint256 _tokenId) 
        view public returns(string memory _name, string memory _desc, string memory _picUrl, 
                            string memory _officialUrl, uint256 _level, uint256 _consumedECT,
                            bool _hasRobot, uint256 _robotId) {
        require(_tokenId > 0 && _tokenId < skillBaseList.length, "Token id must be bigger than zero.");
        SkillBase memory skillBase = skillBaseList[_tokenId - 1];
        string memory baseURI = tokenURI(_tokenId);
        return (skillBase.name, skillBase.desc, baseURI, skillBase.officialUrl, 
                skillBase.level, skillBase.consumedECT, skillBase.hasRobot, skillBase.robotId);
    }

    function setTokenURI(uint256 _tokenId, string memory _tokenURI) public {
        _setTokenURI(_tokenId, _tokenURI);
    }

    function setBaseURI(string memory _baseURI) public onlyOwner {
        _setBaseURI(_baseURI);
    }

    // 当ERC721在进行转移时，会调用此函数
    // 如果NFT是首次交易，则将其消耗的原石数量作为抵押加入分红池
    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override { 
        SkillBase memory skillBase = skillBaseList[tokenId - 1];
            
        if (!dividentTokenRecordMap[tokenCount]) {  // mint
            address owner = ownerOf(tokenId);
            skillDividentToken.mint(owner, skillBase.consumedECT);
            dividentTokenRecordMap[tokenCount] = true;
        }
    }

    function withdrawDivident() public {
        uint256 userShare = skillDividentToken.balanceOf(msg.sender);
        uint256 mount = userShare.mul(address(this).balance).div(skillDividentToken.totalSupply());
        msg.sender.transfer(mount);
        skillDividentToken.burn(msg.sender, userShare);   // 提取分红后，需要将原先的股份删除
    }

    function isApprovedOrOwner(address spender, uint256 tokenId) public view returns (bool) {
        return _isApprovedOrOwner(spender, tokenId);
    }

    function transferToParent(address _from, address _toContract, uint256 _parentTokenId, uint256 _childTokenId) public {
        transferFrom(_from, _toContract, _childTokenId);
        SkillBase storage skillBase = skillBaseList[_childTokenId - 1];
        skillBase.hasRobot = true;
        skillBase.robotId = _parentTokenId;
        emit TransferToParent(_from, _toContract, _parentTokenId, _childTokenId);
    }
    
    // 当用户直接调用此接口时，除非获得机器人合约授权，否则将失败，而合约内部无授权功能
    // 当技能归属于某个机器人时，只有机器人合约调用此接口才能成功
    function transferFromParent(address _fromContract, uint256 _parentTokenId, address _to, uint256 _childTokenId) public {
        SkillBase storage skillBase = skillBaseList[_childTokenId - 1];
        require(skillBase.hasRobot && skillBase.robotId == _parentTokenId);
        transferFrom(_fromContract, _to, _childTokenId);
        skillBase.hasRobot = false;
        skillBase.robotId = 0;
        emit TransferFromParent(_fromContract, _parentTokenId, _to, _childTokenId);
    }
    
}