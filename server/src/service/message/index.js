const { CommonErrStatus } = require('../../utils/error');
const { Query } = require('../../utils/query');
const { RespError } = require('../../utils/resp');

// 全局变量存储聊天室房间，每个房间是一个对象，对象的键是用户id或群id，值是websocket实例
const ChatRooms = {};

/**
 * 获取聊天记录列表的逻辑
 * 私聊类型
 * 1、先获取好友聊天列表
 * 2、根据好友分组列表中获取当前用户的所有好友分组id，然后根据分组id获取指定房间用户的所有聊天记录，再根据消息统计表获取最后一次发送消息的时间
 * 3、根据对方id和房间号获取未读消息的数量
 * 4、根据房间号和创建时间获取最后一次消息内容
 * 群聊类型
 * 1、根据用户id查询加入的所有群聊id
 * 2、根据群聊id查询群聊信息，群聊room
 * 3、根据群聊room查询群聊最后一条信息
 */

const getChatList = async (req, res) => {
	try {
		const data = [];
		const id = req.user.id;
		// 获取所有私聊聊天列表
		const sql_private = `SELECT user_id AS receiver_id,remark AS name,username AS receiver_username,f.room,msg_sta.updates_at FROM friend AS f,(SELECT id FROM friend_group WHERE user_id=?) AS fp,message_statistics AS msg_sta WHERE fp.id=f.group_id AND f.room =msg_sta.room ORDER BY msg_sta.updated_at DESC`;
		const results_private = await Query(sql_private, [id]);
		if (results_private) {
			for (const index in results_private) {
				const item = results_private[index];
				// 获取私聊消息未读数量
				const sql_unread = `SELECT count(*) AS unreadCount FROM message WHERE room=? AND receiver_id=? AND status=0`;
				const results_unread = await Query(sql_unread, [item.room, item.id]);
				results_private[index].unreadCount = results_unread[0].unreadCount;
				// 获取私聊的最后一条信息
				const sql_last_private = `SELECT content AS lastMessage,media_type AS type FROM message WHERE room=? ORDER BY create_at DESC LIMIT 1`;
				const results_last_private = await Query(sql_last_private, [item.room, id]);
				results_private[index].lastMessage = results_last_private[0].lastMessage;
				results_private[index].type = results_last_private[0].type;
				// 获取私聊好友头像
				const sql_avatar_private = `SELECT avatar from user where id = ?`;
				const results_avatar_private = await Query(sql_avatar_private, [item.receiver_id]);
				results_private[index].avatar = results_avatar_private[0].avatar;
			}
			data.push(...results_private);
		}
		// 获取所有群聊聊天列表
		const sql_group = `SELECT gc.id AS receiver_id,avatar,name,gc.room,msg_sta.updated_at FROM group_chat AS gc,(SELECT * FROM group_members WHERE user_id = ?) AS gm, message_statistics AS msg_sta WHERE gc.id = gm.group_id AND gc.room = msg_sta.room ORDER BY msg_sta.updated_at DESC;`;
		const results_group = await Query(sql_group, [id]);
		if (results_group) {
			for (const index in results_group) {
				const item = results_group[index];
				// 获取群聊未读消息的数量 (因为是群聊消息, 此时的 receiver_id 为 group_id，因此目前无法处理，先设置为 0)
				results_group[index].unreadCount = 0;
				// 获取群聊最后一条消息
				const sql = `SELECT content as lastMessage, media_type as type FROM message WHERE room = ? ORDER BY created_at DESC LIMIT 1`;
				const results_last_group = await Query(sql, [item.room, id]);
				results_group[index].lastMessage = results_last_group[0].lastMessage;
				results_group[index].type = results_last_group[0].type;
			}
			data.push(...results_group);
		}
		// 根据时间排序
		data.sort((a, b) => {
			const t1 = new Date(a.updated_at).getTime();
			const t2 = new Date(b.updated_at).getTime();
			if (t1 < t2) return 1;
			else if (t1 > t2) return -1;
			else return 0;
		});
		return RespData(res, data);
	} catch {
		return RespError(res, CommonErrStatus.SERVER_ERR);
	}
};

