import { forwardRef, useEffect, useRef, useState } from 'react';
import styles from './index.module.less';
import SearchContainer from '@/components/SearchContainer';
import { IChatListProps, IConnectParams, IMessageListItem } from './type';
import { getChatList } from './api';
import { HttpStatus } from '@/utils/constant';
import useShowMessage from '@/hooks/useShowMessage';
import ImageLoad from '@/components/ImageLoad';
import { StatusIconList } from '@/assets/icons';
import { Input, Tooltip } from 'antd';
import { WechatOutlined } from '@ant-design/icons';
import { IFriendInfo, IGroupChatInfo } from '../address-book/type';
import { userStorage } from '@/utils/storage';
import { wsBaseURL } from '@/config';
import { IMessageItem } from '@/components/MessageShow/type';
import Container from '../container';
import ChatContainer from '@/components/ChatContainer';
import ChatTool from '@/components/ChatTool';
import { ISendMessage } from '@/components/ChatTool/type';
import { formatChatListTime } from '@/utils/time';

// 判断当前的聊天是否为群聊
const isGroupChat = (item: IMessageListItem) => {
  return !item.receiver_username;
};

// 自定义类型保护，用于判断是否为IFriendInfo类型或IGroupChatInfo类型
const isFriendInfo = (chatInfo: IFriendInfo | IGroupChatInfo): chatInfo is IFriendInfo => {
  return (chatInfo as IFriendInfo).friend_id !== undefined;
};
const Chat = forwardRef((props: IChatListProps, ref) => {
  const { initSelectedChat } = props;
  const user = JSON.parse(userStorage.getItem());
  const showMessage = useShowMessage();
  const [chatList, setChatList] = useState<IMessageListItem[]>([]);
  // websocket 实例
  const socket = useRef<WebSocket | null>(null);
  // 当前选中的对话信息
  const [curChatInfo, setCurChatInfo] = useState<IMessageListItem>();
  const [historyMsg, setHistoryMsg] = useState<IMessageItem[]>([]);
  const [newMessage, setNewMessage] = useState<IMessageItem[]>([]);
  // 刷新消息列表
  const refreshChatList = async () => {
    try {
      const res = await getChatList();
      if (res.code === HttpStatus.SUCCESS) setChatList(res.data);
      else showMessage('error', '获取消息列表失败');
    } catch {
      showMessage('error', '获取消息列表失败');
    }
  };
  // 进入聊天房间时建立websocket连接
  const initSocket = (connectParams: IConnectParams) => {
    // 如果连接已存在，则重新建立连接
    if (socket.current !== null) {
      socket.current.close();
      socket.current = null;
    }
    const ws = new WebSocket(
      `${wsBaseURL}/message/connect_chat?room=${connectParams.room}&id=${connectParams.sender_id}&type=${connectParams.type}`
    );
    // 获取消息记录
    ws.onmessage = e => {
      const message = JSON.parse(e.data);
      // 判断返回的信息是历史消息数组还是单条消息
      if (Array.isArray(message)) {
        setHistoryMsg(message);
        return;
      } else {
        // 单条消息则说明是最新消息
        setNewMessage(preMsg => [...preMsg, message]);
      }
    };
    ws.onerror = () => {
      showMessage('error', 'websocket连接失败');
    };
    socket.current = ws;
  };
  const chooseRoom = (item: IMessageListItem) => {
    setHistoryMsg([]);
    setNewMessage([]);
    setCurChatInfo(item);
    const params: IConnectParams = {
      room: item.room,
      sender_id: user.id,
      type: isGroupChat(item) ? 'group' : 'private'
    };
    initSocket(params);
    refreshChatList();
  };
  const init = async () => {
    await refreshChatList();
    // 如果有初始选中的聊天室，则选中且建立连接
    if (initSelectedChat) {
      // 等待获取消息列表后再进行操作
      const updatedChatList = (await getChatList()).data;
      const targetIndex = updatedChatList.findIndex(item => item.room === initSelectedChat.room);
      // 如果列表中存在该聊天室，则选中，否则造一个假的用于发送消息
      if (targetIndex > -1) {
        const initChatInfo = updatedChatList.splice(targetIndex, 1)[0];
        setCurChatInfo(initChatInfo);
      } else {
        let newMessage = {
          receiver_id: 0,
          name: '',
          room: initSelectedChat.room,
          updated_at: new Date(),
          unreadCount: 0,
          lastMessage: '暂无消息记录',
          type: 'text',
          avatar: initSelectedChat.avatar
        };
        // 如果是私聊
        if (isFriendInfo(initSelectedChat)) {
          newMessage = Object.assign(newMessage, {
            receiver_id: initSelectedChat.friend_user_id,
            name: initSelectedChat.remark,
            receiver_name: initSelectedChat.username
          });
        } else {
          // 如果是群聊
          newMessage = Object.assign(newMessage, {
            receiver_id: initSelectedChat.id,
            name: initSelectedChat.name
          });
        }
        setChatList([newMessage, ...updatedChatList]);
        setCurChatInfo(newMessage);
      }
      const params: IConnectParams = {
        room: initSelectedChat.room,
        sender_id: user.id,
        type: isFriendInfo(initSelectedChat) ? 'private' : 'group'
      };
      initSocket(params);
    }
  };
  const sendMessage = (message: ISendMessage) => {
    socket.current?.send(JSON.stringify(message));
    refreshChatList();
  };
  useEffect(() => {
    init();
    // 组件卸载时关闭 websocket 连接
    return () => {
      socket.current?.close();
    };
  }, []);
  return (
    <div className={styles.chatList}>
      <div className={styles.leftContainer}>
        <div className={styles.search}>
          <SearchContainer />
        </div>
        <div className={styles.list}>
          {chatList.length === 0 ? (
            <div className={styles.chat_none}>暂无消息记录</div>
          ) : (
            chatList.map(item => (
              <div
                className={styles.chat_item}
                key={item.room}
                id={`chatList_${item.room}`}
                onClick={e => {
                  chooseRoom(item);
                }}
                style={{
                  backgroundColor: curChatInfo?.room === item.room ? 'rgba(0, 0, 0, 0.08)' : ''
                }}
              >
                <div className={styles.chat_avatar}>
                  <ImageLoad src={item.avatar} />
                </div>
                <div className={styles.chat_info}>
                  <div className={styles.chat_name}>
                    <span>{item.name}</span>
                    {isGroupChat(item) && (
                      <span
                        className={`icn iconfont icon-jinqunliaoliao ${styles.group_icon}`}
                      ></span>
                    )}
                  </div>
                  <div className={styles.chat_message}>
                    {item.type === 'text'
                      ? item.lastMessage
                      : item.type === 'image'
                        ? '[图片]'
                        : item.type === 'video'
                          ? '[视频]'
                          : item.type === 'file'
                            ? '[文件]'
                            : null}
                  </div>
                </div>
                <div className={styles.chat_info_time}>
                  <div className={styles.chat_time}>{formatChatListTime(item.updated_at)}</div>
                  <Tooltip placement="bottomLeft" title={`未读消息${item.unreadCount}条`}>
                    <div className={`iconfont ${StatusIconList[2].icon} ${styles.chat_unread}`}>
                      <span>{item.unreadCount}</span>
                    </div>
                  </Tooltip>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className={styles.rightContainer}>
        {!curChatInfo ? (
          <div className={styles.chatNone}>
            <WechatOutlined style={{ fontSize: '3rem', color: '#aaa' }} />
          </div>
        ) : (
          <div className={styles.chat_window}>
            <div className={styles.chat_receiver}>
              <span>{curChatInfo.name}</span>
              {isGroupChat(curChatInfo) && (
                <span className={`icon iconfont icon-jinqunliaoliao ${styles.group_icon}`}></span>
              )}
            </div>
            <div className={styles.chat_content}>
              <ChatContainer historyMsg={historyMsg} newMsg={newMessage} />
            </div>
            <div className={styles.chat_input}>
              <ChatTool curChatInfo={curChatInfo} sendMessage={sendMessage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default Chat;
