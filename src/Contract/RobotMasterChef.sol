pragma solidity ^0.6.0;
import "../libs/openzeppelin-contracts/contracts/access/Ownable.sol";
import "../libs/openzeppelin-contracts/contracts/token/ERC20/SafeERC20.sol";
import "./EnergyCellToken.sol";

contract RobotMasterChef is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;         // 用户一共抵押的LP数量
        
        //rewardDebt指用户不可提取的那部分激励
        uint256 rewardDebt;  
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // LP合约地址，由此可看出LP是个ERC20合约
        uint256 allocPoint;       // 本池子可分到的ect权重
        uint256 lastRewardBlock;  // 最近计算过激励的区块高度
        uint256 accEctPerShare;   // 累计每股可分到的ect数量，为了防止小数出现，会乘以1e12
    }

    // ect代币合约
    EnergyCellToken public ect;
    // 开发者地址，5%的ect代币会转到机器人合约中
    address public robotContractAddr;
    // 额外激励结束的区块高度，早期矿工有10倍挖矿激励
    uint256 public bonusEndBlock;
    // 每个区块可挖的ect数量
    uint256 public ectPerBlock;
    // 3倍挖矿激励，不可变
    uint256 public constant BONUS_MULTIPLIER = 3;

    // 矿池列表
    PoolInfo[] public poolInfo;
    // 每个矿池中用户的信息
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // 所有矿池的权重之和
    uint256 public totalAllocPoint = 0;
    // 其实挖矿的区块高度
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        EnergyCellToken _ect,              
        address _robotContractAddr,               
        uint256 _ectPerBlock,     
        uint256 _startBlock,           
        uint256 _bonusEndBlock  
    ) public {
        ect = _ect;
        robotContractAddr = _robotContractAddr;
        ectPerBlock = _ectPerBlock;
        bonusEndBlock = _bonusEndBlock;
        startBlock = _startBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // 添加新矿池，指定矿池权重、LP代币合约地址以及是否更新所有矿池
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);   // 将新矿池权重加到总权重里
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accEctPerShare: 0
        }));
    }

    // owner可以更新矿池的权重
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // 返回区块奖励，对于早于某个高度的区块，会乘以10，以鼓励早期矿工
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= bonusEndBlock) {   
            return _to.sub(_from).mul(BONUS_MULTIPLIER);
        } else if (_from >= bonusEndBlock) {
            return _to.sub(_from);
        } else {
            return bonusEndBlock.sub(_from).mul(BONUS_MULTIPLIER).add(
                _to.sub(bonusEndBlock)
            );
        }
    }

    // 获得用户在某个矿池中可获得挖矿激励，即多少个ect
    function pendingEct(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accEctPerShare = pool.accEctPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            // 计算某个池子可获得的新增的ect数量
            uint256 ectReward = multiplier.mul(ectPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accEctPerShare = accEctPerShare.add(ectReward.mul(1e12).div(lpSupply));   // 此处乘以1e12，在下面会除以1e12
        }
        return user.amount.mul(accEctPerShare).div(1e12).sub(user.rewardDebt);  
    }

    // 更新所有矿池的激励数
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // 更新指定矿池的激励，此处会给机器人合约额外5%的ect激励
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));   // 本池子占有的LP数量
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);  // 获取未计算奖励的区块数（乘上加权因子）
        uint256 ectReward = multiplier.mul(ectPerBlock).mul(pool.allocPoint).div(totalAllocPoint);   // 计算本池子可获得的新的ect激励
        ect.mint(robotContractAddr, ectReward.div(20));   // 给机器人合约额外的ect奖励，奖励数量为挖出的ect的5%
        ect.mint(address(this), ectReward);     // 将挖出的ect给此合约
        pool.accEctPerShare = pool.accEctPerShare.add(ectReward.mul(1e12).div(lpSupply));  // 计算每个lp可分到的ect数量
        pool.lastRewardBlock = block.number;        // 记录最新的计算过的区块高度
    }

    // 用户将自己的LP转移到矿池中进行挖矿，过程：
    // 1: 更新整个矿池的激励，这一步必须先执行，才能在第2步中将已有激励分给用户
    // 2: 将之前挖矿的激励分给用户
    // 3: 将用户新的LP数量转移到合约中，并将其加到用户总的LP数量上
    // 4: 记录用户不可提取的激励总数，包括了已经提取的激励数 和 不可计入的激励数
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];            // 获取挖矿池
        UserInfo storage user = userInfo[_pid][msg.sender];  // 获取狂池中的用户信息
        updatePool(_pid);
        if (user.amount > 0) {
            // pending是用户到最新区块可提取的奖励数量
            uint256 pending = user.amount.mul(pool.accEctPerShare).div(1e12).sub(user.rewardDebt);
            safeEctTransfer(msg.sender, pending);
        }
        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);  // 将用户的lp转移到挖矿池中
        user.amount = user.amount.add(_amount);          // 将新的LP加到用户总的LP上
        user.rewardDebt = user.amount.mul(pool.accEctPerShare).div(1e12);    
        emit Deposit(msg.sender, _pid, _amount);
    }

    // 用户从矿池中提取LP，流程：
    // 1: 先更新整个矿池的激励情况
    // 2: 将可提取的ect激励发放给用户
    // 3: 更新用户在矿池中的LP数量以及不可提取的ect数量
    // 4: 将用户提取的LP数量转给用户
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accEctPerShare).div(1e12).sub(user.rewardDebt);
        safeEctTransfer(msg.sender, pending);
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accEctPerShare).div(1e12);
        pool.lpToken.safeTransfer(address(msg.sender), _amount);  // 将LP还给用户，用户便可在uniswap流动性池中提取手续费激励了
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // 紧急提现LP，不再要激励
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // 安全转移ect代币.
    function safeEctTransfer(address _to, uint256 _amount) internal {
        uint256 ectBal = ect.balanceOf(address(this));
        if (_amount > ectBal) {
            ect.transfer(_to, ectBal);
        } else {
            ect.transfer(_to, _amount);
        }
    }
}