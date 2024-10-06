import styles from './index.module.less';
import { Input, Tooltip } from 'antd';
import { PlusCircleOutlined, SearchOutlined } from '@ant-design/icons';
const SearchContainer = () => {
  const addContent = (
    <ul>
      <li onClick={() => {}}>加好友/加群</li>
      <li onClick={() => {}}>创建群聊</li>
    </ul>
  );
  return (
    <>
      <div className={styles.searchContainer}>
        <div className={styles.searchBox}>
          <Input size="small" placeholder="搜索" prefix={<SearchOutlined />} />
        </div>
        <Tooltip
          placement="bottomLeft"
          title={addContent}
          arrow={false}
          overlayClassName="addContent"
        >
          <div className={styles.addBox}>
            <PlusCircleOutlined />
          </div>
        </Tooltip>
      </div>
    </>
  );
};

export default SearchContainer;
