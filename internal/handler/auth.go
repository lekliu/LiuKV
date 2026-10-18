package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authToken string
}

func NewAuthHandler(authToken string) *AuthHandler {
	return &AuthHandler{authToken: authToken}
}

// GetAuthStatus 获取当前服务是否启用了 Token 认证
func (h *AuthHandler) GetAuthStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"authRequired": h.authToken != "",
	})
}

// VerifyToken 验证传入的 Token 是否正确
func (h *AuthHandler) VerifyToken(c *gin.Context) {
	if h.authToken == "" {
		c.JSON(http.StatusOK, gin.H{
			"valid":   true,
			"message": "Auth not required",
		})
		return
	}

	var req struct {
		Token string `json:"token"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Token == h.authToken {
		c.JSON(http.StatusOK, gin.H{
			"valid":   true,
			"message": "Token verified successfully",
		})
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{
			"valid": false,
			"error": "Invalid auth token",
		})
	}
}
