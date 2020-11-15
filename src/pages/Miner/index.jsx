import React, { Component } from 'react';
import { Card, Button, Input, Grid, Message, Box, Dialog, Checkbox, Loading, Select, Icon } from '@alifd/next';
import { ethers } from 'ethers';
import Web3 from 'web3';
import styles from './index.module.scss';
import ContractAddr from '../../ContractInfo/Address.json';
import MasterChefABI from '../../ContractInfo/MasterChef.json';
import Erc20ABI from '../../ContractInfo/ERC20.json';

const {Row} = Grid;

const NotificationType = { Desktop: 0, Weixin: 1, Telegram: 2 }; 
const Percents = [0.05, 0.03, 0.01, 0];

export default class Miner extends Component {
  static displayName = 'Uniswap';

  constructor(props) {
    super(props);
    this.state = {
        web3: null,
        masterChef: null,
        curAccount: '',
        watchedPairs: [],
        erc20AddrName: {},
        curUserInfo: null,
        stakeVisible: false,
        withdrawVisible: false,
    };

  }

  initMetamaskNetwork = async () => {
    if (!window.ethereum && !window.web3) { //用来判断你是否安装了metamask
      Message.error('未安装Metamask，无法使用Metamask同链进行交互');
    } else {
      let web3Provider = '';
      if (window.ethereum) {
        try {
          // 请求用户授权
          await window.ethereum.enable();
        } catch (error) {
          // 用户不授权时
          Message.error("授权失败，无法使用MetaMask服务");
          return;
        }        
        web3Provider = window.ethereum;
      } else if (window.web3) {
        web3Provider = window.web3;
      }      
      if (web3Provider != '') {
        this.state.web3 = new Web3(web3Provider);      
      }
      ethereum.request({ method: 'eth_requestAccounts' }).then(accounts => this.state.curAccount = accounts[0]);
      this.state.masterChef = new this.state.web3.eth.Contract(MasterChefABI, ContractAddr.MasterChef);
      this.initData();
    }
  }

  componentDidMount = () => {
    this.initMetamaskNetwork();
  }

  initData = () => {
      this.getPoolLength();
  }

  getPoolLength = () => {
    try {     
        const poolLength = this.state.masterChef.methods['poolLength'];
        poolLength().call({from: this.state.curAccount}, (err, result) => {
            if (err != null) {
                Message.error(err.message);
                return;
            }
            for (var i = 0; i < result; i++) {
                this.getPoolInfo(i);
            }
        });
    } catch (error) {
        console.log(error.message);
    }
  }

  getPoolInfo = (index) => {
    try {     
        const poolInfo = this.state.masterChef.methods['poolInfo'];
        return poolInfo(index).call({from: this.state.curAccount}, async (err, result) => {
            if (err != null) {
                Message.error(err.message);
                return;
            }
            console.log(result);
            //await this.getErc20Info(result.lpToken);
            await this.getUserInfo(index, this.state.curAccount);
            this.state.watchedPairs.push(result);
            this.setState({watchedPairs: this.state.watchedPairs});

        });
    } catch (error) {
        console.log(error.message);
    }
  }

  getUserInfo = async (pairIndex, userAddr) => {
    try {     
        const userInfo = this.state.masterChef.methods['userInfo'];
        return userInfo(pairIndex, userAddr).call({from: this.state.curAccount}, (err, result) => {
            if (err == null) {
                console.log(result);
                this.state.curUserInfo = result;
            } else {
                console.log(err);
            }
        });
    } catch (error) {
        console.log(error.message);
    }
  }

  getErc20Info = async (address) => {
    try {     
        const erc20 = new this.state.web3.eth.Contract(Erc20ABI, address);
        const symbol = erc20.methods['symbol'];
        return symbol().call({from: this.state.curAccount}, (err, result) => {
            if (err != null) {
                this.state.erc20AddrName[address] = "WBNB";
            } else {
                console.log(result);
                this.state.erc20AddrName[address] = result;
            }
        });
    } catch (error) {
        console.log(error.message);
    }
  }

  approve = async (toAddress, erc20Address) => {
    try {     
        const erc20 = new this.state.web3.eth.Contract(Erc20ABI, erc20Address);
        const approve = erc20.methods['approve'];
        const option = {from: this.state.curAccount, value: 0};           
                  
        approve(toAddress, '0x' + new BigNumber(10000000000).shiftedBy(18).toString(16)).send(option)
        .on('transactionHash', function(txHash) {
          
        })
        .on('receipt', function(receipt) {
          
        })
        .on('confirmation', function(confirmationNumber, receipt) {
          
        })
        .on('error', error => {});
    } catch (error) {
        console.log(error.message);
    }
  }

