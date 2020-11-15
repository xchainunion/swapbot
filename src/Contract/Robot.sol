pragma solidity ^0.6.0;

import "../libs/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../libs/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "../libs/openzeppelin-contracts/contracts/token/ERC20/SafeERC20.sol";
import "../libs/openzeppelin-contracts/contracts/math/SafeMath.sol";
import "../libs/openzeppelin-contracts/contracts/utils/EnumerableSet.sol";
import "../libs/openzeppelin-contracts/contracts/utils/Address.sol";
import "../libs/openzeppelin-contracts/contracts/access/Ownable.sol";
import "./Skill.sol";

contract Robot is Ownable, ERC721 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address;
    using EnumerableSet for EnumerableSet.UintSet;

    struct RobotBase {
        string  name;             // 3~15字节长度
        // 1: 共6个等级，每升个等级会给予2个技能和3个装备，每个等级机器人数量不能超过上一个等级机器人数量的1/3，第一个等级数量可以无限制
        // 2: 每生成一个机器人，需要消耗对应等级的原石（ERC20），原石数量 = token.balanceOf(this).div(100).mul(level);
        uint256  level;            
        uint256  maxSkillNum;      // 最多可携带技能数量
        uint256  maxEquipmentNum;  // 最多装备数
        uint256  consumedECT;      // 消耗的原石数
    }

    uint256 tokenCount = 0;
    RobotBase[] private robotList;
    IERC20 public energyCellToken;    // 原石，是一种能源，需要通过抵押资产后挖矿产生
    mapping(uint256 => uint256) public levelRobotNumMap;   // 每个等级对应的机器人数量
    uint256 public maxLevel;
    uint256 public skillTimes;
    uint256 public equipmentTimes;

    address public fundAddr;
    uint256 public lastWithdrawTime;

    mapping(uint256 => EnumerableSet.UintSet) robotSkillSet;
    Skill public skill;

    event BindSkill2Robot(uint256 indexed _robotTokenId, uint256 indexed _skillTokenId);
    event UnbindSkillFromRobot(uint256 indexed _robotTokenId, uint256 indexed _skillTokenId, address _to);
    event Mint(address indexed _to, string _name, uint256 _level);

    constructor(address _energyCellToken, address _fundAddr) ERC721("Robot", "RBT")  public {
        energyCellToken = IERC20(_energyCellToken);
        maxLevel = 6;
        skillTimes = 2;
        equipmentTimes = 3;
        fundAddr = _fundAddr;
    }

    function setMaxLevel(uint256 _maxLevel) public onlyOwner {
        maxLevel = _maxLevel;
    }

    function setSkillTimes(uint256 _skillTimes) public onlyOwner {
        skillTimes = _skillTimes;
    }

    function setEquipmentTimes(uint256 _equipmentTimes) public onlyOwner {
        equipmentTimes = _equipmentTimes;
    }

    function setSkill(address _skill) public onlyOwner {
        require(_skill.isContract());
        skill = Skill(_skill);
    }

    // 任何用户在满足条件下，都可以生成机器人
    function mint(address _to, string memory _name, uint256 _level) public returns (uint256) {
        require(_to != address(0));
        require(bytes(_name).length >= 3 && bytes(_name).length <= 15, "The lenght of name should be [3, 15].");
        require(_level >= 1 && _level <= maxLevel);
        if (_level > 1) {   // 此处用于控制每个等级机器人的数量
            require(levelRobotNumMap[_level - 1].div(3) > levelRobotNumMap[_level], "The number of robots is too much in this level.");
        }

        // 此处用于控制没生成一个机器人需要消耗的原石
        uint256 tokenOfRobotPool = energyCellToken.balanceOf(address(this));
        uint256 consumedECT = tokenOfRobotPool.mul(_level).div(100);  // 需要消耗的原石数量 = 合约中原石量 / 100 * level of robot
        energyCellToken.safeTransferFrom(address(msg.sender), address(this), consumedECT);  // 将消耗的原石转移到合约地址

        // 生成机器人
        RobotBase memory robotBase = RobotBase({name: _name, level: _level, maxSkillNum: _level * skillTimes, 
                                                maxEquipmentNum: _level * equipmentTimes, consumedECT: consumedECT});
        robotList.push(robotBase);
        levelRobotNumMap[_level] += 1;
        tokenCount++;
        _safeMint(_to, tokenCount);
        emit Mint(_to, _name, _level);
        return tokenCount;
    }

    function getRobot(uint256 _tokenId) view public returns(string memory _name, uint256 _level, uint256 _maxSkillNum, uint256 _maxEquipmentNum, uint256 _consumedECT) {
        require(_tokenId > 0, "Token id must be bigger than zero.");
        RobotBase memory robotBase = robotList[_tokenId - 1];
        return (robotBase.name, robotBase.level, robotBase.maxSkillNum, robotBase.maxEquipmentNum, robotBase.consumedECT);
    }

    function setFundAddr(address _fundAddr) public onlyOwner {
        fundAddr = _fundAddr;
    }

    function withdraw() public onlyOwner {
        if (now - lastWithdrawTime > 30 days) {  // 距离上一次提取超过30天后，可提取此合约中1/12的token给基金会，用以社区发展
            energyCellToken.transfer(fundAddr, energyCellToken.balanceOf(address(this)).div(12));
        }
    }

    function bindSkill2Robot(uint256 _robotTokenId, uint256 _skillTokenId) public {
        // 用户对机器人拥有操作权限
        require(isApprovedOrOwner(msg.sender, _robotTokenId));
        // 将技能的owner修改为本合约，同时记录robot的编号，通过【合约+编号】便能确定技能属于哪个机器人
        // 注意：这一步想要执行成功，需要用户先将技能的操作权限授权给本合约
        skill.transferToParent(msg.sender, address(this), _robotTokenId, _skillTokenId);
        robotSkillSet[_robotTokenId].add(_skillTokenId);
        emit BindSkill2Robot(_robotTokenId, _skillTokenId);
    }

    function unbindSkillFromRobot(uint256 _robotTokenId, uint256 _skillTokenId, address _to) public {
        // 用户对机器人拥有操作权限，所以对技能也拥有权限
        require(isApprovedOrOwner(msg.sender, _robotTokenId));
        // 将技能的owner修改为本合约，同时记录robot的编号，通过【合约+编号】便能确定技能属于哪个机器人
        skill.transferFromParent(address(this), _robotTokenId, _to, _skillTokenId);
        robotSkillSet[_robotTokenId].remove(_skillTokenId);
        emit UnbindSkillFromRobot(_robotTokenId, _skillTokenId, _to);
    }
    
    function getRobotSkillNumber(uint256 _robotTokenId) view public returns(uint256) {
        require(_exists(_robotTokenId));
        return robotSkillSet[_robotTokenId].length();
    }

    function getRobotSkillId(uint256 _robotTokenId, uint256 _index) view public returns(uint256) {
        require(_exists(_robotTokenId));
        return robotSkillSet[_robotTokenId].at(_index);
    }

    function isApprovedOrOwner(address spender, uint256 tokenId) public view returns (bool) {
        return _isApprovedOrOwner(spender, tokenId);
    }
}
