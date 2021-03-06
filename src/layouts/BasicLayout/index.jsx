import React, { useState } from 'react';
import { Shell, ConfigProvider, Button, Message } from '@alifd/next';
import PageNav from './components/PageNav';
import Logo from './components/Logo';
import Footer from './components/Footer';
import logo from './logo.png';

(function () {
  const throttle = function (type, name, obj = window) {
    let running = false;

    const func = () => {
      if (running) {
        return;
      }

      running = true;
      requestAnimationFrame(() => {
        obj.dispatchEvent(new CustomEvent(name));
        running = false;
      });
    };

    obj.addEventListener(type, func);
  };

  if (typeof window !== 'undefined') {
    throttle('resize', 'optimizedResize');
  }
})();

export default function BasicLayout({ children }) {
  const getDevice = (width) => {
    const isPhone =
      typeof navigator !== 'undefined' && navigator && navigator.userAgent.match(/phone/gi);

    if (width < 680 || isPhone) {
      return 'phone';
    } else if (width < 1280 && width > 680) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  };

  const [device, setDevice] = useState(getDevice(NaN));
  const [account, setAccount] = useState("0x...");
  const [btnLabel, setBtnLabel] = useState("Connect MetaMask");

  if (typeof window !== 'undefined') {
    window.addEventListener('optimizedResize', (e) => {
      const deviceWidth = (e && e.target && e.target.innerWidth) || NaN;
      setDevice(getDevice(deviceWidth));
    });
  }

  const connectMetamask = async () => {
    if (typeof window.ethereum === 'undefined') {
      Message.error('MetaMask尚未安装!');
      return;
    }
    console.log('开始连接Metamask!');
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    Message.success('已连接MetaMask!');
    setAccount(accounts[0]);
    setBtnLabel('Connected to MetaMask');
  }

  return (
    <ConfigProvider device={device}>
      <Shell
        type="dark"
        style={{
          minHeight: '100vh',
        }}
      >
        <Shell.Branding>
          <Logo
            //image={logo}
            text="未来世界"
          />
        </Shell.Branding>
        <Shell.Navigation
          direction="hoz"
          style={{
            marginRight: 10,
          }}
        ></Shell.Navigation>
        <Shell.Action>
          <span style={{marginRight: 10, color: '#ffffff'}}>{account}</span>
          <Button type='primary' onClick={() => connectMetamask()}>{btnLabel}</Button>
        </Shell.Action>
        <Shell.Navigation>
          <PageNav />
        </Shell.Navigation>

        <Shell.Content>{children}</Shell.Content>
        <Shell.Footer>
          <Footer />
        </Shell.Footer>
      </Shell>
    </ConfigProvider>
  );
}
