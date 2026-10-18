package main

import (
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"liukv/internal/config"
	"liukv/internal/handler"
	"liukv/internal/kv"
	"liukv/internal/middleware"
	"liukv/internal/ui"
)

func main() {
	cfg := config.Load()

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	if cfg.EnableCORS {
		r.Use(middleware.CORSMiddleware(cfg.CORSOrigin))
	}

	nm := kv.NewNamespaceManager(cfg.MaxMemoryMB)
	kvHandler := handler.NewKVHandler(nm)
	authHandler := handler.NewAuthHandler(cfg.AuthToken)

	r.GET("/health", handler.Health)

	// 专门的认证状态检查与验证接口（无需 Token 即可访问）
	authApi := r.Group("/api/auth")
	{
		authApi.GET("/status", authHandler.GetAuthStatus)
		authApi.POST("/verify", authHandler.VerifyToken)
	}

	api := r.Group("/kv")
	if cfg.AuthToken != "" {
		api.Use(middleware.AuthMiddleware(cfg.AuthToken))
	}

	api.GET("/_admin/namespaces", kvHandler.ListNamespaces)
	api.POST("/_admin/namespaces/:namespace", kvHandler.CreateNamespace)
	api.DELETE("/_admin/namespaces/:namespace", kvHandler.DeleteNamespace)
	api.GET("/_admin/stats", kvHandler.GetAllStats)

	api.GET("/:namespace/_stats", kvHandler.GetStats)
	api.GET("/:namespace/_keys", kvHandler.ListKeys)
	api.GET("/:namespace/_all", kvHandler.GetAll)
	api.POST("/:namespace/_multi/get", kvHandler.GetMulti)
	api.DELETE("/:namespace/_clear", kvHandler.Clear)
	api.POST("/:namespace/_incr/:key", kvHandler.Incr)

	api.GET("/:namespace/:key", kvHandler.Get)
	api.PUT("/:namespace/:key", kvHandler.Put)
	api.DELETE("/:namespace/:key", kvHandler.Delete)

	// 注册前端 UI (go:embed 嵌入)
	ui.RegisterUIRoutes(r)

	log.Printf("LiuKV server starting on port %s", cfg.Port)
	log.Printf("Auth enabled: %v", cfg.AuthToken != "")
	log.Printf("Max memory: %d MB", cfg.MaxMemoryMB)
	log.Printf("CORS enabled: %v, origin: %s", cfg.EnableCORS, cfg.CORSOrigin)

	if err := r.Run(fmt.Sprintf(":%s", cfg.Port)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
