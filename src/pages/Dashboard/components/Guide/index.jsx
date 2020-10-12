import React, { Component } from 'react';
import { Card, Button, Input, Grid, Message, Box, Dialog, Checkbox, Loading, Select, Icon } from '@alifd/next';
import { ethers } from 'ethers';
import Web3 from 'web3';
import utils from "web3-utils";
import styles from './index.module.scss';
import logo from './assets/large.png';
import { ChainId, Token, WETH, Pair, TokenAmount, Fetcher, Route, Trade, TradeType } from '@uniswap/sdk'

const {Row} = Grid;

const NotificationType = { Desktop: 0, Weixin: 1, Telegram: 2 }; 
const Percents = [0.05, 0.03, 0.01, 0];

export default class Uniswap extends Component {
  static displayName = 'Uniswap';

  constructor(props) {
    super(props);
    this.state = {
      weth: WETH[ChainId.MAINNET],
      tokenAddr: '',
      tokenName: '',
      preTokenAddr: '',
      preTokenName: null,
      chainId: ChainId.MAINNET,
      midPrice: {},
      invertMidPrice: {},
      invertMidPriceUsd: {},
      executionPrice: {},
      nextMidPrice: {},
      wethPriceUsd: null,
      watchedPairs: [],
      curPair: null,
      curTokenAddr: '',
      curTokenName: '',
      tokenIntervalId: {},
      provider: this.getProviders(),
      starePriceVisible: false,
      swapTokenVisible: false,
      notificationChecked: {[NotificationType.Desktop]: {}, [NotificationType.Weixin]: {}, [NotificationType.Telegram]: {}},
      targetPrice: {},
      loadingVisible: true,
      percents: {},
      fromToken: 'ETH',
      toToken: 'ETH',
      swapTokenNum: {},
      fromTokenAddr: WETH[ChainId.MAINNET].address,
      toTokenAddr: '',
    };
  }

  getProviders = () => {
    var network = 'homestead';

    // Connect to INFUA
    var infuraProvider = new ethers.providers.InfuraProvider(network, '35b57a95cb6e4de4a6d7c4ab63dfc0f8');
    
    // Connect to Etherscan
    var etherscanProvider = new ethers.providers.EtherscanProvider(network, 'RQ1U2VU9D1HJ2XWPV8IRS373MKNRAXYIW4');

    const url = "https://eth-mainnet.alchemyapi.io/v2/PDSf1lHhrdmOSW2HEu-jWw2NRUDTsv3X";
    const alcheProvider = new ethers.providers.JsonRpcProvider(url, network);

    const cloudProvider = new ethers.providers.JsonRpcProvider('https://cloudflare-eth.com', network);
    
    // Creating a provider to automatically fallback onto Etherscan
    // if INFURA is down
    var fallbackProviders = new ethers.providers.FallbackProvider([
        infuraProvider,
        etherscanProvider,
        alcheProvider,
        cloudProvider
    ]);
    return fallbackProviders;
  }

  getRandomInt = (max) => {
    return Math.floor(Math.random() * Math.floor(max));
  }

  initPairs = () => {
    var watchedPairsInfo = global.localStorage.getItem('watchedPairs');
    if (watchedPairsInfo != null) {
      watchedPairsInfo = JSON.parse(watchedPairsInfo);
      const pairSize = watchedPairsInfo.length;
      var pairIndex = 0;
      const pairIntervalId = setInterval(() => {
        if (pairIndex == watchedPairsInfo.length) {
          clearInterval(pairIntervalId);
          this.setState({loadingVisible: false});
          return;
        }
        const pair = watchedPairsInfo[pairIndex++];
        this.getPair(pair.tokenAddr, pair.tokenName).then(pairObj => {
          this.state.watchedPairs.push(pairObj);
          this.getPrice(pairObj);
          const intervalId = setInterval(() => { 
            console.log('get price of ' + pair.tokenName);
            this.getPair(pair.tokenAddr, pair.tokenName).then(newPairObj => {
              this.getPrice(newPairObj); 
            });
          }, 15000);
          this.state.tokenIntervalId[pair.tokenName] = intervalId;
          this.setState({watchedPairs: this.state.watchedPairs});
        })
      }, 3000);
    } else {
      this.setState({loadingVisible: false});
    }
  }

