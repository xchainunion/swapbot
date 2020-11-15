const headerMenuConfig = [];
const asideMenuConfig = [
  {
  name: '交易市场',
  icon: 'smile',
  children: [
    {
      name: '机器人',
      path: '/',
      icon: 'smile',
    },
    {
      name: '技能',
      path: '/aaa',
      icon: 'smile',
    },
    {
      name: '装备',
      path: '/bbb',
      icon: 'smile',
    }
  ]
  },
  {
    name: '挖矿/分红',
    icon: 'smile',
    children: [
      {
        name: '挖原石',
        path: '/miner',
        icon: 'smile',
      },
      {
        name: '手续费分红',
        path: '/ddd',
        icon: 'smile',
      },
    ]
  },
  {
    name: '技能列表',
    icon: 'smile',
    children: [
      {
        name: 'Uniswap盯价机器人',
        path: '/uniswapbot',
        icon: 'smile',
      },
      {
        name: '足球机器人',
        path: '/eee',
        icon: 'smile',
      },
    ]
  },
  {
    name: '我的',
    icon: 'smile',
    children: [
      {
        name: '基本信息',
        path: '/ffff',
        icon: 'smile',
      },
      {
        name: '机器人',
        path: '/fff',
        icon: 'smile',
      },
      {
        name: '技能',
        path: '/ggg',
        icon: 'smile',
      },
      {
        name: '装备',
        path: '/hhh',
        icon: 'smile',
      },
    ]
  },
  
];
export { headerMenuConfig, asideMenuConfig };
