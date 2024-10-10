import { IFriendInfo, IGroupChatInfo } from '../address-book/type';

// 左侧消息列表项类型
export interface IMessageListItem {
  receiver_id: number; // 好友 id / 群聊 id
  name: string; // 接受者备注 / 群聊名称
  receiver_username?: string; // 接受者用户名，有这字段时说明是私聊，否则是群聊
  room: string; // 房间号
  updated_at: Date; // 发送时间
  unreadCount: number; // 未读消息数
  lastMessage: string; // 最后一条消息
  type: string; // 消息类型
  avatar: string; // 接受者头像 / 群聊头像
}

// 给聊天列表组件传递的props类型定义
export interface IChatListProps {
  initSelectedChat: IFriendInfo | IGroupChatInfo | null;
}

// 建立websocket 连接所需要的参数
export interface IConnectParams {
  room: string;
  sender_id: string;
  type: 'private' | 'group';
}