  initTargetPriceInfos = () => {
    var targetPriceInfos = global.localStorage.getItem('targetPriceInfos');
    if (targetPriceInfos != null) {
      targetPriceInfos = JSON.parse(targetPriceInfos);
      for (var tokenAddr in targetPriceInfos) {
        const targetPriceInfo = targetPriceInfos[tokenAddr];
        this.state.targetPrice[tokenAddr] = targetPriceInfo.targetPrice;
        this.state.notificationChecked[NotificationType.Desktop][tokenAddr] = targetPriceInfo.notificationPlatform[NotificationType.Desktop];
        this.state.notificationChecked[NotificationType.Weixin][tokenAddr] = targetPriceInfo.notificationPlatform[NotificationType.Weixin];
        this.state.notificationChecked[NotificationType.Telegram][tokenAddr] = targetPriceInfo.notificationPlatform[NotificationType.Telegram];
      }
    }
  }

  componentDidMount = () => {
    this.initTargetPriceInfos();
    this.initPairs();
    this.syncWethPrice();
    setInterval(() => { this.syncWethPrice(); }, 15000);
  }

  syncWethPrice = () => {
    const _this = this;
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=weth')
      .then(function(response) {
        return response.json();
      })
      .then(function(wethInfo) {
        console.log('weth = ' + wethInfo[0].current_price + ' usd');
        _this.setState({wethPriceUsd: wethInfo[0].current_price});
        for(var key in _this.state.invertMidPriceUsd){
          if (_this.state.invertMidPrice[key] != null) {
            _this.state.invertMidPriceUsd[key] = wethInfo[0].current_price * _this.state.invertMidPrice[key];
          }
        }
      });
  }

  getPair = async (tokenAddr, tokenName) => {
    const {chainId} = this.state;
    try {
      tokenAddr = utils.toChecksumAddress(tokenAddr);
      const token = await Fetcher.fetchTokenData(chainId, tokenAddr, this.state.provider, tokenName, '');
      const pair = await Fetcher.fetchPairData(token, this.state.weth, this.state.provider);
      return pair;
    } catch (error) {
      Message.error({
        title: '查询失败，请检查输入是否正确'
      });
      return null;
    }
  }

  getPrice = (pair) => {
    if (this.state == null) {
      console.log('this.state is null');
      return;
    }
    if (pair == null) {
      console.log('pair is null');
      return;
    }
    const {chainId} = this.state;
    const route = new Route([pair], this.state.weth);

    const midPrice = route.midPrice.toSignificant(6);
    const invertMidPrice = route.midPrice.invert().toSignificant(6);
    const invertMidPriceUsd = this.state.wethPriceUsd * invertMidPrice;

    const trade = new Trade(route, new TokenAmount(this.state.weth, '1000000000000000000'), TradeType.EXACT_INPUT)
    const executionPrice = trade.executionPrice.toSignificant(6); 
    const nextMidPrice = trade.nextMidPrice.toSignificant(6);

    const tokenName = this.getTokenName(pair);
    const tokenAddr = this.getTokenAddr(pair);
    this.state.midPrice[tokenAddr] = midPrice;
    this.state.invertMidPrice[tokenAddr] = invertMidPrice;
    this.state.invertMidPriceUsd[tokenAddr] = invertMidPriceUsd;
    this.state.executionPrice[tokenAddr] = executionPrice;
    this.state.nextMidPrice[tokenAddr] = nextMidPrice;

    console.log(tokenName + '的价格:' + midPrice + ',' + invertMidPrice + ',' + invertMidPriceUsd + ',' + executionPrice + ',' + nextMidPrice);
    this.checkStaredToken(tokenName, tokenAddr, invertMidPriceUsd);
    this.setState({midPrice: this.state.midPrice, 
                   invertMidPrice: this.state.invertMidPrice, 
                   invertMidPriceUsd: this.state.invertMidPriceUsd, 
                   executionPrice: this.state.executionPrice, 
                   nextMidPrice: this.state.nextMidPrice});
  }

