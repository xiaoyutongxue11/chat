import { useEffect, useRef, useState } from 'react';
import {
  CallStatus,
  callStatusType,
  ICallList,
  ICallModalProps,
  IConnectParams,
  IRoomMembersItem
} from './type';
import { getRoomMembers } from './api';
import { HttpStatus } from '@/utils/constant';
import { Modal } from 'antd';
import useShowMessage from '@/hooks/useShowMessage';
import styles from './index.module.less';
import ImageLoad from '../ImageLoad';
import { CallIcons } from '@/assets/images';
import { wsBaseURL } from '@/config';
import { userStorage } from '@/utils/storage';

const AudioModal = (props: ICallModalProps) => {
  const showMessage = useShowMessage();
  const user = JSON.parse(userStorage.getItem());
  const { openmodal, handleModal, status, type, callInfo } = props;
  // 当前房间正在通话的所有人
  const [roomMembers, setRoomMembers] = useState<IRoomMembersItem[]>([]);
  // 是否显示当前通话人列表抽屉
  const [isShowRoomMembersDrawer, setIsRoomMembersDrawer] = useState<boolean>(false);
  // 当前通话状态
  const [callStatus, setCallStatus] = useState<callStatusType>(status);
  // websocket实例
  const socket = useRef<WebSocket | null>(null);
  // 本地音视频流，用于存储自己的音视频流，方便结束时关闭
  const localStream = useRef<MediaStream | null>(null);
  // 主要负责存储通话对象信息，每个通话对象都有一个 RTCPeerConnection 实例，该实例是真正负责音视频通信的角色
  const callListRef = useRef<ICallList>({});
  // 初始化本人音视频流
  const initStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      });
      localStream.current = stream;
    } catch {
      showMessage('error', '获取音频流失败，检查设备是否正常或权限是否开启');
      handleModal(false);
    }
  };

  // 打开音视频通话组件时建立 websocket 连接
  const initSocket = (connectParams: IConnectParams) => {
    if (socket.current !== null) {
      socket.current.close();
      socket.current = null;
    }
    const ws = new WebSocket(
      `${wsBaseURL}/rtc/connect?room=${connectParams.room}&username=${connectParams.username}&type=${connectParams.type}`
    );
    ws.onopen = async () => {
      // 如果是通话发起人，则初始化音视频流并发送创建房间指令
      if (callStatus === CallStatus.INITIATE) {
        try {
          // 获取并设置自己的音视频流
          await initStream();
          // 给被邀请人发送创建房间指令
          socket.current?.send(
            JSON.stringify({
              name: 'create_room',
              mode: connectParams.type === 'private' ? 'private_audio' : 'group_audio',
              callReceiverList: callInfo.callReceiverList
            })
          );
        } catch {
          showMessage('error', '获取音频流失败，请检查设备是否正常或者权限是否已开启');
          socket.current?.send(JSON.stringify({ name: 'reject' }));
          socket.current?.close();
          socket.current = null;
          localStream.current?.getAudioTracks()[0].stop();
          setTimeout(() => {
            handleModal(false);
          }, 1500);
        }
      }
    };
    ws.onmessage = async e => {
      const message = JSON.parse(e.data);
      switch (message.name) {
        //connect_fail：无法建立音视频通话的情况 ———— 通话发起人可能收到
        case 'connect_fail':
          socket.current?.close();
          socket.current = null;
          if (localStream.current) {
            localStream.current?.getAudioTracks()[0].stop();
          }
          setTimeout(() => {
            handleModal(false);
            showMessage('error', message.reason);
          }, 1500);
          break;
        // new_peer：接收到有新人进入房间, 则初始化和该新人的 PC 通道，并发送自己 offer 信息给该新人（ offer 信息包含自己的 SDP 信息）
        case 'new_peer':
          setCallStatus(CallStatus.CALLING);
          if (type !== 'private') {
            await getRoomMembersData();
          }
          // 添加自己的音频流到与该新人的pc通道中
          localStream.current?.getTracks().forEach(track => {
            callListRef.current[message.sender].PC?.addTrack(
              track,
              localStream.current as MediaStream
            );
          });
          // 自己设置本地sdp，将会触发pc.onicecandidate事件，将自己的candidate发送给对方
          callListRef.current[message.sender].PC?.createOffer().then(session_desc => {
            callListRef.current[message.sender].PC?.setLocalDescription(session_desc);
            socket.current?.send(
              JSON.stringify({
                name: 'offer',
                data: {
                  sdp: session_desc
                },
                receiver: message.sender
              })
            );
          });

        // offer：进入房间的新人收到并设置对方发送过来的 SDP 后，也发送自己的 SDP 给对方
        case 'offer':
          // 添加自己的音频流到pc通道中
          localStream.current!.getTracks().forEach(track => {
            callListRef.current[message.sender].PC!.addTrack(
              track,
              localStream.current as MediaStream
            );
          });
          // 设置远程sdp
          callListRef.current[message.sender].PC?.setRemoteDescription(
            new RTCSessionDescription(message.data.sdp)
          );
          callListRef.current[message.sender].PC?.createAnswer().then(session_desc => {
            callListRef.current[message.sender].PC?.setLocalDescription(session_desc);
            socket.current?.send(
              JSON.stringify({
                name: 'answer',
                data: {
                  sdp: session_desc
                },
                receiver: message.sender
              })
            );
          });
          break;
        // answer：收到房间新人发送过来的sdp后，设置对方的sdp，此时双方sdp设置完毕，将会触发PC.onicecandidate事件，互相交换candidate
        case 'answer':
          // 设置远程sdp
          callListRef.current[message.sender].PC?.setRemoteDescription(
            new RTCSessionDescription(message.data.sdp)
          );
          break;
        // ice_candidate：设置对方的candidate
        case 'ice_candidate':
          const candidate = new RTCIceCandidate(message.data);
          callListRef.current[message.sender].PC?.addIceCandidate(candidate);
          break;
        // reject：对方拒绝或挂断电话
        case 'reject':
          if (type === 'private') {
            socket.current?.close();
            socket.current = null;
            if (localStream.current) {
              localStream.current.getAudioTracks()[0].stop();
            }
            setTimeout(() => {
              handleModal(false);
              showMessage('info', '对方已挂断');
            }, 1500);
          } else {
            await getRoomMembersData();
            setTimeout(() => {
              showMessage('info', `${message.sender}已退出群音通话`);
            }, 1500);
            const video = document.querySelector(`.video_${message.sender}`) as HTMLVideoElement;
            if (video) video.style.display = 'none';
          }
          break;
        default:
          break;
      }
    };
    ws.onerror = () => {
      showMessage('error', 'websocket 连接错误');
    };
    socket.current = ws;
  };
  // 初始化PC通道（为房间内每个能收到自己音频流的人创建一个专属的RTCPeerConnection连接实例，该实例是真正负责音视屏通信的角色）
  const initPC = (username: string) => {
    const pc = new RTCPeerConnection();
    // 给PC绑定onicecandidate事件，该事件将在PC通道双方彼此的sdp设置完成后自动触发，给对方发送自己的candidate数据（接收candidate，交换ICE网络信息）
    pc.onicecandidate = evt => {
      if (evt.candidate) {
        socket.current?.send(
          JSON.stringify({
            name: 'ice_candidate',
            data: {
              id: evt.candidate.sdpMid,
              label: evt.candidate.sdpMLineIndex,
              sdpMLineIndex: evt.candidate.sdpMLineIndex,
              candidate: evt.candidate.candidate
            }
          })
        );
      }
    };
    // 给PC绑定ontrack事件，该事件用于接收远程视频并播放，将会在双方交换并设置完ICE后自动触发
    pc.ontrack = evt => {
      if (evt.streams && evt.streams[0]) {
        const audio = document.querySelector(`.audio_${username}`) as HTMLVideoElement;
        if (audio) {
          audio.srcObject = evt.streams[0];
        }
      }
    };
    callListRef.current[username] = {
      PC: pc,
      alias: callInfo.callReceiverList.find(item => item.username === username)?.alias || '',
      avatar: callInfo.callReceiverList.find(item => item.username === username)?.avatar || ''
    };
  };
  // 拒绝/挂断通话
  const handleRejectCall = async () => {};
  //  获取当前房间内正在通话的所有人
  const getRoomMembersData = async () => {
    try {
      const res = await getRoomMembers(callInfo.room);
      if (res.code === HttpStatus.SUCCESS && res.data) {
        const newRoomMembers = res.data.map(item => {
          return {
            username: item,
            muted: roomMembers.find(member => member.username === item)?.muted || false
          };
        });
        setRoomMembers(newRoomMembers);
      } else showMessage('error', '获取房间成员失败');
    } catch {
      showMessage('error', '获取房间成员失败');
    }
  };

  // 打开组件时初始化websocket连接和pc通道
  useEffect(() => {
    const params: IConnectParams = {
      room: callInfo.room,
      username: user.username,
      type: type
    };
    initSocket(params);
    // 初始化所有pc通道
    callInfo.callReceiverList.forEach(item => {
      initPC(item.username);
    });
  }, []);
  return (
    <Modal
      open={openmodal}
      footer={null}
      wrapClassName="audioModal"
      width="5rem"
      title={`${type === 'private' ? '' : '群'}语音通话`}
      maskClosable={false}
      closable={type === 'private' ? false : true}
      closeIcon={type === 'private' ? null : <span className="iconfont icon-jinqunliaoliao"></span>}
      onCancel={async () => {
        setIsRoomMembersDrawer(!isShowRoomMembersDrawer);
        await getRoomMembersData();
      }}
    >
      <div className={styles.audioModalContent}>
        <div className={styles.content}>
          <div className={styles.avatar}>
            <ImageLoad
              src={type === 'private' ? callInfo.callReceiverList[0].avatar : CallIcons.AUDIO}
            />
          </div>
          {callStatus === CallStatus.INITIATE && (
            <>
              <span className={styles.callWords}>
                {type === 'private'
                  ? `对 ${callInfo.callReceiverList[0].alias} 发起语音通话`
                  : '发起群语音通话'}
              </span>
              <div className={styles.callIcons}>
                <img src={CallIcons.REJECT} alt="" draggable="false" />
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AudioModal;
