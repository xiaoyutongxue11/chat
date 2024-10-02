const { Query } = require('../../utils/query');
const { CommonErrStatus } = require('../../utils/error');
const { RespData, RespError } = require('../../utils/resp');

// 全局变量存储聊天室房间，每个房间是一个对象，对象的键是username，值是websocket实例
const ChatRTCRooms = {};

// 根据好友username获取好友相关信息
const getFriendByUsername = async (friend_username, self_username) => {
	try {
		const sql = `SELECT * FROM friend WHERE username=? AND group_id IN (SELECT id FROM friend_group WHERE username=?)`;
		const results = await Query(sql, [friend_username, self_username]);
		if (results.length !== 0) {
			return results[0];
		}
	} catch {
		throw new Error('查询失败');
	}
};

// 发送给房间内其他人
const broadcastSocket = (username, room, msg, isNeedCalling = true) => {
	for (const key in ChatRTCRooms[room]) {
		if (key === username) continue;
		const ws = ChatRTCRooms[room][key];
		if (ws) {
			// isNeedCalling 为 true 时，需要对方正在通话状态才发送消息，否则不发送
			const shouldSend = isNeedCalling ? !!LoginRooms[key].status : true;
			if (shouldSend) {
				ws.send(JSON.stringify(msg));
			}
		}
	}
};
/**
 * 音视频聊天基本逻辑：
 * 1、邀请人点击音视频按钮，建立ws连接并向对方发送create_room指令，判断能不能进行通话，能则通知好友发开音视频通话界面，不能则返回connect_fail指令及原因
 * 2、被邀请人收到create_room指令后，打开 音视频通话界面并建立自己的ws连接，向邀请人发送new_peer指令
 * 3、邀请人收到 new_peer 指令后，创建和对方进行通话的pc通道，进入媒体协商环节（主要进行sdp交换）设置自己的sdp，发送offer指令和自己的sdp（媒体信息）给对方
 * 4、被邀请人收到offer指令后，设置自己和邀请人的sdp，发送answer指令和自己的sdp给邀请人
 * 5、邀请人收到answer指令后，设置被邀请人的sdp，此时双方的sdp设置完毕，可以进行通话ICE（网络信息）设置，进入网络连接环节
 * 6、双方相互发送ice_candidate指令和网络信息，设置对方的网络信息
 * 7、双方网络信息设置完毕，可以进行音视频通话
 * 8、群音聊天时，邀请人是向所有群友发送邀请（一对多），每个收到邀请的群友同意（向房间内其他人发送new_peer指令，一对多）之后，后续的通话建立过程重复上述3-7步（一对一）
 */
