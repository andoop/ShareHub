package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/local/sharehub/internal/store"
)

type ShareHandler struct {
	shares        *store.ShareStore
	files         *store.FileStore
	publicBaseURL string
}

func NewShareHandler(shares *store.ShareStore, files *store.FileStore, publicBaseURL string) *ShareHandler {
	return &ShareHandler{shares: shares, files: files, publicBaseURL: publicBaseURL}
}

type createShareRequest struct {
	FileID       string  `json:"fileId"`
	Passphrase   string  `json:"passphrase"`
	ExpiresAt    *string `json:"expiresAt"`
	MaxDownloads *int    `json:"maxDownloads"`
	Note         string  `json:"note"`
}

type createShareResponse struct {
	store.ShareRecord
	ShareURL string `json:"shareUrl"`
}

func (h *ShareHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确", "BAD_REQUEST")
		return
	}
	if req.FileID == "" {
		writeError(w, http.StatusBadRequest, "请选择要分享的文件", "BAD_REQUEST")
		return
	}
	file, err := h.files.GetByID(r.Context(), req.FileID)
	if err != nil || file == nil {
		writeError(w, http.StatusNotFound, "文件不存在", "NOT_FOUND")
		return
	}
	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			writeError(w, http.StatusBadRequest, "过期时间格式不正确", "BAD_REQUEST")
			return
		}
		expiresAt = &t
	}
	rec, err := h.shares.Create(r.Context(), store.CreateShareInput{
		FileID:       req.FileID,
		Passphrase:   req.Passphrase,
		ExpiresAt:    expiresAt,
		MaxDownloads: req.MaxDownloads,
		Note:         req.Note,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建分享失败，请稍后重试", "CREATE_FAILED")
		return
	}
	writeJSON(w, http.StatusOK, createShareResponse{
		ShareRecord: *rec,
		ShareURL:    h.shareURL(rec.Token, r),
	})
}

func (h *ShareHandler) shareURL(token string, r *http.Request) string {
	if h.publicBaseURL != "" {
		return h.publicBaseURL + "/s/" + token
	}
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + r.Host + "/s/" + token
}

func (h *ShareHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := h.shares.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "加载分享列表失败", "LIST_FAILED")
		return
	}
	if list == nil {
		list = []store.ShareRecord{}
	}
	type item struct {
		store.ShareRecord
		ShareURL string `json:"shareUrl"`
		Status   string `json:"status"`
	}
	out := make([]item, 0, len(list))
	for _, s := range list {
		st := h.statusLabel(&s)
		out = append(out, item{
			ShareRecord: s,
			ShareURL:    h.shareURL(s.Token, r),
			Status:      st,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *ShareHandler) statusLabel(s *store.ShareRecord) string {
	switch h.shares.CheckAccess(s) {
	case store.ShareRevoked:
		return "已撤销"
	case store.ShareExpired:
		return "已过期"
	case store.ShareExceeded:
		return "已达上限"
	default:
		return "有效"
	}
}

func (h *ShareHandler) Revoke(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "分享不存在", "BAD_REQUEST")
		return
	}
	if err := h.shares.Revoke(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, "分享不存在", "NOT_FOUND")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "已撤销"})
}

func (h *ShareHandler) QRCode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rec, err := h.shares.GetByID(r.Context(), id)
	if err != nil || rec == nil {
		writeError(w, http.StatusNotFound, "分享不存在", "NOT_FOUND")
		return
	}
	url := h.shareURL(rec.Token, r)
	png, err := qrcodePNG(url)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成二维码失败", "QRCODE_FAILED")
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", strconv.Itoa(len(png)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(png)
}
