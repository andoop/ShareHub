package api

import (
	"net/http"
	"path/filepath"
	"syscall"

	"github.com/local/sharehub/internal/config"
	"github.com/local/sharehub/internal/store"
)

type StorageHandler struct {
	cfg   config.Config
	files *store.FileStore
}

func NewStorageHandler(cfg config.Config, files *store.FileStore) *StorageHandler {
	return &StorageHandler{cfg: cfg, files: files}
}

type storageInfoResponse struct {
	DataDir       string `json:"dataDir"`
	BlobDir       string `json:"blobDir"`
	DatabasePath  string `json:"databasePath"`
	UsedBytes     int64  `json:"usedBytes"`
	FileCount     int    `json:"fileCount"`
	DiskFreeBytes *int64 `json:"diskFreeBytes,omitempty"`
	MaxUploadMB   int64  `json:"maxUploadMB"`
	Configurable  bool   `json:"configurable"`
	ConfigHint    string `json:"configHint"`
}

func (h *StorageHandler) Info(w http.ResponseWriter, r *http.Request) {
	used, count, err := h.files.UsageStats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取存储信息失败", "STORAGE_INFO_FAILED")
		return
	}
	resp := storageInfoResponse{
		DataDir:      h.files.DataDir(),
		BlobDir:      h.files.BlobDir(),
		DatabasePath: filepath.Join(h.files.DataDir(), "sharehub.db"),
		UsedBytes:    used,
		FileCount:    count,
		MaxUploadMB:  h.cfg.MaxUploadMB,
		Configurable: false,
		ConfigHint:   "修改工作目录请设置环境变量 SHAREHUB_DATA_DIR 后重启服务（Docker 可改 compose 卷挂载路径）",
	}
	if free := diskFreeBytes(h.files.DataDir()); free >= 0 {
		resp.DiskFreeBytes = &free
	}
	writeJSON(w, http.StatusOK, resp)
}

func diskFreeBytes(path string) int64 {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return -1
	}
	return int64(stat.Bavail) * int64(stat.Bsize)
}
