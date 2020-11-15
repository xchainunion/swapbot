import BasicLayout from '@/layouts/BasicLayout';
import Dashboard from '@/pages/Dashboard';
import Miner from '@/pages/Miner';
import MyInfo from '@/pages/MyInfo';

const routerConfig = [
  {
    path: '/',
    component: BasicLayout,
    children: [
      {
        path: '/uniswapbot',
        component: Dashboard,
      },
      {
        path: '/baseInfo',
        component: MyInfo,
      },
      {
        path: '/',
        component: Miner,
      },
    ],
  },
];
export default routerConfig;
