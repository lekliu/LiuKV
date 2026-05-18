package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port         string
	AuthToken    string
	MaxMemoryMB  int
	EnableCORS   bool
	CORSOrigin   string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8787"),
		AuthToken:   getEnv("AUTH_TOKEN", ""),
		MaxMemoryMB: getEnvInt("MAX_MEMORY_MB", 128),
		EnableCORS:  getEnvBool("ENABLE_CORS", true),
		CORSOrigin:  getEnv("CORS_ORIGIN", "*"),
	}
}

func getEnv(key, defaultValue string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if v, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if v, ok := os.LookupEnv(key); ok {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return defaultValue
}
