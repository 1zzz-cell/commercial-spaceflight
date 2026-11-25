# 后端服务

## 安装依赖

```bash
pip install -r requirements.txt
```

## 启动服务

### 开发模式
```bash
python app.py
```

### 生产模式（Linux/Mac）
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 生产模式（Windows）
```bash
waitress-serve --listen=0.0.0.0:5000 app:app
```

## API 接口

- `GET /api/health` - 健康检查
- `GET /api/policies` - 政策法规数据
- `GET /api/industry` - 产业数据
- `GET /api/wordfreq` - 词频数据

## 静态文件

前端构建后的文件位于 `../dist` 目录，Flask 会自动提供静态文件服务。
