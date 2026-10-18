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
- 🐳 **Docker 部署**: 一键多阶段编译构建，产物仅包含单个二进制与极小镜像
- 🖥️ **现代 Web 控制台**: 基于 **React 18 + TailwindCSS + Lucide**，支持 `go:embed` 彻底内置打包到单个二进制文件中

---

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 1. 启动服务（自动完成前端与后端编译）
docker-compose up --build -d
```

### 方式二：本地运行

#### 1. 构建前端 UI（仅首次或界面改动时需要）
```bash
cd web
npm install
npm run build
cd ..
```

#### 2. 编译并运行 Go 服务
```bash
# 编译后的 liukv 二进制内置了前端静态页面，分发时无需携带 web 或 public 目录
go build -o liukv main.go
./liukv
```

浏览器打开 `http://localhost:8787/` 即可访问控制台。

---

## 💻 前端开发与热重载

如果你需要对管理控制台界面进行定制开发：

1. 启动后端服务：
```bash
go run main.go
```
2. 启动前端 Vite 热更新服务：
```bash
cd web
npm install
npm run dev
```
前端开发服务器运行在 `http://localhost:5173`，并通过 Vite 反向代理自动将 `/kv/*` 请求转发至后端的 `8787` 端口，享受秒级热更新体验。

---

## ⚙️ 配置项

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `8787` | 服务监听端口 |
| `AUTH_TOKEN` | `""` | 认证 Token，留空则不启用认证 |
| `MAX_MEMORY_MB` | `128` | 最大内存限制（MB），超过后自动 LRU 淘汰 |
| `ENABLE_CORS` | `true` | 是否启用 CORS |
| `CORS_ORIGIN` | `*` | CORS 允许的来源 |

---

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

#### 计数器自增
```bash
curl -X POST "http://localhost:8787/kv/myapp/_incr/page_views?amount=1" \
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

#### 健康检查
```bash
curl "http://localhost:8787/health"
```

---

## 🏗️ 项目结构

```
LiuKV/
├── main.go                 # 程序入口 (集成 Gin 路由与 UI embed)
├── web/                    # 现代 React 前端控制台源码
│   ├── src/
│   │   ├── api/kv.js       # 封装的前端 API 请求与鉴权拦截
│   │   ├── App.jsx         # 控制台核心界面
│   │   ├── main.jsx
│   │   └── index.css       # Tailwind CSS
│   ├── package.json
│   ├── vite.config.js      # Vite 配置 (打包产物直出至 internal/ui/dist)
│   └── tailwind.config.js
├── internal/
│   ├── config/             # 配置加载
│   ├── kv/                 # 核心 KV 存储
│   │   ├── store.go        # 存储引擎（LRU + TTL）
│   │   └── namespace.go    # Namespace 管理
│   ├── handler/            # HTTP 处理器
│   │   ├── kv.go           # KV API
│   │   └── health.go       # 健康检查
│   ├── middleware/         # 认证 + CORS
│   └── ui/                 # go:embed 静态资源打包
│       └── ui.go           # 嵌入式文件系统路由
├── Dockerfile              # 多阶段编译构建 (Node -> Go -> Alpine)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 📝 License

MIT
