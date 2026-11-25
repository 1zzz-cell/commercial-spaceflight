/* 平台快讯解析：newsTicker 条目形如「来源：正文」，拆为来源徽标与正文 */
export function parseTicker(text) {
  if (text && typeof text === 'object') {
    return { source: text.source || '', text: text.text || '', sourceUrl: text.sourceUrl || '' };
  }
  if (typeof text !== 'string') return { source: '', text: '' };
  const idx = text.indexOf('：');
  if (idx <= 0) return { source: '', text };
  return { source: text.slice(0, idx), text: text.slice(idx + 1), sourceUrl: '' };
}
