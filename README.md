# LiuKV

轻量级、高性能的内存 KV 存储服务，支持多 Namespace 隔离，设计目标是替代 Cloudflare KV 的自托管方案。

## ✨ 特性

- 🚀 **高性能**: 基于 Go + Gin，单实例可达数万 QPS
- 💾 **纯内存存储**: 数据仅存内存，不持久化，丢失可接受
- 🏷️ **多 Namespace**: 支持多应用隔离，数据互不干扰
- ⏰ **TTL 过期**: 支持键的自动过期
- 🧹 **LRU 淘汰**: 内存满时自动淘汰最久未使用的键
- 🔐 **可配置认证**: Token 认证机制
- 🌐 **CORS 支持**: 内置跨域支持
- 🐳 **Docker 部署**: 一键部署到你的服务器
- 🖥️ **Web 管理界面**: 可视化查看和管理数据

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 1. 复制环境变量配置
cp .env.example .env

# 2. 修改 .env 中的 AUTH_TOKEN

# 3. 启动服务
docker-compose up -d
```

### 方式二：本地运行

```bash
# 1. 设置环境变量
export AUTH_TOKEN=your-secret-token
export PORT=8787

# 2. 编译并运行
go build -o liukv main.go
./liukv
```

### 方式三：Docker 直接运行

```bash
docker run -d \
  --name liukv \
  -p 8787:8787 \
  -e AUTH_TOKEN=your-secret-token \
  -e MAX_MEMORY_MB=128 \
  ghcr.io/your-org/liukv:latest
```

## ⚙️ 配置项

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `8787` | 服务监听端口 |
| `AUTH_TOKEN` | `""` | 认证 Token，留空则不启用认证 |
| `MAX_MEMORY_MB` | `128` | 最大内存限制（MB），超过后自动 LRU 淘汰 |
| `ENABLE_CORS` | `true` | 是否启用 CORS |
| `CORS_ORIGIN` | `*` | CORS 允许的来源 |

## 📡 API 文档

### 鉴权

如果配置了 `AUTH_TOKEN`，请求需要携带 Token：

```bash
# Header 方式（推荐）
curl -H "X-KV-Token: your-token" ...

# 或 Authorization Bearer 方式
curl -H "Authorization: Bearer your-token" ...

# 或 Query 参数方式
curl "http://localhost:8787/kv/...?token=your-token"
```

### 基础操作

#### 写入数据
```bash
curl -X PUT "http://localhost:8787/kv/myapp/user_123?ttl=3600" \
  -H "X-KV-Token: your-token" \
  -d '{"name": "张三", "age": 25}'
```
- `ttl`: 可选，过期时间（秒），0 或不填表示永不过期

#### 读取数据
```bash
curl "http://localhost:8787/kv/myapp/user_123" \
  -H "X-KV-Token: your-token"
```
- 成功返回 `200 OK`，Body 为值内容
- 不存在返回 `404 Not Found`

#### 删除数据
```bash
curl -X DELETE "http://localhost:8787/kv/myapp/user_123" \
  -H "X-KV-Token: your-token"
```

#### 列出 Key
```bash
# 列出所有 Key
curl "http://localhost:8787/kv/myapp/_keys" \
  -H "X-KV-Token: your-token"

# 按前缀搜索
curl "http://localhost:8787/kv/myapp/_keys?prefix=user_" \
  -H "X-KV-Token: your-token"
```

#### 清空 Namespace
```bash
curl -X DELETE "http://localhost:8787/kv/myapp/_clear" \
  -H "X-KV-Token: your-token"
```

#### 获取 Namespace 统计
```bash
curl "http://localhost:8787/kv/myapp/_stats" \
  -H "X-KV-Token: your-token"
```

### 批量操作

#### 批量读取
```bash
curl -X POST "http://localhost:8787/kv/myapp/_batch/get" \
  -H "X-KV-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"keys": ["user_123", "user_456", "user_789"]}'
```

#### 批量写入
```bash
curl -X POST "http://localhost:8787/kv/myapp/_batch/put" \
  -H "X-KV-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "user_123": "{\"name\": \"张三\"}",
    "user_456": "{\"name\": \"李四\"}"
  }'
```

### 管理 API

#### 列出所有 Namespace
```bash
curl "http://localhost:8787/kv/_admin/namespaces" \
  -H "X-KV-Token: your-token"
```

#### 删除 Namespace
```bash
curl -X DELETE "http://localhost:8787/kv/_admin/namespaces/myapp" \
  -H "X-KV-Token: your-token"
```

#### 获取全局统计
```bash
curl "http://localhost:8787/kv/_admin/stats" \
  -H "X-KV-Token: your-token"
```

### 健康检查
```bash
curl "http://localhost:8787/health"
```

## 🖥️ Web 管理界面

访问 `http://localhost:8787/ui` 或 `http://localhost:8787/` 打开管理界面。

功能：
- 创建/删除 Namespace
- 查看各 Namespace 统计信息
- 写入、查看、删除 Key-Value
- 按前缀搜索 Key
- 清空 Namespace

## 🏗️ 项目结构

```
LiuKV/
├── main.go                 # 程序入口
├── internal/
│   ├── config/             # 配置加载
│   ├── kv/                 # 核心 KV 存储
│   │   ├── store.go        # 存储引擎（LRU + TTL）
│   │   └── namespace.go    # Namespace 管理
│   ├── handler/            # HTTP 处理器
│   │   ├── kv.go           # KV API
│   │   └── health.go       # 健康检查
│   └── middleware/         # 中间件
│       └── auth.go         # 认证 + CORS
├── public/
│   └── index.html          # Web 管理界面
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## 📊 性能指标

- P99 延迟: < 5ms
- 单实例 QPS: 10,000+
- 内存开销: 每个键值对约 100 字节额外开销

## 🤝 与 Cloudflare KV 的对比

| 特性 | LiuKV | Cloudflare KV |
|------|-------|---------------|
| 部署 | 自有服务器 | Cloudflare 边缘 |
| 性能 | 极快（本地内存） | 快（边缘缓存） |
| 成本 | 服务器成本 | 按使用量付费 |
| 多 Namespace | ✅ 原生支持 | ❌ 需要手动前缀 |
| 数据持久化 | ❌ 纯内存 | ✅ 持久化 |
| 最大 Value | 无限制 | 25MB |
| TTL | ✅ | ✅ |
| 管理界面 | ✅ | ❌ |

## 📝 License

MIT
