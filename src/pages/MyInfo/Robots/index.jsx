import React, { Component } from 'react';
import { Grid, Button, Dialog, Input } from '@alifd/next';
import { Link } from 'react-router-dom';
import styles from './index.module.scss';

const { Row, Col } = Grid;

export default class MyRobots extends Component {
  // const [isMobile, setMobile] = useState(false);
  // const [creatRobotVisible, setCreatRobotVisible] = useState(false);
  // const [creatSkillVisible, setCreatSkillVisible] = useState(false);
  // const [creatEquipmentVisible, setCreatEquipmentVisible] = useState(false);
  constructor(props) {
    super(props);
    this.state = {
        number: 10,
    };

  }

  render() {
  return (
    <div>
      
    </div>
    );
  }
}