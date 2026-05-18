package kv

import (
	"container/list"
	"sync"
	"time"
)

type item struct {
	key        string
	value      string
	expireAt   time.Time
	hasExpiry  bool
	lastAccess time.Time
}

type Store struct {
	mu        sync.RWMutex
	data      map[string]*list.Element
	lruList   *list.List
	maxBytes  int64
	usedBytes int64
}

func NewStore(maxMemoryMB int) *Store {
	return &Store{
		data:     make(map[string]*list.Element),
		lruList:  list.New(),
		maxBytes: int64(maxMemoryMB) * 1024 * 1024,
	}
}

func (s *Store) Get(key string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	elem, ok := s.data[key]
	if !ok {
		return "", false
	}

	it := elem.Value.(*item)

	if it.hasExpiry && time.Now().After(it.expireAt) {
		s.deleteElement(elem)
		return "", false
	}

	it.lastAccess = time.Now()
	s.lruList.MoveToFront(elem)

	return it.value, true
}

func (s *Store) Put(key, value string, ttlSeconds int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if elem, ok := s.data[key]; ok {
		oldItem := elem.Value.(*item)
		s.usedBytes -= int64(len(oldItem.value))
		s.lruList.Remove(elem)
		delete(s.data, key)
	}

	newItem := &item{
		key:        key,
		value:      value,
		lastAccess: time.Now(),
	}

	if ttlSeconds > 0 {
		newItem.expireAt = time.Now().Add(time.Duration(ttlSeconds) * time.Second)
		newItem.hasExpiry = true
	}

	elem := s.lruList.PushFront(newItem)
	s.data[key] = elem
	s.usedBytes += int64(len(value))

	s.evictIfNeeded()
}

func (s *Store) Delete(key string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	elem, ok := s.data[key]
	if !ok {
		return false
	}

	s.deleteElement(elem)
	return true
}

func (s *Store) ListKeys(prefix string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now()
	keys := make([]string, 0, len(s.data))

	for k, elem := range s.data {
		it := elem.Value.(*item)
		if it.hasExpiry && now.After(it.expireAt) {
			continue
		}
		if prefix == "" || (len(k) >= len(prefix) && k[:len(prefix)] == prefix) {
			keys = append(keys, k)
		}
	}

	return keys
}

func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.data = make(map[string]*list.Element)
	s.lruList.Init()
	s.usedBytes = 0
}

func (s *Store) Stats() (count int, usedBytes int64, maxBytes int64) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return len(s.data), s.usedBytes, s.maxBytes
}

func (s *Store) CleanExpired() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	expiredCount := 0

	for k, elem := range s.data {
		it := elem.Value.(*item)
		if it.hasExpiry && now.After(it.expireAt) {
			s.lruList.Remove(elem)
			delete(s.data, k)
			s.usedBytes -= int64(len(it.value))
			expiredCount++
		}
	}

	return expiredCount
}

func (s *Store) deleteElement(elem *list.Element) {
	it := elem.Value.(*item)
	s.usedBytes -= int64(len(it.value))
	s.lruList.Remove(elem)
	delete(s.data, it.key)
}

func (s *Store) evictIfNeeded() {
	if s.maxBytes <= 0 {
		return
	}

	for s.usedBytes > s.maxBytes && s.lruList.Len() > 0 {
		elem := s.lruList.Back()
		if elem == nil {
			break
		}
		s.deleteElement(elem)
	}
}
