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

export interface IGroupMemberParams {
  groupId: number;
  room: string;
}

export interface IGroupMember {
  user_id: number;
  avatar: string;
  username: string;
  name: string;
  nickname: string;
  created_at: string;
  lastMessageTime: string;
}
