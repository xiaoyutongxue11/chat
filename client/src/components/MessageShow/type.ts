// 消息类型
export type MessageType = 'text' | 'image' | 'video' | 'file';

/**
 * 组件中用到的其他类型定义
 */
// 显示消息组件需要的参数
export interface IMessageShowProps {
  showTime: boolean;
  message: IMessageItem;
}

// 消息项的类型
export interface IMessageItem {
  sender_id: number;
  receiver_id: number;
  content: string;
  room: string;
  avatar: string;
  type: MessageType;
  file_size: string | null;
  created_at: Date;
}

// 给消息展示组件传递的参数类型
export interface IChatContentProps {
  messageType: MessageType;
  messageContent: string;
  fileSize?: string | null;
}

// 图片/视频的信息
export interface IMediaInfo {
  type: 'image' | 'video';
  url: string;
  size: { width: number; height: number };
}
