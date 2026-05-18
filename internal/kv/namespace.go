package kv

import (
	"sync"
	"time"
)

type NamespaceManager struct {
	mu         sync.RWMutex
	namespaces map[string]*Store
	maxMemoryMB int
}

func NewNamespaceManager(maxMemoryMB int) *NamespaceManager {
	nm := &NamespaceManager{
		namespaces:  make(map[string]*Store),
		maxMemoryMB: maxMemoryMB,
	}

	go nm.startCleanupLoop()

	return nm
}

func (nm *NamespaceManager) GetNamespace(name string) *Store {
	nm.mu.RLock()
	store, exists := nm.namespaces[name]
	nm.mu.RUnlock()

	if exists {
		return store
	}

	nm.mu.Lock()
	defer nm.mu.Unlock()

	store, exists = nm.namespaces[name]
	if !exists {
		store = NewStore(nm.maxMemoryMB)
		nm.namespaces[name] = store
	}

	return store
}

func (nm *NamespaceManager) ListNamespaces() []string {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	names := make([]string, 0, len(nm.namespaces))
	for name := range nm.namespaces {
		names = append(names, name)
	}
	return names
}

func (nm *NamespaceManager) DeleteNamespace(name string) bool {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	if _, exists := nm.namespaces[name]; !exists {
		return false
	}

	delete(nm.namespaces, name)
	return true
}

func (nm *NamespaceManager) startCleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		nm.mu.RLock()
		for _, store := range nm.namespaces {
			store.CleanExpired()
		}
		nm.mu.RUnlock()
	}
}

func (nm *NamespaceManager) GetAllStats() map[string]interface{} {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	result := make(map[string]interface{})
	var totalKeys int
	var totalUsed int64

	for name, store := range nm.namespaces {
		count, used, max := store.Stats()
		result[name] = map[string]interface{}{
			"keys":     count,
			"usedMB":   float64(used) / 1024 / 1024,
			"maxMB":    float64(max) / 1024 / 1024,
		}
		totalKeys += count
		totalUsed += used
	}

	result["_total"] = map[string]interface{}{
		"namespaces": len(nm.namespaces),
		"totalKeys":  totalKeys,
		"totalUsedMB": float64(totalUsed) / 1024 / 1024,
	}

	return result
}
