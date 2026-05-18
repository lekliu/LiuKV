package handler

import (
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"liukv/internal/kv"
)

type KVHandler struct {
	nm *kv.NamespaceManager
}

func NewKVHandler(nm *kv.NamespaceManager) *KVHandler {
	return &KVHandler{nm: nm}
}

func (h *KVHandler) Get(c *gin.Context) {
	namespace := c.Param("namespace")
	key := c.Param("key")

	store := h.nm.GetNamespace(namespace)
	value, exists := store.Get(key)

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Key not found",
		})
		return
	}

	c.String(http.StatusOK, value)
}

func (h *KVHandler) Put(c *gin.Context) {
	namespace := c.Param("namespace")
	key := c.Param("key")

	ttlStr := c.Query("ttl")
	ttl := 0
	if ttlStr != "" {
		if t, err := strconv.Atoi(ttlStr); err == nil {
			ttl = t
		}
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Failed to read body",
		})
		return
	}

	value := string(body)
	store := h.nm.GetNamespace(namespace)
	store.Put(key, value, ttl)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"key":     key,
		"ttl":     ttl,
	})
}

func (h *KVHandler) Delete(c *gin.Context) {
	namespace := c.Param("namespace")
	key := c.Param("key")

	store := h.nm.GetNamespace(namespace)
	deleted := store.Delete(key)

	c.JSON(http.StatusOK, gin.H{
		"success": deleted,
	})
}

func (h *KVHandler) ListKeys(c *gin.Context) {
	namespace := c.Param("namespace")
	prefix := c.Query("prefix")

	store := h.nm.GetNamespace(namespace)
	keys := store.ListKeys(prefix)

	c.JSON(http.StatusOK, gin.H{
		"keys": keys,
		"count": len(keys),
	})
}

func (h *KVHandler) Clear(c *gin.Context) {
	namespace := c.Param("namespace")

	store := h.nm.GetNamespace(namespace)
	store.Clear()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
	})
}

func (h *KVHandler) GetStats(c *gin.Context) {
	namespace := c.Param("namespace")

	store := h.nm.GetNamespace(namespace)
	count, used, max := store.Stats()

	c.JSON(http.StatusOK, gin.H{
		"keys":     count,
		"usedMB":   float64(used) / 1024 / 1024,
		"maxMB":    float64(max) / 1024 / 1024,
	})
}

func (h *KVHandler) ListNamespaces(c *gin.Context) {
	namespaces := h.nm.ListNamespaces()

	c.JSON(http.StatusOK, gin.H{
		"namespaces": namespaces,
		"count":      len(namespaces),
	})
}

func (h *KVHandler) CreateNamespace(c *gin.Context) {
	namespace := c.Param("namespace")

	if namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Namespace name is required",
		})
		return
	}

	h.nm.GetNamespace(namespace)

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"namespace": namespace,
	})
}

func (h *KVHandler) DeleteNamespace(c *gin.Context) {
	namespace := c.Param("namespace")

	deleted := h.nm.DeleteNamespace(namespace)

	c.JSON(http.StatusOK, gin.H{
		"success": deleted,
	})
}

func (h *KVHandler) GetAllStats(c *gin.Context) {
	stats := h.nm.GetAllStats()

	c.JSON(http.StatusOK, stats)
}

func (h *KVHandler) BatchGet(c *gin.Context) {
	namespace := c.Param("namespace")

	var req struct {
		Keys []string `json:"keys"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	store := h.nm.GetNamespace(namespace)
	result := make(map[string]interface{})

	for _, key := range req.Keys {
		if value, exists := store.Get(key); exists {
			result[key] = value
		} else {
			result[key] = nil
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *KVHandler) BatchPut(c *gin.Context) {
	namespace := c.Param("namespace")

	var req map[string]string

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	store := h.nm.GetNamespace(namespace)

	for key, value := range req {
		store.Put(key, value, 0)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(req),
	})
}
