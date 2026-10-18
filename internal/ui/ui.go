package ui

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

//go:embed all:dist
var distFS embed.FS

// RegisterUIRoutes 注册前端 SPA 静态页面路由
func RegisterUIRoutes(r *gin.Engine) {
	subFS, err := fs.Sub(distFS, "dist")
	if err != nil {
		return
	}

	fileServer := http.FileServer(http.FS(subFS))

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// API 请求未匹配到时返回 404 JSON
		if strings.HasPrefix(path, "/kv/") || strings.HasPrefix(path, "/api/") || path == "/health" {
			c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
			return
		}

		// 检查资源文件是否存在 (如 js, css, png)
		f, err := subFS.Open(strings.TrimPrefix(path, "/"))
		if err == nil {
			_ = f.Close()
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		// SPA 单页路由兜底返回 index.html
		indexFile, err := subFS.Open("index.html")
		if err != nil {
			c.String(http.StatusNotFound, "UI not found. Please build frontend first.")
			return
		}
		defer indexFile.Close()

		http.ServeContent(c.Writer, c.Request, "index.html", time.Now(), indexFile.(io.ReadSeeker))
	})
}
