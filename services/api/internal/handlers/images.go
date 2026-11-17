package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

type ImageHandler struct {
	storageDir string
}

func NewImageHandler(storageDir string) *ImageHandler {
	return &ImageHandler{storageDir: storageDir}
}

func (h *ImageHandler) ServeImage(w http.ResponseWriter, r *http.Request) {
	subPath := chi.URLParam(r, "*")
	if subPath == "" {
		http.Error(w, "Image path missing", http.StatusBadRequest)
		return
	}

	// Prevent path traversal
	cleaned := filepath.Clean(subPath)
	if strings.Contains(cleaned, "..") || strings.HasPrefix(cleaned, "/") {
		http.Error(w, "Invalid image path", http.StatusBadRequest)
		return
	}

	fullPath := filepath.Join(h.storageDir, cleaned)
	info, err := os.Stat(fullPath)
	if os.IsNotExist(err) || info.IsDir() {
		// Also try looking in images/batch-0001
		altPath := filepath.Join(h.storageDir, "images", "batch-0001", filepath.Base(cleaned))
		if altInfo, altErr := os.Stat(altPath); altErr == nil && !altInfo.IsDir() {
			fullPath = altPath
		} else {
			http.Error(w, "Image not found", http.StatusNotFound)
			return
		}
	}

	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("Content-Type", "image/jpeg")
	http.ServeFile(w, r, fullPath)
}
