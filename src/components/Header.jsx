import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GlobalSearch, useGlobalSearchShortcut } from './GlobalSearch';
import { ComplianceToolbar } from './ComplianceKit';
import { navGroups } from './siteNavigation';

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const navRef = useRef(null);
  const toggleRef = useRef(null);
  const location = useLocation();

  useGlobalSearchShortcut();

  function closeMenus() {
    setMenuOpen(false);
    setOpenGroup(null);
  }

  useEffect(() => { closeMenus(); }, [location.key]);
  useEffect(() => {
    if (menuOpen) navRef.current.querySelector('a')?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (openGroup === null && !menuOpen) return undefined;

    function outside(event) {
      if (!navRef.current.contains(event.target) && !toggleRef.current.contains(event.target)) closeMenus();
    }

    function onEscape(event) {
      if (event.key !== 'Escape') return;
      const activeGroup = openGroup !== null && navRef.current.contains(document.activeElement);
      if (activeGroup) {
        document.getElementById(`nav-trigger-${openGroup}`)?.focus();
        setOpenGroup(null);
      } else {
        if (menuOpen) toggleRef.current.focus();
        closeMenus();
      }
    }

    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [openGroup, menuOpen]);

  return (
    <header className="b2b-header">
      <div className="b2b-header-inner">
        <NavLink to="/" className="b2b-logo" aria-label="中国商业航天产业总览" onClick={closeMenus}>
          <span className="b2b-logo-mark" aria-hidden="true" />
          <span className="b2b-logo-text">中国商业航天</span>
        </NavLink>

        <nav ref={navRef} id="main-navigation" className={`b2b-nav ${menuOpen ? 'b2b-nav-open' : ''}`} aria-label="主导航"
          onBlur={(event) => {
            if (!menuOpen && !event.currentTarget.contains(event.relatedTarget)) setOpenGroup(null);
          }}>
          <NavLink to="/" end className={({ isActive }) => `b2b-nav-link ${isActive ? 'b2b-nav-active' : ''}`} onClick={closeMenus}>
            产业总览
          </NavLink>
          {navGroups.map((group, index) => {
            const open = openGroup === index;
            const active = group.items.some(({ path }) => path === location.pathname.replace(/\/$/, ''))
              || (group.title === '市场与资本' && location.pathname.replace(/\/$/, '') === '/investors');
            return (
              <div key={group.title} className={`b2b-nav-group ${open ? 'b2b-nav-group-open' : ''}`}>
                <button type="button" id={`nav-trigger-${index}`}
                  className={`b2b-nav-link b2b-nav-trigger ${active ? 'b2b-nav-active' : ''}`}
                  aria-expanded={open} aria-controls={`nav-panel-${index}`}
                  onClick={() => setOpenGroup(open ? null : index)}>
                  {group.title}
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div id={`nav-panel-${index}`} className="b2b-dropdown" hidden={!open}>
                  {group.items.map((item) => (
                    <NavLink key={item.path} to={item.path} onClick={closeMenus}
                      className={({ isActive }) => `b2b-dropdown-item ${isActive ? 'b2b-dropdown-item-active' : ''}`}>
                      <span className="b2b-dropdown-label">{item.label}</span>
                      <span className="b2b-dropdown-desc">{item.desc}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="b2b-header-right">
          <ComplianceToolbar />
          <GlobalSearch />
          <button ref={toggleRef} className={`b2b-menu-btn ${menuOpen ? 'open' : ''}`}
            type="button" aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={menuOpen} aria-controls="main-navigation"
            onClick={() => menuOpen ? closeMenus() : setMenuOpen(true)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