  onStakeOK = () => {

  }

  render() {
    return (
      <div className={styles.container}>
        <p style={{fontSize: '30px'}}>
          抵押资产，挖出原石(ECT-ERC20)
        </p>
        <p style={{fontSize: '20px', color: '#84A8D7'}}>
          每区块产5颗原石，前两周3倍加速
        </p>
        <Row align='center' style={{marginBottom: '20px'}}>
          原石用途: 用于生成机器人、技能、装备等需要消耗能源的ERC721对象
        </Row>
       <Box wrap padding={20} margin={[20, 20]} direction="row" align="center" justify='center'>
            {this.state.watchedPairs.map(pair => {
              if (pair == null) return;
              var tokenName = this.state.erc20AddrName[pair.lpToken];
              if (tokenName == null) tokenName = 'WBNB';
              return (
                <Card key={tokenName} free style={{width: 400, background: '#fffff0', border: '2px solid #ffffff'}}>
                  <Card.Header title={'抵押代币' + tokenName}/>
                  <Card.Content>
                     <p>
                      本矿池权重：{pair.allocPoint}
                    </p>
                    <p>
                      您的抵押量：{this.state.curUserInfo.amount} {tokenName}
                    </p>
                  </Card.Content>
                  <Card.Actions>
                    <Button type="primary" key="action1" text onClick={() => this.approve()}>授权</Button>
                    <Button type="primary" key="action2" text onClick={() => {this.setState({stakeVisible: true})}}>抵押</Button>
                    <Button type="primary" key="action3" text onClick={() => {this.setState({withdrawVisible: true})}}>提取</Button>
                  </Card.Actions>
                </Card>
              )
            })}
        </Box>
        <Dialog
          visible={this.state.stakeVisible}
          title="抵押"
          closeable="true"
          footerAlign="center"
          onOk={this.onStakeOK.bind(this)}
          onCancel={() => this.setState({stakeVisible: false})}
          onClose={() => this.setState({stakeVisible: false})}
        >
          <Input hasClear
            // value={this.state.targetPrice[this.state.curTokenAddr]}
            // onChange={this.handletTargetPriceChange.bind(this)}
            // onPressEnter={this.onSetTargetPriceOK.bind(this)}
            style={{ width: 300 }}
            addonTextBefore='抵押金额'
            addonTextAfter='WBNB'
            size="medium"
          />
        </Dialog>
        <Dialog
          visible={this.state.withdrawVisible}
          title="提取抵押金"
          closeable="true"
          footerAlign="center"
          onOk={this.onStakeOK.bind(this)}
          onCancel={() => this.setState({withdrawVisible: false})}
          onClose={() => this.setState({withdrawVisible: false})}
        >
          <Input hasClear
            // value={this.state.targetPrice[this.state.curTokenAddr]}
            // onChange={this.handletTargetPriceChange.bind(this)}
            // onPressEnter={this.onSetTargetPriceOK.bind(this)}
            style={{ width: 300 }}
            addonTextBefore='抵押金额'
            addonTextAfter='WBNB'
            size="medium"
          />
        </Dialog>
    </div>
    );
  }
}


/*

 const { ChainId, Token, WETH, Fetcher, Trade, TokenAmount, TradeType, Percent, Route } = Uniswap
  const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18)
  const pair = await Fetcher.fetchPairData(DAI, WETH[DAI.chainId])
  const route = new Route([pair], WETH[DAI.chainId])
  const amountIn = '1000000000000000000' // 1 WETH
  const trade = new Trade(route, new TokenAmount(WETH[DAI.chainId], amountIn), TradeType.EXACT_INPUT)
  console.log(TradeType.EXACT_INPUT)
  const slippageTolerance = new Percent('50', '10000') // 50 bips, or 0.50%
  const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw // needs to be converted to e.g. hex
  const path = [WETH[DAI.chainId].address, DAI.address]
  const to = '' // should be a checksummed recipient address
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time
  const value = trade.inputAmount.raw // // needs to be converted to e.g. hex
  console.log(value)




const provider = ethers.getDefaultProvider('homestead',  { infura: 'fa5d0f8a05294060b19eb1951bfce5de' });

    const token = new Token(ChainId, tokenAddress, decimal)
    const pair = await Fetcher.fetchPairData(token, WETH[token.chainId], provider)

*/