  checkStaredToken = (tokenName, tokenAddr, curPrice) => {
    const targetPrice = this.state.targetPrice[tokenAddr];
    if (targetPrice != null) {
      const gasPrice = Math.abs(targetPrice - curPrice);
      const percent = gasPrice / targetPrice;
      if (percent < Percents[this.state.percents[tokenAddr]]) {
        new Notification(tokenName + "当前价格:" + curPrice + ' USD');
        this.state.percents[tokenAddr] = (this.state.percents[tokenAddr] + 1) % Percents.length;
      }
    }
  }

  removePair = (pair) => {
    const restPairs = this.state.watchedPairs.filter(pairItem => this.getTokenName(pairItem) != this.getTokenName(pair));
    const tokenAddr = this.getTokenAddr(pair);
    this.removePairFromLS(tokenAddr);
    this.removeTargetPriceFromLS(tokenAddr);
    this.setState({watchedPairs: restPairs});
  }

  searchPair = () => {
    const {tokenAddr, tokenName} = this.state;
    this.searchCommonPair(tokenAddr, tokenName);
  }

  getTokenName = (pair) => {
    if (pair == null) return;
    const token0Name = pair.tokenAmounts[0].currency.symbol;
    return (token0Name != this.state.weth.symbol) ? token0Name : pair.tokenAmounts[1].currency.symbol; 
  }

  getTokenAddr = (pair) => {
    if (pair == null) return;
    const token0Name = pair.tokenAmounts[0].currency.symbol;
    return (token0Name != this.state.weth.symbol) ? pair.tokenAmounts[0].currency.address : pair.tokenAmounts[1].currency.address; 
  }

  searchCommonPair = async (tokenAddr, tokenName) => {
    const notExist = this.state.watchedPairs.every(pair => this.getTokenAddr(pair).toUpperCase() != tokenAddr.toUpperCase());
    if (!notExist) {
      Message.notice({
        title: '交易对已存在'
      });
      return;
    }

    if (this.state.watchedPairs.length >= 9) {
      Message.warning({title: '请移除已查询的交易对后再继续查询。'});
      return;
    }

    Message.success({
      title: '查询中',
      duration: 10000
    });
    this.setState({tokenAddr, tokenName, preTokenAddr: tokenAddr, preTokenName: tokenName, 
                   //midPrice: {}, invertMidPrice: {}, invertMidPriceUsd: {}, executionPrice: {}, nextMidPrice: {}
                  });
    const pair = await this.getPair(tokenAddr, tokenName);
    if (pair != null) {
      this.getPrice(pair);
      const intervalId = setInterval(() => { 
        console.log('get price of ' + tokenName);
        this.getPair(tokenAddr, tokenName).then(newPairObj => {
          this.getPrice(newPairObj); 
        });
      }, 5000);
      this.state.tokenIntervalId[tokenName] = intervalId;
      this.state.watchedPairs.push(pair);
      this.setState({watchedPairs: this.state.watchedPairs});
      this.savePair2LS(tokenAddr, tokenName);
      Message.hide();
    }
  }

  savePair2LS = (tokenAddr, tokenName) => {
    var watchedPairsInfo = global.localStorage.getItem('watchedPairs');
    if (watchedPairsInfo != null) {
      watchedPairsInfo = JSON.parse(watchedPairsInfo);
      watchedPairsInfo.push({tokenAddr, tokenName});
    } else {
      watchedPairsInfo = [];
      watchedPairsInfo.push({tokenAddr, tokenName});
    }
    global.localStorage.setItem('watchedPairs', JSON.stringify(watchedPairsInfo));
  }

  saveTargetPriceInfo = (tokenAddr, targetPriceInfo) => {
    var targetPriceInfos = global.localStorage.getItem('targetPriceInfos');
    if (targetPriceInfos != null) {
      targetPriceInfos = JSON.parse(targetPriceInfos);
      targetPriceInfos[tokenAddr] = targetPriceInfo;
    } else {
      targetPriceInfos = {};
      targetPriceInfos[tokenAddr] = targetPriceInfo;
    }
    global.localStorage.setItem('targetPriceInfos', JSON.stringify(targetPriceInfos));
  }

