# 商业航天产业数据平台部署说明

## 上传静态部署包

将部署 ZIP 解压后的全部文件上传到域名根目录。根目录应直接包含 index.html、assets、data 和各栏目目录。启用目录默认文档 index.html，并将 404.html 配置为自定义错误页。用独立域名或子域名部署。

在 Linux 云服务器上可将静态文件放到 /var/www/commercial-spaceflight，使用 deploy/nginx.conf 作为站点配置。已有 HTTPS 反向代理时可保留其证书及转发配置，沿用示例中的静态文件规则。用 nginx -t 检查配置后重载。

网页功能使用随包发布的 JSON 和地图资源。搜索、筛选、图表和导出均在浏览器运行，部署无需 Flask、数据库或 API 密钥。后端目录仅供已有 API 使用方单独部署。

## 从源码重新构建

使用 Node.js 22.12+ 或 24 LTS，在项目根目录执行：

```sh
npm ci
npm run build
npm run preview
```

部署目录为 dist。正式域名确定后，可在构建环境设置 SITE_URL 生成各栏目的 canonical 和站点地图。例如：

```sh
SITE_URL=https://space.your-domain.cn npm run build
```

PowerShell 中使用 `$env:SITE_URL = 'https://space.your-domain.cn'`，再执行 `npm run build`。省略 SITE_URL 时仍可直接部署，构建产物不会包含指向示例域名的索引声明。

## 上线核对

- 直接打开并刷新 /chain/、/market/、/reports/#report-02 和 /research/#tab-provenance。
- /data/dashboard.json 应返回 JSON。不存在的页面应返回 404。
- 替换数据时发布新的 JSON 快照，按实际修订维护各文件的 lastUpdated。浏览器数据缓存最长保留 24 小时。
- 每日数据任务通过自动门禁后直接推送数据快照。门禁会拦截缺少来源链接、来源链接不可访问、结构异常、黑名单命中、受保护字段变更和超出变更上限的更新，并保留 `data-update-candidates/<日期>/manifest.json` 审计记录。
- 使用 CDN 时，HTML 和 JSON 应重新验证缓存。带内容哈希的 assets 文件可长期缓存。
