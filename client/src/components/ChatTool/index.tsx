import { IChatToolProps, ISendMessage } from './type';
import { ChatIconList } from '@/assets/icons';
import styles from './index.module.less';
import { Button, Spin, Tooltip } from 'antd';
import { TooltipPlacement } from 'antd/es/tooltip';
import { EmojiList } from '@/assets/emoji';
import { ChangeEvent, useRef, useState } from 'react';
import { userStorage } from '@/utils/storage';
import useShowMessage from '@/hooks/useShowMessage';
import { getFileSuffixByName } from '@/utils/file';
import { ICallReceiverInfo } from '../AudioModal/type';
import AudioModal from '../AudioModal';
import { IMessageListItem } from '@/pages/chat/type';
import VideoModal from '../VideoModal';
import { getGroupMembers } from './api';
import { HttpStatus } from '@/utils/constant';
interface IconListParams {
  icons: typeof ChatIconList;
  placementFn: (index: number) => TooltipPlacement;
}
// 这里要接收chat组件的sendMessage方法（原因：要共用一个socket实例）
const ChatTool = (props: IChatToolProps) => {
  const { curChatInfo, sendMessage } = props;
  const [inputValue, setInputValue] = useState<string>('');
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(userStorage.getItem());
  const showMessage = useShowMessage();
  const [openAudioModal, setAudioModal] = useState(false);
  const [openVideoModal, setVideoModal] = useState(false);
  const [callReceiverList, setCallReceiverList] = useState<ICallReceiverInfo[]>([]);
  const addEmoji = (emoji: string) => {
    setInputValue((preValue: string) => preValue + emoji);
  };
  const changeInputValue = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };
  const emojiList = (
    <div className={styles.emoji_list}>
      {EmojiList.map(item => {
        return (
          <span
            key={item}
            className={styles.emoji_item}
            style={{ cursor: 'default' }}
            onClick={() => {
              addEmoji(item);
            }}
          >
            {item}
          </span>
        );
      })}
    </div>
  );
  const getCallReceiverList = async () => {
    if (isGroupChat(curChatInfo)) {
      try {
        const params = { groupId: curChatInfo.receiver_id, room: curChatInfo.room };
        const res = await getGroupMembers(params);
        if (res.code === HttpStatus.SUCCESS && res.data) {
          setCallReceiverList(
            res.data.map(item => {
              return {
                username: item.username,
                alias: item.nickname,
                avatar: item.avatar
              };
            })
          );
        } else {
          showMessage('error', '获取群聊成员信息失败，请重试');
        }
      } catch {
        showMessage('error', '获取群聊成员信息失败，请重试');
      }
    } else {
      setCallReceiverList([
        {
          username: curChatInfo.receiver_username as string,
          alias: curChatInfo.name,
          avatar: curChatInfo.avatar
        }
      ]);
    }
  };
  const handleIconClick = async (icon: string) => {
    switch (icon) {
      case 'icon-tupian_huaban':
        imageRef.current?.click();
        break;
      case 'icon-wenjian1':
        fileRef.current?.click();
        break;
      case 'icon-dianhua':
        await getCallReceiverList();
        setAudioModal(true);
        break;
      case 'icon-video':
        await getCallReceiverList();
        setVideoModal(true);
        break;
      default:
        break;
    }
  };
  const IconList = ({ icons, placementFn }: IconListParams) => {
    return (
      <>
        {icons.map((item, index) => (
          <Tooltip
            key={item.text}
            placement={placementFn(index)}
            title={index === 0 ? emojiList : item.text}
          >
            <li
              className={`iconfont ${item.icon}`}
              onClick={() => {
                handleIconClick(item.icon);
              }}
            ></li>
          </Tooltip>
        ))}
      </>
    );
  };
  const handleSendTextMessage = () => {
    if (inputValue === '') return;
    try {
      const newmessage: ISendMessage = {
        sender_id: user.id,
        receiver_id: curChatInfo.receiver_id,
        type: 'text',
        content: inputValue,
        avatar: user.avatar
      };
      sendMessage(newmessage);
      setInputValue('');
    } catch {
      showMessage('error', '消息发送失败，请重试');
    }
  };
  // 发送图片/视频消息
  const handleSendImageMessage = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files!.length > 0) {
      setLoading(true);
      const file = e.target.files![0];
      // 检查图片/视频大小是否超过100MB
      if (file.size > 100 * 1024 * 1024) {
        showMessage('error', '图片/视频大小不能超过100MB');
        setLoading(false);
        return;
      }
      // 读取文件内容
      const reader = new FileReader();
      // 文件读取完成之后执行的回调
      reader.onload = e => {
        try {
          const fileContent = e.target?.result;
          const content = new Uint8Array(fileContent as ArrayBuffer);
          const filename = file.name;
          const newmessage: ISendMessage = {
            sender_id: user.id,
            receiver_id: curChatInfo.receiver_id,
            type: getFileSuffixByName(filename),
            content: Array.from(content),
            avatar: user.avatar,
            filename: filename
          };
          sendMessage(newmessage);
          setLoading(false);
          // 清空文件输入字段的值，否则再次选择相同文件时无法触发 onchange
          imageRef.current!.value = '';
        } catch {
          showMessage('error', '消息发送失败，请重试');
          setLoading(false);
          imageRef.current!.value = '';
        }
      };
      reader.readAsArrayBuffer(file); // 将指定文件file以ArrayBuffer形式进行读取
    }
  };

  // 发送文件消息
  const handleSendFileMessage = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files!.length > 0) {
      setLoading(true);
      const file = e.target.files![0];
      // 其他文件类型，按照图片/视频文件处理
      if (getFileSuffixByName(file.name) !== 'file') {
        // 检查图片/视频大小是否超过100MB
        if (file.size > 100 * 1024 * 1024) {
          showMessage('error', '图片/视频大小不能超过100MB');
          setLoading(false);
          return;
        }
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const fileContent = e.target?.result;
            const content = new Uint8Array(fileContent as ArrayBuffer);
            const filename = file.name;
            const newmessage: ISendMessage = {
              sender_id: user.id,
              receiver_id: curChatInfo.receiver_id,
              type: getFileSuffixByName(filename),
              content: Array.from(content),
              avatar: user.avatar,
              filename: filename
            };
            sendMessage(newmessage);
          } catch {
            showMessage('error', '消息发送失败，请重试');
          } finally {
            setLoading(false);
            fileRef.current!.value = '';
          }
        };
      } else {
        try {
          // 发送文件信息
          const fileInfo = {
            fileName: file.name,
            fileSize: file.size
          };
          // 发送文件下载指令
          const newmessage: ISendMessage = {
            sender_id: user.id,
            receiver_id: curChatInfo.receiver_id,
            type: 'file',
            content: '',
            avatar: user.avatar,
            filename: file.name,
            fileTraStatus: 'start',
            fileInfo: JSON.stringify(fileInfo)
          };
          sendMessage(newmessage);
        } catch {
          showMessage('error', '消息发送失败，请重试');
          setLoading(false);
          fileRef.current!.value = '';
        } finally {
        }
        // 防止文件未初始化完成就发送
        setTimeout(async () => {
          const reader = file.stream().getReader();
          let shouldExit = false;
          let chunk;
          let transmittedSize = 0; // 获取服务端已经传输的文件大小
          while (!shouldExit) {
            chunk = await reader.read();
            if (chunk.done) {
              setLoading(false);
              shouldExit = true;
              fileRef.current!.value = '';
            } else {
              transmittedSize -= chunk.value.byteLength; // 减去当前块的字节长度来更新已传输的大小，支持断点续传
              if (transmittedSize <= 0) {
                const newmessage: ISendMessage = {
                  sender_id: user.id,
                  receiver_id: curChatInfo.receiver_id,
                  type: 'file',
                  content: Array.from(new Uint8Array(chunk.value)),
                  avatar: user.avatar,
                  filename: file.name,
                  fileTraStatus: 'upload'
                };
                sendMessage(newmessage);
              }
            }
          }
        }, 50);
      }
    }
  };
  const handleAudioModal = () => {};
  const handleVideoModal = () => {};
  const getPlacement = (index: number) => (index === 0 ? 'top' : 'bottom');
  const isGroupChat = (item: IMessageListItem) => {
    return !item.receiver_username;
  };

  return (
    <div className={styles.chat_tool}>
      <div className={styles.chat_tool_item}>
        <ul className={styles.leftIcons}>
          <IconList icons={ChatIconList.slice(0, 3)} placementFn={getPlacement} />
        </ul>
        <ul className={styles.rightIcons}>
          <IconList icons={ChatIconList.slice(3, 6)} placementFn={() => 'bottomLeft'} />
        </ul>
        <input
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          ref={imageRef}
          onChange={e => {
            handleSendImageMessage(e);
          }}
        />
        <input
          type="file"
          accept="*"
          style={{ display: 'none' }}
          ref={fileRef}
          onChange={e => {
            handleSendFileMessage(e);
          }}
        />
      </div>
      <div className={styles.chat_tool_input}>
        <Spin spinning={loading} tip="正在发送中...">
          <textarea onChange={e => changeInputValue(e)} value={inputValue}></textarea>
        </Spin>
      </div>
      <div className={styles.chat_tool_btn}>
        <Button type="primary" onClick={handleSendTextMessage}>
          发送
        </Button>
      </div>
      {openAudioModal && callReceiverList.length && (
        <AudioModal
          openmodal={openAudioModal}
          handleModal={handleAudioModal}
          status="initiate"
          type={isGroupChat(curChatInfo) ? 'group' : 'private'}
          callInfo={{
            room: curChatInfo.room,
            callReceiverList: callReceiverList
          }}
        ></AudioModal>
      )}
      {openVideoModal && callReceiverList.length && (
        <VideoModal
          openmodal={openVideoModal}
          handleModal={handleVideoModal}
          status="initiate"
          type={isGroupChat(curChatInfo) ? 'group' : 'private'}
          callInfo={{
            room: curChatInfo.room,
            callReceiverList: callReceiverList
          }}
        ></VideoModal>
      )}
    </div>
  );
};

export default ChatTool;
