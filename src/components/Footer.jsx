import { Link } from 'react-router-dom';
import { COMPLIANCE } from './ComplianceKit';
import { navGroups } from './siteNavigation';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-buaa">
              <img src="/buaa-logo.png" alt="北京航空航天大学" className="footer-buaa-emblem" />
              <div>
                <h3>中国商业航天产业数据平台</h3>
                <p className="footer-buaa-label">北京航空航天大学 · 经济管理学院 · 商业航天研究中心</p>
              </div>
            </div>
            <p>
              面向商业航天业内人士的产业信息与数据平台，汇集企业、市场资本、运载能力、卫星星座与政策信息。来源粒度和更新状态按数据集标注。
            </p>
          </div>
          <div className="footer-links">
            {navGroups.map((group) => (
              <div className="footer-links-group" key={group.title}>
                <h4>{group.title}</h4>
                {group.items.map((item) => <Link key={item.path} to={item.path}>{item.label}</Link>)}
                {group.title === '市场与资本' && <Link to="/investors">投资分析工具</Link>}
              </div>
            ))}
            <div className="footer-links-group">
              <h4>合规与口径</h4>
              <Link to="/compliance#tab-risk">风险提示</Link>
              <Link to="/compliance#tab-sources">数据来源与口径</Link>
              <Link to="/compliance#tab-statement">免责声明全文</Link>
              <Link to="/compliance#tab-platform">平台与资料来源</Link>
            </div>
          </div>
        </div>

        {/* 免责声明全文：不折叠、不用 details/accordion，与 /compliance 同一文案 */}
        <div className="cp-footer-disclaimer">
          <h4>免责声明</h4>
          {COMPLIANCE.full.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
          <p className="cp-footer-disclaimer-link">
            完整口径字典与分文件数据时间：<Link to="/compliance#tab-sources">查看合规与数据来源 →</Link>
          </p>
        </div>

        <div className="footer-bottom">
          <p>&copy; {currentYear} 北京航空航天大学经济管理学院 · 商业航天研究中心 | 保留所有权利</p>
          <p>数据来源：国务院政策文件库、国家航天局、各省市人民政府官网等公开信息 | 仅供参考，不构成投资建议</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