  removePairFromLS = (tokenAddr) => {
    var watchedPairsInfo = global.localStorage.getItem('watchedPairs');
    if (watchedPairsInfo != null) {
      watchedPairsInfo = JSON.parse(watchedPairsInfo);
      watchedPairsInfo = watchedPairsInfo.filter(pair => pair.tokenAddr.toUpperCase() != tokenAddr.toUpperCase());
      global.localStorage.setItem('watchedPairs', JSON.stringify(watchedPairsInfo));
    }
  }

  removeTargetPriceFromLS = (tokenAddr) => {
    var targetPriceInfos = global.localStorage.getItem('targetPriceInfos');
    if (targetPriceInfos != null) {
      targetPriceInfos = JSON.parse(targetPriceInfos);
      delete targetPriceInfos[tokenAddr];
      global.localStorage.setItem('targetPriceInfos', JSON.stringify(targetPriceInfos));
    }
  }
  
  onTokenAddrChanged(v) {
    this.setState({tokenAddr: v});
  }

  onPairNameChanged(v) {
    this.setState({tokenName: v});
  }

  handletTargetPriceChange = (v) => {
    const tokenAddr = this.getTokenAddr(this.state.curPair);
    this.state.targetPrice[tokenAddr] = v;
    this.setState({targetPrice: this.state.targetPrice});
  }
  handleFromTokenNumChange = (v) => {
    this.state.swapTokenNum[this.state.fromTokenAddr] = v;

    const midPrice = (this.state.fromTokenAddr.toUpperCase() == this.state.weth.address.toUpperCase()) ? 
                      this.state.midPrice[this.state.toTokenAddr] : this.state.invertMidPrice[this.state.fromTokenAddr];
    this.state.swapTokenNum[this.state.toTokenAddr] = midPrice * v;

    return this.setState({swapTokenNum: this.state.swapTokenNum});
  }
  handleToTokenNumChange = (v) => {
    this.state.swapTokenNum[this.state.toTokenAddr] = v;

    const midPrice = (this.state.toTokenAddr.toUpperCase() == this.state.weth.address.toUpperCase()) ? 
                      this.state.midPrice[this.state.fromTokenAddr] : this.state.invertMidPrice[this.state.toTokenAddr];
    this.state.swapTokenNum[this.state.fromTokenAddr] = midPrice * v;

    return this.setState({swapTokenNum: this.state.swapTokenNum});
  }
  onSetTargetPriceOK = () => {
    const tokenAddr = this.getTokenAddr(this.state.curPair);
    if (this.state.targetPrice[tokenAddr] == null) {
      Message.warning({title: '请输入目标价'});
      return;
    }
    if (this.state.notificationChecked[NotificationType.Desktop][tokenAddr] != true
        && this.state.notificationChecked[NotificationType.Weixin][tokenAddr] != true
        && this.state.notificationChecked[NotificationType.Telegram][tokenAddr] != true) {
        Message.warning({title: '请选择至少一种通知方式'});
        return;
    }
    this.state.percents[tokenAddr] = 0;
    Message.success({title: '设置成功'});
    this.onSetTargetPriceClose();
    const targetPriceInfo = {targetPrice: this.state.targetPrice[tokenAddr],
                             notificationPlatform: {
                              [NotificationType.Desktop]: this.state.notificationChecked[NotificationType.Desktop][tokenAddr],
                              [NotificationType.Weixin]: this.state.notificationChecked[NotificationType.Weixin][tokenAddr],
                              [NotificationType.Telegram]: this.state.notificationChecked[NotificationType.Telegram][tokenAddr]
                            }}
    this.saveTargetPriceInfo(tokenAddr, targetPriceInfo);
    return;
  }


  onSetTargetPriceClose = () => {
    this.setState({starePriceVisible:false});
  }

  onSwapTokenOK = () => {
    this.setState({swapTokenVisible:false});
  }

  onSwapTokenClose = () => {
    this.setState({swapTokenVisible:false});
  }

  fromTokenName = () => {
    return this.state.fromToken;
  }

