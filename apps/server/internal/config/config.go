package config

import (
	"os"
	"strconv"
)

type Config struct {
	Addr         string
	DataDir      string
	BlobDir      string
	AdminUser    string
	AdminPass    string
	JWTSecret    string
	MaxUploadMB  int64
	PublicBaseURL string
}

func Load() Config {
	maxMB := int64(2048)
	if v := os.Getenv("SHAREHUB_MAX_UPLOAD_MB"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			maxMB = n
		}
	}
	return Config{
		Addr:          getenv("SHAREHUB_ADDR", ":8080"),
		DataDir:       getenv("SHAREHUB_DATA_DIR", "./data"),
		BlobDir:       os.Getenv("SHAREHUB_BLOB_DIR"),
		AdminUser:     getenv("SHAREHUB_ADMIN_USER", "admin"),
		AdminPass:     os.Getenv("SHAREHUB_ADMIN_PASS"),
		JWTSecret:     getenv("SHAREHUB_JWT_SECRET", "change-me-in-prod"),
		MaxUploadMB:   maxMB,
		PublicBaseURL: getenv("SHAREHUB_PUBLIC_BASE_URL", ""),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
