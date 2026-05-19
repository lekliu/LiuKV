package kv

import (
	"container/list"
	"strconv"
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

func (s *Store) GetMulti(keys []string) map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]string)
	now := time.Now()

	for _, key := range keys {
		elem, ok := s.data[key]
		if !ok {
			continue
		}

		it := elem.Value.(*item)
		if it.hasExpiry && now.After(it.expireAt) {
			continue
		}

		result[key] = it.value
	}

	return result
}

func (s *Store) GetAllWithPrefix(prefix string) map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]string)
	now := time.Now()

	for k, elem := range s.data {
		it := elem.Value.(*item)
		if it.hasExpiry && now.After(it.expireAt) {
			continue
		}
		if prefix == "" || (len(k) >= len(prefix) && k[:len(prefix)] == prefix) {
			result[k] = it.value
		}
	}

	return result
}

func (s *Store) Put(key, value string, ttlSeconds int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.putInternal(key, value, ttlSeconds)
}

func (s *Store) PutMulti(items map[string]string, ttlSeconds int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for key, value := range items {
		s.putInternal(key, value, ttlSeconds)
	}
}

func (s *Store) Incr(key string, amount int64) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var currentValue int64 = 0

	if elem, ok := s.data[key]; ok {
		it := elem.Value.(*item)
		
		if it.hasExpiry && time.Now().After(it.expireAt) {
			s.deleteElement(elem)
		} else {
			if val, err := strconv.ParseInt(it.value, 10, 64); err == nil {
				currentValue = val
			}
			s.deleteElement(elem)
		}
	}

	newValue := currentValue + amount
	newValueStr := strconv.FormatInt(newValue, 10)
	s.putInternal(key, newValueStr, 0)

	return newValue, nil
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

func (s *Store) putInternal(key, value string, ttlSeconds int) {
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
