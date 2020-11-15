import React, { Component } from 'react';
import { Grid, Button, Dialog, Input } from '@alifd/next';
import { Link } from 'react-router-dom';
import styles from './index.module.scss';

const { Row, Col } = Grid;

export default class BrandDisplay extends Component {
  // const [isMobile, setMobile] = useState(false);
  // const [creatRobotVisible, setCreatRobotVisible] = useState(false);
  // const [creatSkillVisible, setCreatSkillVisible] = useState(false);
  // const [creatEquipmentVisible, setCreatEquipmentVisible] = useState(false);
  constructor(props) {
    super(props);
    this.state = {
        web3: null,
        masterChef: null,
        curAccount: '',
        watchedPairs: [],
        erc20AddrName: {},
        ectToken: 0,
        maxSkillNum: 0,
        maxEquipmentNum: 0,
        creatRobotVisible: false,
        creatSkillVisible: false,
    };

  }

  render() {
  return (
    <div className={styles.container}>
      <div className={styles.brandHeader}>
        <h5 className={styles.brandTitle}>我的资产</h5>
      </div>
      <div className={styles.brandHeader}>
        <h5 className={styles.brandContent}>机器人数量：10</h5>
        <Button primary onClick={() => this.setState({creatRobotVisible: true})}>创建新机器人</Button>
      </div>
      <div className={styles.brandHeader}>
        <h5 className={styles.brandContent}>技能数：100</h5>
        <Button primary>创建新技能</Button>
      </div>
      <div className={styles.brandHeader}>
        <h5 className={styles.brandContent}>装备数：20</h5>
      </div>
      <Dialog
          visible={this.state.creatRobotVisible}
          title="创建机器人"
          closeable="true"
          footerAlign="center"
          onCancel={() => this.setState({creatRobotVisible: false})}
          onClose={() => this.setState({creatRobotVisible: false})}
        >
          <Input hasClear
            style={{ width: 300 }}
            addonTextBefore='等级'
            size="medium"
            onChange={(v) => this.setState({ectToken: v * 6, maxSkillNum: v * 2, maxEquipmentNum: v * 3})}
          />
          <p>预计消耗：{this.state.ectToken}ECT</p>
          <p>最多附加技能数：{this.state.maxSkillNum}</p>
          <p>最多附加装备数：{this.state.maxEquipmentNum}</p>
        </Dialog>
    </div>
    );
  }
}