  toTokenName = () => {
    this.state.toToken = this.state.curTokenName;
    return this.state.toToken;
  }

  swapTokenName = () => {
    const {fromToken, toToken, fromTokenAddr, toTokenAddr} = this.state;
    const fromTokenName = fromToken;
    const toTokenName = toToken;
    const preFromTokenAddr = fromTokenAddr;
    const preToTokenAddr = toTokenAddr;
    this.setState({fromToken: toTokenName, toToken: fromTokenName, fromTokenAddr: preToTokenAddr, toTokenAddr: preFromTokenAddr});
  }

  addDesktopNotice = (checked) => {
    const tokenAddr = this.getTokenAddr(this.state.curPair);
    this.state.notificationChecked[NotificationType.Desktop][tokenAddr] = checked;
    if (window.Notification) {
      if (Notification.permission !== "granted") {
        Notification.requestPermission(function (status) {
          if (status === "granted") {
              var n = new Notification("授权成功");
           } else {
              Message.notice({
                title: '未通过授权，您将无法收到桌面通知。'
              });
           }
        });
      } else {
        //var notification = new Notification("价格提醒", {body: 'UNI当前价格：4.5 USD', requireInteraction: true});
      }
    } else {
      Message.notice({
        title: '浏览器不支持通知，请换用Chrome、Firefox或Safari等支持的浏览器。'
      });
    }
  }
  addWeixinNotice = (checked) => {
    const tokenAddr = this.getTokenAddr(this.state.curPair);
    this.state.notificationChecked[NotificationType.Weixin][tokenAddr] = checked;
  }
  addTelegramNotice = (checked) => {
    const tokenAddr = this.getTokenAddr(this.state.curPair);
    this.state.notificationChecked[NotificationType.Telegram][tokenAddr] = checked;
  }
  tokenSelector = () => {
                  return (<Select aria-label="please select" >
                            <option value="https">https</option>
                            <option value="http">http</option>
                          </Select>);
                  }
  render() {
    return (
      <div className={styles.container}>
        <img src={logo} className={styles.applogo} alt="logo" />
        <p style={{fontSize: '30px'}}>
          SwapUni机器人，您的Uniswap交易管家
        </p>
        <p style={{fontSize: '20px', color: '#84A8D7'}}>
          定制交易对  帮您盯价  为您下单
        </p>
        <Row align='center' style={{marginBottom: '20px'}}>
          代币名称:<Input value={this.state.tokenName} onChange={this.onPairNameChanged.bind(this)} style={{height: '30px', width: '100px', margin: '0 20px 0 10px'}}/> 
        </Row>
        <Row align='center'>
          代币地址: 
          <Input value={this.state.tokenAddr} onChange={this.onTokenAddrChanged.bind(this)} style={{height: '30px', width: '500px', margin: '0 20px 0 10px'}}/> 
          <Button type='normal' onClick={this.searchPair.bind(this)} style={{marginRight: '20px'}}>查询ETH交易对</Button>
        </Row>
        <Row align='center' style={{marginTop: '10px'}}>
          常用交易对:
          <Button text type='normal' style={{margin: '0 10px 0 10px'}} onClick={() => this.searchCommonPair('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', 'WBTC')}>WBTC-ETH</Button>
          <Button text type='normal' style={{marginRight: '10px'}} onClick={() => this.searchCommonPair('0xdac17f958d2ee523a2206206994597c13d831ec7', 'USDT')}>USDT-ETH</Button>
          <Button text type='normal' style={{marginRight: '10px'}} onClick={() => this.searchCommonPair('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'USDC')}>USDC-ETH</Button>
          <Button text type='normal' style={{marginRight: '10px'}} onClick={() => this.searchCommonPair('0x6b175474e89094c44da98b954eedeac495271d0f', 'DAI')}>DAI-ETH</Button>
          <Button text type='normal' style={{marginRight: '10px'}} onClick={() => this.searchCommonPair('0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', 'UNI')}>UNI-ETH</Button>
          <Button text type='normal' style={{marginRight: '10px'}} onClick={() => this.searchCommonPair('0x429881672b9ae42b8eba0e26cd9c73711b891ca5', 'PICKLE')}>PICKLE-ETH</Button>
          <Button text type='normal' style={{marginRight: '10px'}} onClick={() => this.searchCommonPair('0x62359ed7505efc61ff1d56fef82158ccaffa23d7', 'CORE')}>CORE-ETH</Button>
          <Button text type='normal' style={{marginRight: '10px'}} onClick={() => this.searchCommonPair('0xd46ba6d942050d489dbd938a2c909a5d5039a161', 'AMPL')}>AMPL-ETH</Button>
          <Button text type='normal' style={{marginRight: '10px'}} onClick={() => this.searchCommonPair('0x05d3606d5c81eb9b7b18530995ec9b29da05faba', 'TOMOE')}>TOMOE-ETH</Button>
        </Row>
        <Row align='center' style={{marginTop: '10px'}}>
          创新交易对:
          <Button text type='normal' style={{margin: '0 10px 0 10px'}} onClick={() => this.searchCommonPair('0x3d79abddfa55e7423e9ed3cb5876e66da214d6ff', 'OEX')}>OEX-ETH</Button>
          <Button text type='normal' style={{margin: '0 10px 0 10px'}} onClick={() => this.searchCommonPair('0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', 'SUSHI')}>SUSHI-ETH</Button>
        </Row>
        <Row align='center' style={{marginTop: '10px'}}>
          1 ETH = {this.state.wethPriceUsd == null ? '? USD' : this.state.wethPriceUsd + ' USD'}
        </Row>
        <Box wrap padding={20} margin={[20, 20]} direction="row" align="center" justify='center'>
            {this.state.watchedPairs.map(pair => {
              if (pair == null) return;
              const tokenName = this.getTokenName(pair);
              const tokenAddr = this.getTokenAddr(pair);
              const pairName = tokenName + '-ETH';
              const pairAddr = pair.liquidityToken.address;
              const commonProps = {
                extra: <a href={'https://uniswap.info/pair/' + pairAddr} target='_blank'>uniswap.info</a>
              };
              const midPrice = this.state.midPrice[tokenAddr];
              const invertMidPrice = this.state.invertMidPrice[tokenAddr];
              const invertMidPriceUsd = this.state.invertMidPriceUsd[tokenAddr];
              const executionPrice = this.state.executionPrice[tokenAddr];
              const nextMidPrice = this.state.nextMidPrice[tokenAddr];
              const removePair = () => {
                clearInterval(this.state.tokenIntervalId[tokenName]);
                this.removePair(pair);
              }
              const starePrice = (pair) => {
                this.state.curPair = pair;
                this.state.curTokenAddr = this.getTokenAddr(pair);
                this.setState({starePriceVisible: true});
              }

              const swapToken = (pair) => {
                this.state.curPair = pair;
                this.state.curTokenAddr = this.getTokenAddr(pair);
                this.state.curTokenName = this.getTokenName(pair);
                this.state.fromToken = 'ETH';
                this.state.toToken = this.state.curTokenName;
                this.state.toTokenAddr = this.state.curTokenAddr;
                this.setState({swapTokenVisible: true});

                // const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18)
                // const pair = await Fetcher.fetchPairData(DAI, WETH[DAI.chainId])
                // const route = new Route([pair], WETH[DAI.chainId])
                // const amountIn = '1000000000000000000' // 1 WETH
                // const trade = new Trade(route, new TokenAmount(WETH[DAI.chainId], amountIn), TradeType.EXACT_INPUT)
                // console.log(TradeType.EXACT_INPUT)
                // const slippageTolerance = new Percent('50', '10000') // 50 bips, or 0.50%
                // const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw // needs to be converted to e.g. hex
                // const path = [WETH[DAI.chainId].address, DAI.address]
                // const to = '' // should be a checksummed recipient address
                // const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time
                // const value = trade.inputAmount.raw // // needs to be converted to e.g. hex
                // console.log(value)
              }
              return (
                <Card key={tokenName} free style={{width: 400, background: '#fffff0', border: '2px solid #ffffff'}}>
                  <Card.Header title={pairName} {...commonProps} />
                  <Card.Content>
                    <p>
                      1 ETH = {midPrice == null ? '? ' : midPrice + ' '} {tokenName}
                    </p>
                    <p>
                      1 {tokenName} = {invertMidPrice == null ? '?' : invertMidPrice} ETH =  {invertMidPriceUsd == null ? ' ? USD' : ' ' + invertMidPriceUsd + ' USD'}
                    </p>
                    <p>
                      实际兑换 1 ETH 可获得 {executionPrice == null ? '?' : executionPrice} 个{tokenName}
                    </p>
                    <p>
                      执行兑换后 1 ETH = {nextMidPrice == null ? '?' : nextMidPrice} 个{tokenName}
                    </p>
                  </Card.Content>
                  <Card.Actions>
                    <Button type="primary" key="action1" text onClick={() => removePair()}>移除本交易对</Button>
                    <Button type="primary" key="action2" text onClick={() => starePrice(pair)}>帮您盯价</Button>
                    <Button type="primary" key="action3" text onClick={() => swapToken(pair)}>兑换</Button>
                  </Card.Actions>
                </Card>
              )
            })}
        </Box>
        <Dialog
          visible={this.state.starePriceVisible}
          title={this.getTokenName(this.state.curPair) + "目标价格设置"}
          closeable="true"
          footerAlign="center"
          onOk={this.onSetTargetPriceOK.bind(this)}
          onCancel={this.onSetTargetPriceClose.bind(this)}
          onClose={this.onSetTargetPriceClose.bind(this)}
        >
          <Input hasClear
            value={this.state.targetPrice[this.state.curTokenAddr]}
            onChange={this.handletTargetPriceChange.bind(this)}
            onPressEnter={this.onSetTargetPriceOK.bind(this)}
            style={{ width: 300 }}
            addonTextBefore='目标价'
            addonTextAfter='USD'
            size="medium"
          />
          <p>
            距离目标价5%、3%和1%时，将进行提醒
          </p>
          <p>
            (提醒功能皆基于本网页触发，关闭本网页将失效)
          </p>
          <p>
            <Checkbox checked={this.state.notificationChecked[NotificationType.Desktop][this.state.curTokenAddr]} onChange={this.addDesktopNotice.bind(this)} >桌面提醒</Checkbox>
          </p>
          <p>
            <Checkbox checked={this.state.notificationChecked[NotificationType.Weixin][this.state.curTokenAddr]} disabled onChange={this.addWeixinNotice.bind(this)} >微信公众号提醒（敬请期待）</Checkbox>
          </p>
          <p>
            <Checkbox checked={this.state.notificationChecked[NotificationType.Telegram][this.state.curTokenAddr]} disabled onChange={this.addTelegramNotice.bind(this)} >电报机器人提醒（敬请期待）</Checkbox>
          </p>
        </Dialog>

        <Dialog
          visible={this.state.swapTokenVisible}
          title={this.getTokenName(this.state.curPair) + "-ETH兑换页"}
          closeable="true"
          footerAlign="center"
          onOk={this.onSwapTokenOK.bind(this)}
          onCancel={this.onSwapTokenClose.bind(this)}
          onClose={this.onSwapTokenClose.bind(this)}
        >
          <Input hasClear
            value={this.state.swapTokenNum[this.state.fromTokenAddr]}
            onChange={this.handleFromTokenNumChange.bind(this)}
            style={{ width: 300 }}
            addonTextBefore='用'
            addonTextAfter={this.state.fromToken}
            size="medium"
          />
          <p>
            <Button text onClick={this.swapTokenName.bind(this)}>
               <Icon type='sorting' size="large"></Icon>
            </Button>
          </p>
          <Input hasClear
            value={this.state.swapTokenNum[this.state.toTokenAddr]}
            onChange={this.handleToTokenNumChange.bind(this)}
            style={{ width: 300 }}
            addonTextBefore='兑换'
            addonTextAfter={this.state.toToken}
            size="medium"
          />
          
        </Dialog>
        <Loading tip="加载中..." visible={this.state.loadingVisible}>
        </Loading>
    </div>
    );
  }
}

