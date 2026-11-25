@echo off
chcp 65001
echo ==============================================
echo        商业航天政策信息网站启动器
echo ==============================================
echo.
echo 正在启动开发服务器...
echo.

:: 设置 Node.js 路径
set PATH=C:\Program Files\nodejs;%PATH%

:: 启动开发服务器
npm run dev

pause