package config

import (
	"os"
)

type Config struct {
	Port             string
	DatabaseURL      string
	VisionServiceURL string
	StorageDir       string
	Environment      string
	CORSAllowOrigins []string
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://postgres:postgres@localhost:5432/urban_infrastructure?sslmode=disable"
	}

	visionURL := os.Getenv("VISION_SERVICE_URL")
	if visionURL == "" {
		visionURL = "http://localhost:8001"
	}

	storageDir := os.Getenv("STORAGE_DIR")
	if storageDir == "" {
		storageDir = "../../data/storage"
		if _, err := os.Stat(storageDir); os.IsNotExist(err) {
			storageDir = "data/storage"
		}
	}

	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "development"
	}

	return &Config{
		Port:             port,
		DatabaseURL:      dbURL,
		VisionServiceURL: visionURL,
		StorageDir:       storageDir,
		Environment:      env,
		CORSAllowOrigins: []string{"*"},
	}
}
