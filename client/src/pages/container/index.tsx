import { useMemo, useState } from 'react';
import styles from './index.module.less';
import { MenuIconList } from '@/assets/icons';
import { Button, Popover, Tooltip } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { handleLogout } from '@/utils/logout';
import { userStorage } from '@/utils/storage';
import { HttpStatus } from '@/utils/constant';
import useShowMessage from '@/hooks/useShowMessage';
import AddressBook from '../address-book';
import Chat from '../chat';
import ImageLoad from '@/components/ImageLoad';
import ChangePwdModal from '@/components/ChangePwdModal';
const Container = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const showMessage = useShowMessage();
  const user = JSON.parse(userStorage.getItem());
  const [forgetModal, setForgetModal] = useState(false);
  const [infoModal, setInfoModal] = useState(false);
  const [audioModal, setAudioModal] = useState(false);
  const [videoModal, setVideoModal] = useState(false);

  const currentPath = useMemo(() => {
    if (location.pathname === '/') return '/chat';
    return location.pathname;
  }, [location]);
  const handleMenuClick = (to: string) => {
    navigate(to);
  };
  const handleForgetModal = (visible: boolean) => {
    setForgetModal(visible);
  };
  const handleInfoModal = (visible: boolean) => {
    setInfoModal(visible);
  };
  const handleAudioModal = (visible: boolean) => {
    setAudioModal(visible);
  };
  const handleVideoModal = (visible: boolean) => {
    setVideoModal(visible);
  };
  const confirmLogout = async () => {
    try {
      const res = await handleLogout(user);
      if (res.code === HttpStatus.SUCCESS) {
        showMessage('success', '退出成功');
        navigate('/login');
      } else showMessage('error', '退出失败，请重试');
    } catch {
      showMessage('error', '退出失败，请重试');
    }
  };
  const InfoContent = () => {
    const user = JSON.parse(userStorage.getItem());
    return (
      <div className={styles.infoContent}>
        <div className={styles.infoContainer}>
          <div className={styles.avatar}>
            <ImageLoad src={user.avatar} />
          </div>
          <div className={styles.info}>
            <div className={styles.name}>{user.name}</div>
            <div className={styles.phone}> 手机号：{user.phone}</div>
            <div className={styles.signature}>
              {user.signature === '' ? '暂无个性签名' : user.signature}
            </div>
          </div>
        </div>
        <div className={styles.btnContainer}>
          <Button size="small">修改密码</Button>
          <Button size="small">修改信息</Button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.parentContainer}>
      <div className={styles.container}>
        <div className={styles.left}>
          <Popover content={InfoContent} placement="rightTop">
            <div className={styles.avatar}>
              <ImageLoad src={user.avatar} />
            </div>
          </Popover>
          <div className={styles.iconList}>
            <ul className={styles.topIcons}>
              {MenuIconList.slice(0, 5).map(item => {
                return (
                  <Tooltip
                    key={`iconfont ${item.text}`}
                    placement="bottomLeft"
                    title={item.text}
                    arrow={false}
                  >
                    <li
                      className={`iconfont ${item.icon}`}
                      style={{
                        color: currentPath === item.to ? '#07c160' : '#979797'
                      }}
                      onClick={() => item.to && handleMenuClick(item.to)}
                    ></li>
                  </Tooltip>
                );
              })}
            </ul>
            <ul className={styles.bottomIcons}>
              {MenuIconList.slice(5, 8).map(item => {
                return (
                  <Tooltip key={item.text} placement="bottomLeft" title={item.text} arrow={false}>
                    <li
                      className={`iconfont ${item.icon}`}
                      style={{
                        color: currentPath === item.to ? '#07c160' : '#979797'
                      }}
                      onClick={() => {
                        if (item.text === '退出登录') confirmLogout();
                        else item.to && handleMenuClick(item.to);
                      }}
                    ></li>
                  </Tooltip>
                );
              })}
            </ul>
          </div>
        </div>
        <div className={styles.right}>
          {currentPath === '/chat' ? (
            <Chat />
          ) : currentPath === '/address-book' ? (
            <AddressBook />
          ) : null}
        </div>
      </div>
      {forgetModal && (
        <ChangePwdModal openmodal={forgetModal} handleModal={() => handleForgetModal} />
      )}
    </div>
  );
};

export default Container;
