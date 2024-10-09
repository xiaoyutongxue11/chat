import { IChatContentProps, IMediaInfo, IMessageShowProps } from './type';
import styles from './index.module.less';
import { formatChatContentTime } from '@/utils/time';
import { userStorage } from '@/utils/storage';
import { useEffect, useState } from 'react';
import { ChatImage, LoadErrorImage } from '@/assets/images';
import {
  downloadFile,
  getFileIcons,
  getFileName,
  getMediaShowSize,
  getMediaSize,
  urlExists
} from '@/utils/file';
import { serverURL } from '@/config';
import { Image, Modal } from 'antd';
import ImageLoad from '../ImageLoad';

const MessageShow = (props: IMessageShowProps) => {
  const { showTime, message } = props;
  const { sender_id, content, avatar, type, file_size, created_at } = message;
  const user = JSON.parse(userStorage.getItem());

  const ChatContentPocket = () => (
    <div className={`${styles.content_delete} ${styles.content_file}`}>
      <img src={LoadErrorImage.FILE_DELETE} alt="" draggable="false" />
      <span>文件已过期或被清理</span>
    </div>
  );
  // 消息内容（文本、图片、视频、文件）
  const ChatContent = (props: IChatContentProps): JSX.Element | null => {
    const { messageType, messageContent, fileSize } = props;
    // 文件是否存在
    const [isFileExist, setIsFileExist] = useState<boolean>(true);
    const [isVideoPlay, setIsVideoPlay] = useState<boolean>(false);
    const [curMediaInfo, setCurMediaInfo] = useState<IMediaInfo | null>(null);

    useEffect(() => {
      if (messageType !== 'text') {
        urlExists(`${serverURL}${messageContent}`).then(res => {
          if (!res) {
            setIsFileExist(res);
          }
        });
      }
      if (messageType === 'image' || messageType === 'video') {
        const mediaURL = serverURL + messageContent;
        getMediaSize(mediaURL, messageType)
          .then(size => {
            setCurMediaInfo({ type: messageType, url: mediaURL, size });
          })
          .catch();
      }
    }, [messageType, messageContent]);
    // 打开视频播放窗口
    const handleOpenVideo = () => {
      setIsVideoPlay(true);
    };

    // 消息内容
    if (!isFileExist) return <ChatContentPocket />;
    switch (messageType) {
      case 'text':
        return <div className={styles.content_text}>{messageContent}</div>;
      case 'image':
        return curMediaInfo && curMediaInfo ? (
          <Image
            width={getMediaShowSize(curMediaInfo.size, 'image').width}
            src={curMediaInfo.url}
          />
        ) : null;
      case 'video':
        return curMediaInfo && curMediaInfo ? (
          <div className={styles.content_video}>
            <video
              src={curMediaInfo.url}
              muted
              style={{
                width: getMediaShowSize(curMediaInfo.size, 'video').width
              }}
            ></video>
            <img src={ChatImage.PLAY} alt="" onClick={handleOpenVideo} draggable="false" />
            <Modal
              open={isVideoPlay}
              footer={null}
              title="视频"
              onCancel={() => setIsVideoPlay(false)}
              destroyOnClose
              width={800}
            >
              <video src={curMediaInfo.url}></video>
            </Modal>
          </div>
        ) : null;
      case 'file':
        return (
          <div
            className={styles.content_file}
            onClick={() => {
              downloadFile(`${serverURL}${messageContent}`);
            }}
          >
            <div className={styles.content_file_name}>
              <span>{getFileName(messageContent)}</span>
              {fileSize && <span>{fileSize}</span>}
            </div>
            <div className={styles.content_file_img}>
              <img src={getFileIcons(messageContent)} alt="" draggable="false" />
            </div>
          </div>
        );
      default:
        return null;
    }
  };
  return (
    <>
      {showTime && created_at && (
        <div className={styles.chat_notice}>
          <span>{formatChatContentTime(created_at)}</span>
        </div>
      )}
      {sender_id === user.id ? (
        <div className={`${styles.self} ${styles.chat_item_content}`}>
          <ChatContent messageType={type} messageContent={content} fileSize={file_size} />
          <div className={styles.avatar}>
            <ImageLoad src={avatar} />
          </div>
        </div>
      ) : (
        <div className={`${styles.other} ${styles.chat_item_content}`}>
          <div className={styles.avatar}>
            <ImageLoad src={avatar} />
          </div>
          <ChatContent messageType={type} messageContent={content} fileSize={file_size} />
        </div>
      )}
    </>
  );
};

export default MessageShow;
