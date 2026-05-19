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

func (h *KVHandler) GetAll(c *gin.Context) {
	namespace := c.Param("namespace")
	prefix := c.Query("prefix")

	store := h.nm.GetNamespace(namespace)
	data := store.GetAllWithPrefix(prefix)

	c.JSON(http.StatusOK, gin.H{
		"data":  data,
		"count": len(data),
	})
}

func (h *KVHandler) GetMulti(c *gin.Context) {
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
	result := store.GetMulti(req.Keys)

	c.JSON(http.StatusOK, result)
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

func (h *KVHandler) Incr(c *gin.Context) {
	namespace := c.Param("namespace")
	key := c.Param("key")

	amountStr := c.DefaultQuery("amount", "1")
	amount, err := strconv.ParseInt(amountStr, 10, 64)
	if err != nil {
		amount = 1
	}

	store := h.nm.GetNamespace(namespace)
	newValue, err := store.Incr(key, amount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to increment counter",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"key":     key,
		"value":   newValue,
	})
}
