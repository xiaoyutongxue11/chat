import { IMessageListItem } from '@/pages/chat/type';
import { MessageType } from '../MessageShow/type';

// 发送消息的类型
export interface ISendMessage {
  sender_id: number;
  receiver_id: number;
  type: MessageType;
  content: string | number[];
  avatar: string;
  filename?: string;
  fileTraStatus?: 'start' | 'upload';
  fileInfo?: string;
}
// 给聊天输入工具组件传递的参数类型
export interface IChatToolProps {
  curChatInfo: IMessageListItem;
  sendMessage: (message: ISendMessage) => void;
}
