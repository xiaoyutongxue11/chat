import { LoadErrorImage } from '@/assets/images';
import { serverURL } from '@/config';

interface ImageProps {
  src: string;
  alt?: string;
  className?: string;
}

const ImageLoad = (props: ImageProps) => {
  const { src, alt, className } = props;
  return (
    <img
      src={
        src
          ? src.startsWith('http') || src.startsWith('https')
            ? `${src}`
            : `${serverURL}${src}`
          : `${LoadErrorImage.AVATAR}`
      }
      onError={e => {
        if (e.currentTarget.src !== `${LoadErrorImage.AVATAR}`) {
          e.currentTarget.src = `${LoadErrorImage.AVATAR}`;
        }
      }}
      alt={alt ? alt : ''}
      className={className}
      draggable="false"
    />
  );
};

export default ImageLoad;
