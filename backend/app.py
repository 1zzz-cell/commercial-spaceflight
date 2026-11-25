#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
中国商业航天政策与产业分析平台 - 后端服务
提供静态文件服务和 API 接口（API 直接读取 public/data 下的 JSON 数据文件）
"""

import os
import json
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS

# 获取项目根目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIST = os.path.join(BASE_DIR, 'dist')
DATA_DIR = os.path.join(BASE_DIR, 'public', 'data')

app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path='')
CORS(app)

# jsonify 输出中文原样字符（兼容 Flask 2.2 与 2.3+ 的不同配置方式）
try:
    app.json.ensure_ascii = False
except AttributeError:
    app.config['JSON_AS_ASCII'] = False

# ==================== API 路由 ====================


def read_data_file(filename):
    """读取 public/data 下的 JSON 数据文件，文件不存在时返回 None"""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.isfile(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


@app.route('/api/health')
def health_check():
    """健康检查接口"""
    return jsonify({"status": "ok", "message": "服务正常运行"})


@app.route('/api/rockets')
def get_rockets():
    """获取火箭型号数据"""
    data = read_data_file('rockets.json')
    if data is None:
        return jsonify({"error": f"数据文件不存在: rockets.json"}), 404
    return jsonify(data)


@app.route('/api/constellations')
def get_constellations():
    """获取卫星星座数据"""
    data = read_data_file('constellations.json')
    if data is None:
        return jsonify({"error": f"数据文件不存在: constellations.json"}), 404
    return jsonify(data)


@app.route('/api/policies')
def get_policies():
    """获取政策法规数据"""
    data = read_data_file('policy.json')
    if data is None:
        return jsonify({"error": f"数据文件不存在: policy.json"}), 404
    return jsonify(data)


@app.route('/api/industry')
def get_industry():
    """获取产业数据"""
    data = read_data_file('industry.json')
    if data is None:
        return jsonify({"error": f"数据文件不存在: industry.json"}), 404
    return jsonify(data)


@app.route('/api/chain')
def get_chain():
    """获取产业链数据"""
    data = read_data_file('chain.json')
    if data is None:
        return jsonify({"error": f"数据文件不存在: chain.json"}), 404
    return jsonify(data)


@app.route('/api/dashboard')
def get_dashboard():
    """获取首页总览数据（核心指标 / 里程碑 / 快讯）"""
    data = read_data_file('dashboard.json')
    if data is None:
        return jsonify({"error": f"数据文件不存在: dashboard.json"}), 404
    return jsonify(data)


# 可对接的数据集清单：key → 文件名
DATA_FILES_MAP = {
    'rockets': 'rockets.json',
    'constellations': 'constellations.json',
    'industry': 'industry.json',
    'chain': 'chain.json',
    'policy': 'policy.json',
    'dashboard': 'dashboard.json',
}


@app.route('/api/all')
def get_all():
    """
    一次性返回全部数据集，供外部模块单次拉取，避免并发多个请求。
    响应结构：{ <数据集key>: <原文件内容>, ..., "lastUpdated": <各文件最大值> }
    """
    result = {}
    timestamps = []
    for key, filename in DATA_FILES_MAP.items():
        data = read_data_file(filename)
        if data is None:
            continue
        result[key] = data
        if isinstance(data, dict) and data.get('lastUpdated'):
            timestamps.append(data['lastUpdated'])
    result['lastUpdated'] = max(timestamps) if timestamps else None
    return jsonify(result)


@app.route('/api/schema')
def get_schema():
    """
    返回数据集清单：每个数据集包含哪些字段、数据规模与注意事项。
    外部对接方据此生成表单/字典，无需阅读本仓源码。
    """
    return jsonify({
        "datasets": {
            "rockets": {
                "count": 47,
                "desc": "火箭型号参数",
                "fields": ["name", "abbr", "org", "propellant", "diameter", "leo", "gto",
                           "reusable", "site", "launches", "firstFlight", "status",
                           "successRate", "costPerKg", "verified"],
                "notes": "leo/gto 单位吨；successRate 为百分比数值，仅 38 条有值；costPerKg 仅 1 条有值",
            },
            "constellations": {
                "count": 39,
                "desc": "卫星星座规划与部署",
                "fields": ["name", "company", "type", "planned", "actual", "orbit",
                           "frequency", "satWeight", "firstLaunch", "status", "verified"],
                "notes": "planned 规划总数，actual 已部署数",
            },
            "industry": {
                "count": 20,
                "desc": "融资事件明细",
                "fields": ["date", "company", "round", "amount", "segment", "investors", "region"],
                "notes": "amount 为「超5亿」类文本；investors 为顿号分隔字符串，非数组",
            },
            "chain": {
                "desc": "产业链企业矩阵",
                "fields": ["stage", "category", "name", "focus", "region"],
                "notes": "原始结构为三层嵌套 enterpriseMatrix.data → stage → category → companies[]，需自行摊平",
            },
            "policy": {
                "count": 25,
                "desc": "政策法规",
                "fields": ["id", "title", "date", "org", "summary", "type", "source"],
                "notes": "原始结构为三层对象 policyData.{national,ministerial,local}，需自行摊平",
            },
            "dashboard": {
                "desc": "首页总览指标",
                "fields": ["dashboardMetrics", "milestones", "newsTicker", "regionMapData"],
            },
        }
    })


# ==================== 静态文件服务 ====================

@app.route('/')
def serve_index():
    """提供首页"""
    return send_from_directory(FRONTEND_DIST, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """提供静态文件，支持前端路由"""
    file_path = os.path.join(FRONTEND_DIST, path)
    if os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIST, path)
    # 如果文件不存在，返回 index.html（支持 React Router 的前端路由）
    return send_from_directory(FRONTEND_DIST, 'index.html')


# ==================== 启动 ====================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    print(f"=" * 50)
    print(f"中国商业航天政策与产业分析平台")
    print(f"=" * 50)
    print(f"服务地址: http://localhost:{port}")
    print(f"前端目录: {FRONTEND_DIST}")
    print(f"数据目录: {DATA_DIR}")
    print(f"=" * 50)
    app.run(host='0.0.0.0', port=port, debug=debug)
