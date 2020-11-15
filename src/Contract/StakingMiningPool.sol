pragma solidity ^0.6.0;
import "../libs/openzeppelin-contracts/contracts/access/Ownable.sol";
import "../libs/openzeppelin-contracts/contracts/token/ERC20/SafeERC20.sol";
import "./EnergyCellToken.sol";

contract StakingMiningPool is Ownable {
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
        IERC20 stakedToken;       // LP合约地址，由此可看出LP是个ERC20合约
        IERC20 minedToken;        // 被挖出的代币
        uint256 stakedNum;        // 本池子已经抵押的代币数量，需要单独统计，因为代币只能打给整个合约，而不能给本池子
        uint256 minedNum;         // 本池子可挖的代币数量，需要单独统计，因为代币只能打给整个合约，而不能给本池子
        address fromAccountOfStakedToken;  // 指定抵押的代币只能来自此地址（合约地址 or 用户地址） 
        uint256 lastRewardBlock;  // 最近计算过激励的区块高度
        uint256 accTokenPerShare;   // 累计每股可分到的token数量，为了防止小数出现，会乘以1e12
    }

    // 矿池列表
    PoolInfo[] public poolInfo;
    // 每个矿池中用户的信息
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
   
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor() public {
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // 添加新矿池，指定矿池权重、LP代币合约地址以及是否更新所有矿池
    function add(IERC20 _stakedToken, IERC20 _minedToken, address _fromAccountOfStakedToken, bool _withUpdate) public {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number;
        poolInfo.push(PoolInfo({
            stakedToken: _stakedToken,
            minedToken: _minedToken,
            stakedNum: 0,
            minedNum: 0,
            fromAccountOfStakedToken: _fromAccountOfStakedToken,
            lastRewardBlock: lastRewardBlock,
            accTokenPerShare: 0
        }));
    }

    // 获得用户在某个矿池中可获得挖矿激励，即多少个minedToken
    function pendingToken(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accTokenPerShare = pool.accTokenPerShare;
        uint256 lpSupply = pool.stakedNum;
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 tokenReward = pool.minedNum;   // 本池子中剩余的可挖矿代币数量
            accTokenPerShare = accTokenPerShare.add(tokenReward.mul(1e12).div(pool.stakedNum));   // 此处乘以1e12，在下面会除以1e12
        }
        return user.amount.mul(accTokenPerShare).div(1e12).sub(user.rewardDebt);  
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
        uint256 lpSupply = pool.stakedNum;   // 本池子占有的LP数量
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 tokenReward = pool.minedNum;   // 计算本池子可获得的新的token激励
        pool.accTokenPerShare = pool.accTokenPerShare.add(tokenReward.mul(1e12).div(lpSupply));  // 计算每个lp可分到的ect数量
        pool.lastRewardBlock = block.number;        // 记录最新的计算过的区块高度
    }

    // 用户将自己的LP转移到矿池中进行挖矿，过程：
    // 1: 更新整个矿池的激励，这一步必须先执行，才能在第2步中将已有激励分给用户
    // 2: 将之前挖矿的激励分给用户
    // 3: 将用户新的LP数量转移到合约中，并将其加到用户总的LP数量上
    // 4: 记录用户不可提取的激励总数，包括了已经提取的激励数 和 不可计入的激励数
    function depositStakeToken(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];            // 获取挖矿池
        require(pool.fromAccountOfStakedToken == address(0) || pool.fromAccountOfStakedToken == msg.sender, "Only specified account could stake token.");
        UserInfo storage user = userInfo[_pid][msg.sender];  // 获取矿池中的用户信息
        updatePool(_pid);
        if (user.amount > 0) {
            // pending是用户到最新区块可提取的奖励数量
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
            safeTokenTransfer(pool.minedToken, msg.sender, pending);
        }
        pool.stakedToken.safeTransferFrom(address(msg.sender), address(this), _amount);  // 将用户的lp转移到挖矿池中
        pool.stakedNum = pool.stakedNum.add(_amount);
        user.amount = user.amount.add(_amount);          // 将新的LP加到用户总的LP上
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);    
        emit Deposit(msg.sender, _pid, _amount);
    }

    function supplyMinedToken(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];  
        pool.minedToken.transfer(address(this), _amount);  // 将外界提供的矿转移到挖矿池;
        pool.minedNum = pool.minedNum.add(_amount);
    }

    // 用户从矿池中提取minedToken，流程：
    // 1: 先更新整个矿池的激励情况
    // 2: 将可提取的ect激励发放给用户
    // 3: 更新用户在矿池中的LP数量以及不可提取的ect数量
    // 4: 将用户提取的LP数量转给用户
    function havest(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
        safeTokenTransfer(pool.minedToken, msg.sender, pending);
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // 紧急提现LP，不再要激励
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.stakedToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // 安全转移mined代币.
    function safeTokenTransfer(IERC20 minedToken, address _to, uint256 _amount) internal {
        uint256 tokenBal = minedToken.balanceOf(address(this));
        if (_amount > tokenBal) {
            minedToken.transfer(_to, tokenBal);
        } else {
            minedToken.transfer(_to, _amount);
        }
    }
}