# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LiuKV is a lightweight, in-memory key-value store service written in Go (using Gin). It supports multi-namespace isolation, TTL-based key expiration, LRU eviction on memory limits, configurable token authentication, and embeds a modern **React 18 + TailwindCSS** web management console directly into the binary using Go 1.16+ `embed.FS`.

## Common Commands

### Frontend (`web/`)
- **Install dependencies**: `cd web && npm install`
- **Run frontend dev server (with HMR & proxy to :8787)**: `cd web && npm run dev`
- **Build frontend**: `cd web && npm run build` (outputs to `internal/ui/dist`)

### Backend & Local Run
- **Run locally**: `go run main.go`
- **Build single binary (embeds frontend)**: `go build -o liukv main.go` (or `go build -o liukv.exe main.go` on Windows)
- **Download dependencies**: `go mod download`
- **Tidy dependencies**: `go mod tidy`

### Tests & Quality
- **Run all tests**: `go test ./...`
- **Run tests with verbose output**: `go test -v ./...`
- **Run tests in a specific package**: `go test ./internal/kv/...`
- **Run a single test**: `go test -v -run ^TestName$ ./internal/kv/`
- **Lint**: `golangci-lint run` (or `go vet ./...`)

### Docker
- **Build image (multi-stage: Node build -> Go build -> Alpine)**: `docker build -t liukv:latest .`
- **Run compose**: `docker-compose up --build -d`

## Architecture & Code Structure

- `main.go`: Application entrypoint. Loads config, sets up Gin router, registers health checks, KV API routes, and mounts the embedded React UI via `ui.RegisterUIRoutes(r)`.
- `internal/ui/`:
  - `ui.go`: Uses `//go:embed all:dist` to compile the built React SPA directly into the executable and handles SPA fallback routing for non-API routes.
  - `dist/`: Build output destination from `web/`. Contains a placeholder file to ensure Go builds succeed even before the first frontend build.
- `web/`: Modern React 18 single-page application.
  - `src/api/kv.js`: Client library handling `X-KV-Token` injection, 401 interceptor, and REST API calls.
  - `src/App.jsx`: Main console view (Namespace management, memory/keys metrics, prefix search, JSON validation/formatting, increment helpers).
  - `vite.config.js`: Configured to output directly to `internal/ui/dist` and proxy `/kv` and `/health` to backend during development.
- `internal/config/config.go`: Environment-variable-based configuration (`PORT`, `AUTH_TOKEN`, `MAX_MEMORY_MB`, `ENABLE_CORS`, `CORS_ORIGIN`).
- `internal/kv/`:
  - `store.go`: Per-namespace storage engine. Implements in-memory data structures using `map[string]*list.Element` with `container/list` for LRU eviction, protected by `sync.RWMutex`.
  - `namespace.go`: Manages namespace instances (`NamespaceManager`), background TTL expiration sweep (`CleanExpired` every 1 minute), and aggregated statistics.
- `internal/handler/`:
  - `kv.go`: Gin handlers for KV operations and admin operations.
  - `health.go`: `/health` endpoint returning server status and uptime.
- `internal/middleware/`:
  - `auth.go`: `AuthMiddleware` (checks `Authorization: Bearer <token>`, `X-KV-Token`, or `?token=`) and `CORSMiddleware`.

## Key Implementation Details

- **Embedded UI**: The executable is 100% self-contained. Running `liukv` without any sibling folders will serve both the API and the full Web UI at `/`.
- **Memory Management**: The memory limit (`MAX_MEMORY_MB`) applies per namespace store. Eviction removes least-recently-used items when `usedBytes > maxBytes`.
- **TTL Expiration**: Expired keys are discarded lazily during access (`Get`, `ListKeys`, etc.) and eagerly via the 1-minute background loop in `NamespaceManager.startCleanupLoop`.