const connectRTC = async (ws, req) => {
	const url = req.url.split('?')[1]; // 截取？后的路径参数
	const params = new URLSearchParams(url);
	const room = params.get('room');
	const username = params.get('username');
	const type = params.get('type'); // private | group
	if (!(room && username && type)) {
		ws.close();
		return;
	}
	try {
		if (!ChatRTCRooms[room]) {
			ChatRTCRooms[room] = {};
		}
		ChatRTCRooms[room][username] = ws;
		ws.on('message', async data => {
			// 服务端接收到的 message 包含 name、mode、callReceiverList、data、receiver
			// 其中只有 name 指令名称是必须收到的，mode 和 callReceiverList 是 create_room 时收到的
			// data、receiver 是 offer、answer、ice_candidate 时收到的
			const message = JSON.parse(data);
			const { callReceiverList } = message;
			let msg;
			switch (message.name) {
				/**
				 * create_room 邀请人发送邀请
				 * 1、如果是私聊，则判断好友是否在线、是否空闲，能则通知对方打开音视频通话界面
				 * 2、如果是群聊，遍历所有的被邀请者，判断是否在线，是否空闲，无法邀请的删除，之后更新 callReceiverList，给所有在线且空闲的被邀请人发送邀请通知
				 * 3、此时的邀请通知是通过 LoginRooms 存储的 ws 连接实例实现
				 * 4、被通知方要拿到聊天房间内其它人的信息（私聊时只有邀请人一个人，群聊时有邀请人和其它被邀请人）
				 */
				case 'create_room':
					if (!LoginRooms[username]) {
						ws.send(
							JSON.stringify({
								name: 'connect_fail',
								reason: '您已经下线了'
							})
						);
						return;
					}
					if (LoginRooms[username].status) {
						ws.send(
							JSON.stringify({
								name: 'connect_fail',
								reason: '您正在通话中，请勿发送其他通话请求'
							})
						);
					}
					// 私聊时
					if (type === 'private') {
						if (!LoginRooms[callReceiverList[0].username]) {
							ws.send(
								JSON.stringify({
									name: 'connect_fail',
									reason: '对方不在线'
								})
							);
						}
						if (LoginRooms[callReceiverList[0].username].status) {
							ws.send(JSON.stringify({ name: 'connect_fail', reason: '对方正在通话中!!!' }));
							return;
						}
					}
					// 群聊时
					if (type === 'group') {
						// 遍历所有接收者，判断是否在线，是否空闲，无法邀请的删除，之后更新callReceiverList
						for (let i = 0; i < callReceiverList.length; i++) {
							const receiver_username = callReceiverList[i].username;
							// 排除自己
							if (receiver_username !== username) {
								if (!LoginRooms[receiver_username]) {
									callReceiverList.splice(i, 1);
									i--;
									continue;
								}
								if (LoginRooms[receiver_username].status) {
									callReceiverList.splice(i, 1);
									i--;
									continue;
								}
							}
						}
						// 如果此时没有可以通话的人 (即此时的 callReceiverList 里只有邀请方自己)
						if (callReceiverList.length === 1) {
							ws.send(JSON.stringify({ name: 'connect_fail', reason: '当前没有可以通话的人!!!' }));
							return;
						}
						// 设置当前用户的通话状态
						LoginRooms[username].status = true;
						// 发送邀请（利用 LoginRooms 存储的 ws 连接实例向在线且空闲的被邀请人发送邀请）
						for (let i = 0; i < callReceiverList.length; i++) {
							const receiver_username = callReceiverList[i].username;
							if (receiver_username === username) continue;
							// 每个被邀请人都要拿到聊天房间内其他人的信息（对当前的 callReceiverList 进行处理：排除自己和加上邀请方）
							// 排除自己，过滤callReceiverList
							const newCallReceiverList = callReceiverList.filter(
								item => item.username !== receiver_username
							);
							// 群聊中有邀请方，私聊中没有，需要单独加上
							if (type === 'private') {
								// receiver获取邀请方的好友信息
								const friendInfo = await getFriendByUsername(username, receiver_username);
								newCallReceiverList.push({
									username: username,
									avatar: friendInfo.avatar,
									alias: friendInfo.remark
								});
							}
							msg = {
								name: 'create_room',
								room: room,
								mode: message.mode,
								callReceiverList: newCallReceiverList
							};
							LoginRooms[receiver_username].ws.send(JSON.stringify(msg));
						}
					}
					break;
				/**
				 * new_peer：告诉房间内其他人自己要进房间
				 */
				case 'new_peer':
					msg = {
						name: 'new_peer',
						sender: username
					};
					LoginRooms[username].status = true;
					broadcastSocket(username, room, msg);
					break;
				/**
				 * offer：发送自己offer信息给进入房间的其他人（ offer 信息包含自己的 SDP 信息）
				 */
				case 'offer':
					msg = {
						name: 'offer',
						data: message.data,
						sender: username
					};
					ChatRTCRooms[room][message.receiver].send(JSON.stringify(msg));
					break;
				/**
				 * answer：此时已收到并设置对方发送过来的 SDP 后，也发送自己的 SDP 给对方
				 */
				case 'answer':
					msg = {
						name: 'answer',
						data: message.data,
						sender: username
					};
					ChatRTCRooms[room][message.receiver].send(JSON.stringify(msg));
					break;
				/**
				 * ice_candidate：设置对方的 candidate ———— 双方都可能收到，此时双方的 ICE 设置完毕，可以进行音视频通话
				 */
				case 'ice_candidate':
					msg = {
						name: 'ice_candidate',
						data: message.data,
						sender: username
					};
					ChatRTCRooms[room][message.receiver].send(JSON.stringify(msg));
					break;
				/**
				 * 拒绝 / 挂断通话
				 */
				case 'reject':
					msg = {
						name: 'reject',
						sender: username
					};
					broadcastSocket(username, room, msg);
					delete ChatRTCRooms[room][username];
					LoginRooms[username].status = false;
					break;
			}
		});
		ws.on('close', () => {
			if (ChatRTCRooms[room][username]) {
				delete ChatRTCRooms[room][username];
				LoginRooms[username].status = false;
			}
		});
	} catch {
		ws.send(
			JSON.stringify({
				name: 'connect_fail',
				reason: '服务器出错，连接失败'
			})
		);
		ws.close();
		return;
	}
};

/**
 * 获取当前正在通话的所有人
 */
const getRoomMembers = async (req, res) => {
	const url = req.url.split('?')[1];
	const params = new URLSearchParams(url);
	const room = params.get('room');
	const { username } = req.user;
	if (!room) {
		return RespError(res, CommonErrStatus.PARAM_ERR);
	}
	try {
		const data = [];
		for (const key in ChatRTCRooms[room]) {
			if (key === username || !LoginRooms[key].status) {
				continue;
			}
			data.push(key);
		}
		return RespData(res, data);
	} catch {
		return RespError(res, CommonErrStatus.SERVER_ERR);
	}
};

module.exports = {
	connectRTC,
	getRoomMembers
};
