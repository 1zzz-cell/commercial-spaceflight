/* ============================================
   {{MODULE_TITLE}} —— 模块私有样式
   --------------------------------------------
   规则：
   - 类名一律 {{MODULE_CLASS}}- 前缀，避免与其他模块 / 主仓样式冲突
   - 只使用 global.css 已定义的 CSS 变量，不要写死色值
   - 需要复用的版式请用 @portal 的 Card / SectionTitle / Grid，
     不要在这里重复造一套 card 样式
   ============================================ */

.{{MODULE_CLASS}}-hero {
  padding: 8px 0 0;
}

.{{MODULE_CLASS}}-hero-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

.{{MODULE_CLASS}}-hero-sub {
  margin: 8px 0 0;
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.7;
}

.{{MODULE_CLASS}}-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.{{MODULE_CLASS}}-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.86rem;
  flex-wrap: wrap;
}

.{{MODULE_CLASS}}-list-item:last-child {
  border-bottom: none;
}

.{{MODULE_CLASS}}-company {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 96px;
}

.{{MODULE_CLASS}}-badge {
  padding: 2px 8px;
  font-size: 0.72rem;
  color: var(--accent-blue);
  background: var(--accent-blue-dim);
  border-radius: 999px;
}

.{{MODULE_CLASS}}-amount {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

@media (max-width: 640px) {
  .{{MODULE_CLASS}}-amount {
    margin-left: 0;
  }
}
