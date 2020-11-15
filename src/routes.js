import BasicLayout from '@/layouts/BasicLayout';
import Dashboard from '@/pages/Dashboard';
import Miner from '@/pages/Miner';

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
        path: '/',
        component: Miner,
      },
    ],
  },
];
export default routerConfig;
