/* ============================================
   全站导出免责守卫注册表（无第三方依赖）
   ------------------------------------------------------------
   从 chartTools.js 抽离出来，原因：chartTools.js 顶部静态
   `import * as echarts`，而 Layout.jsx 为挂载守卫必须 import 本注册表，
   导致 1MB 的 echarts 被拉进入口 modulepreload（首页并不渲染图表）。
   注册表本身只是一份函数单例，不依赖 echarts 即可独立存在。

   ECharts toolbox 的 onclick 在图表组件内部构造；若逐层 prop 传 guard，
   要改 27 个调用点。改由 Layout 挂载一次守卫，buildToolbox 在「点击时」
   读取注册表中的函数（不是 option 构造时），避开 React 子组件 effect
   先于父组件 effect 执行的注册时序问题。未注册时行为完全不变。
   ============================================ */

let globalExportGuard = null;

export function setExportGuard(fn) {
  globalExportGuard = typeof fn === 'function' ? fn : null;
}

export function getExportGuard() {
  return globalExportGuard;
}
