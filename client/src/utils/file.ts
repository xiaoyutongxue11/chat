// 判断某个文件是否存在（浏览器会发起一个预检请求）
export const urlExists = async (url: string) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

// 根据图片/视频链接获取图片/视频宽高
export const getMediaSize = (
  mediaUrl: string,
  mediaType: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    if (mediaType === 'image') {
      const mediaElement = document.createElement('img');
      mediaElement.src = mediaUrl;
      // 当指定的资源加载完成后，onload会触发
      mediaElement.onload = () => {
        resolve({
          width: mediaElement.width,
          height: mediaElement.height
        });
      };
      mediaElement.onerror = () => {
        reject(new Error('图片加载失败'));
      };
    } else if (mediaType === 'video') {
      const mediaElement = document.createElement('video');
      mediaElement.src = mediaUrl;
      //监听canplay媒体事件，当媒体元素（如 <audio> 或 <video>）足够数据已经被加载，以使媒体可以被播放时触发
      mediaElement.addEventListener('canplay', () => {
        resolve({ width: mediaElement.videoWidth, height: mediaElement.videoHeight });
      });
    }
  });
};

// 根据实际宽度计算展示的合理宽高（图片是按照一定算法缩小，视频是存在横屏和竖屏两种情况）
export const getMediaShowSize = (
  size: { width: number; height: number },
  mediaType: 'image' | 'video'
): { width: string } => {
  if (mediaType === 'image') {
    const widthRem = size.width / 1000;
    if (widthRem < 1) return { width: `${widthRem + 0.2}rem` };
    else if (widthRem < 3) return { width: `${widthRem}   ` };
    else return { width: `3rem` };
  } else {
    if (size.width > size.height) return { width: `2.5rem` };
    else return { width: '1rem' };
  }
};   
