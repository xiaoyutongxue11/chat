import { useEffect, useRef, useState } from 'react';
import styles from './index.module.less';
import SearchContainer from '@/components/SearchContainer';
import { IMessageListItem } from './type';
import { getChatList } from './api';
import { HttpStatus } from '@/utils/constant';
import useShowMessage from '@/hooks/useShowMessage';
import ImageLoad from '@/components/ImageLoad';
import { StatusIconList } from '@/assets/icons';
import { Tooltip } from 'antd';

const Chat = () => {
  const showMessage = useShowMessage();
  const [chatList, setChatList] = useState<IMessageListItem[]>([]);
  // websocket 实例
  const socket = useRef<WebSocket | null>(null);

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
  const init = async () => {
    await refreshChatList();
  };
  useEffect(() => {
    // init();
    // 组件卸载时关闭 websocket 连接
    return () => {
      socket.current?.close();
    };
  });
  return (
    <div className={styles.chatList}>
      <div className={styles.leftContainer}>
        <div className={styles.search}>
          <SearchContainer />
        </div>
        <div className={styles.list}>
          {chatList.length !== 0 ? (
            <div className={styles.chat_none}>暂无消息记录</div>
          ) : (
            <div className={styles.chat_item}>
              <div className={styles.chat_avatar}>
                {/* <ImageLoad src="" /> */}
                <img src="" alt="avatar" />
              </div>
              <div className={styles.chat_info}>
                <div className={styles.chat_name}>
                  <span>item.name</span>
                  <span className={`icn iconfont icon-jinqunliaoliao ${styles.group_icon}`}></span>
                </div>
                <div className={styles.chat_message}>
                  哈喽~反馈给叫了个鸡受力钢筋来挂机了搜嘎登记
                </div>
              </div>
              <div className={styles.chat_info_time}>
                <div className={styles.chat_time}>昨天</div>
                <Tooltip placement="bottomLeft" title={`未读消息5条`}>
                  <div className={`iconfont ${StatusIconList[2].icon} ${styles.chat_unread}`}>
                    <span>5</span>
                  </div>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.rightContainer}></div>
    </div>
  );
};

export default Chat;
