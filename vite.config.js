import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const r = (p) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      // 模块开发统一入口：任何 src/modules/<X>/ 下的代码都通过 '@portal' 取共用能力，
      // 避免各模块各自 import 相对路径造成主仓库文件被反复改动
      '@portal': r('./src/modules/_shared'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // echarts 已拆为独立异步 chunk（gzip 约 336KB，仅含图表页面加载、全站共享缓存），
    // 此处上调告警阈值以匹配该已知的大体量第三方块
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // 手动分包：echarts / react 运行时独立成块，
        // 缩小首屏入口体积，并利用浏览器长期缓存
        // （Vite8/rolldown 要求 manualChunks 使用函数形式）
        manualChunks(id) {
          const parts = id.split(/[\\/]/);
          const idx = parts.lastIndexOf('node_modules');
          if (idx === -1) return undefined;
          const pkg = parts[idx + 1] ?? '';
          if (pkg === 'echarts' || pkg === 'zrender') return 'echarts';
          if (['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'].includes(pkg)) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  }
})

