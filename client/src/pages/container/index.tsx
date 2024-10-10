import { useMemo, useRef, useState } from 'react';
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
import ChangePerInfoModal from '@/components/ChangePerInfoModal';
import { ICallReceiverInfo } from '@/components/AudioModal/type';
import AudioModal from '@/components/AudioModal';
import { wsBaseURL } from '@/config';
import { IChatRef } from './type';
import { IFriendInfo, IGroupChatInfo } from '../address-book/type';
const Container = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const showMessage = useShowMessage();
  const user = JSON.parse(userStorage.getItem());
  const [forgetModal, setForgetModal] = useState(false);
  const [infoModal, setInfoModal] = useState(false);
  const [audioModal, setAudioModal] = useState(false);
  const [videoModal, setVideoModal] = useState(false);
  // 音视频通话列表
  const [callReceiverList, setCallReceiverList] = useState<ICallReceiverInfo[]>([]);
  // 当前音视频通话模式
  const [curMode, setCurMode] = useState<string>('');
  // 当前音视频通话房间号
  const [room, setRoom] = useState<string>('');
  // 聊天列表组件实例
  const chatRef = useRef<IChatRef>(null);
  // 初始化选中的聊天对象
  const [initSelectedChat, setInitSelectedChat] = useState<IFriendInfo | IGroupChatInfo | null>(
    null
  );
  // websocket实例
  const socket = useRef<WebSocket | null>(null);
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
  // 在通讯录界面选择一个好友或者群聊进行发送消息时跳转到聊天界面
  const handleChooseChat = (item: IFriendInfo | IGroupChatInfo) => {
    navigate('/chat');
    setInitSelectedChat(item);
  };
  const confirmLogout = async () => {
    try {
      const res = await handleLogout(user);
      if (res.code === HttpStatus.SUCCESS) {
        showMessage('success', '退出成功');
        // 关闭websocket连接
        if (socket.current !== null) {
          socket.current.close();
          socket.current = null;
        }
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
          <Button size="small" onClick={() => handleForgetModal(true)}>
            修改密码
          </Button>
          <Button size="small" onClick={() => handleInfoModal(true)}>
            修改信息
          </Button>
        </div>
      </div>
    );
  };

  // 进入主页面，初始化websocket连接（一旦用户上线了，就有可能接收到他人发送的消息和音视频聊天邀请）
  const initSocket = () => {
    const ws = new WebSocket(`${wsBaseURL}/auth/user_channel?username=${user.username}`);
    ws.onmessage = e => {
      const message = JSON.parse(e.data);
      switch (message.name) {
        case 'friendList':
        // 重新加载好友列表
        case 'groupChatList':
        case 'chatList':
          // 重新加载消息列表
          chatRef.current?.refreshChatList();
          break;
        case 'create_room':
          // 打开响应音视频通话窗口
          try {
            const { callReceiverList, room, mode } = message;
            setCallReceiverList(callReceiverList);
            setRoom(room);
            setCurMode(mode);
            // 区分是音频还是视频
            if (mode.includes('audio')) setAudioModal(true);
            else setVideoModal(true);
          } catch {
            showMessage('error', '音视频通话响应失败');
          }
          break;
      }
    };
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
            <Chat initSelectedChat={initSelectedChat} ref={chatRef} />
          ) : currentPath === '/address-book' ? (
            <AddressBook />
          ) : null}
        </div>
      </div>
      {forgetModal && <ChangePwdModal openmodal={forgetModal} handleModal={handleForgetModal} />}
      {infoModal && <ChangePerInfoModal openmodal={infoModal} handleModal={handleInfoModal} />}
      {audioModal && callReceiverList.length && (
        <AudioModal
          openmodal={audioModal}
          handleModal={handleAudioModal}
          status="receive"
          type={curMode.includes('private') ? 'private' : 'group'}
          callInfo={{
            room,
            callReceiverList
          }}
        ></AudioModal>
      )}
    </div>
  );
};

export default Container;
