package api

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/local/sharehub/internal/store"
)

type FileHandler struct {
	files    *store.FileStore
	maxBytes int64
}

func NewFileHandler(files *store.FileStore, maxUploadMB int64) *FileHandler {
	return &FileHandler{files: files, maxBytes: maxUploadMB * 1024 * 1024}
}

func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, h.maxBytes)
	if err := r.ParseMultipartForm(h.maxBytes); err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "文件过大，请压缩后重试", "FILE_TOO_LARGE")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "请选择要上传的文件", "BAD_REQUEST")
		return
	}
	defer file.Close()

	name := filepath.Base(header.Filename)
	if name == "" || name == "." {
		writeError(w, http.StatusBadRequest, "文件名无效", "BAD_REQUEST")
		return
	}
	name = strings.ReplaceAll(name, "\x00", "")

	rec, err := h.files.Save(r.Context(), name, header.Size, file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "上传失败，请稍后重试", "UPLOAD_FAILED")
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (h *FileHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := h.files.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "加载文件列表失败", "LIST_FAILED")
		return
	}
	if list == nil {
		list = []store.FileRecord{}
	}
	writeJSON(w, http.StatusOK, list)
}
