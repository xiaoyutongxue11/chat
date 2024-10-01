import styles from './index.module.less';
import Container from '../container/index';

const Home = () => {
  return (
    <>
      <div className={styles.bgContainer}>
        <Container />
      </div>
    </>
  );
};

export default Home;
