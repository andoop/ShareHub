package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/local/sharehub/internal/store"
	"github.com/skip2/go-qrcode"
)

type DownloadHandler struct {
	shares *store.ShareStore
	files  *store.FileStore
	tickets *ticketStore
}

func NewDownloadHandler(shares *store.ShareStore, files *store.FileStore) *DownloadHandler {
	return &DownloadHandler{
		shares:  shares,
		files:   files,
		tickets: newTicketStore(),
	}
}

type publicShareInfo struct {
	FileName      string `json:"fileName"`
	Size          int64  `json:"size"`
	NeedsPassphrase bool `json:"needsPassphrase"`
	Status        string `json:"status"`
	Message       string `json:"message,omitempty"`
}

func (h *DownloadHandler) GetInfo(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	rec, file, status, msg := h.loadShare(r, token)
	if status != store.ShareOK {
		writeJSON(w, http.StatusGone, publicShareInfo{
			Status:  string(status),
			Message: msg,
		})
		return
	}
	writeJSON(w, http.StatusOK, publicShareInfo{
		FileName:        file.OriginalName,
		Size:            file.Size,
		NeedsPassphrase: rec.HasPassphrase,
		Status:          "ok",
	})
}

type verifyRequest struct {
	Passphrase string `json:"passphrase"`
}

type verifyResponse struct {
	DownloadTicket string `json:"downloadTicket"`
}

func (h *DownloadHandler) Verify(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	rec, _, status, msg := h.loadShare(r, token)
	if status != store.ShareOK {
		writeError(w, http.StatusGone, msg, shareErrorCode(status))
		return
	}
	if !rec.HasPassphrase {
		ticket := h.tickets.issue(rec.ID)
		writeJSON(w, http.StatusOK, verifyResponse{DownloadTicket: ticket})
		return
	}
	var req verifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确", "BAD_REQUEST")
		return
	}
	if err := h.shares.VerifyPassphrase(r.Context(), token, req.Passphrase); err != nil {
		writeError(w, http.StatusUnauthorized, "提取码错误，请向分享者确认", "INVALID_PASSPHRASE")
		return
	}
	ticket := h.tickets.issue(rec.ID)
	writeJSON(w, http.StatusOK, verifyResponse{DownloadTicket: ticket})
}

func (h *DownloadHandler) Download(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	rec, file, status, msg := h.loadShare(r, token)
	if status != store.ShareOK {
		writeError(w, http.StatusGone, msg, shareErrorCode(status))
		return
	}

	if rec.HasPassphrase {
		ticket := r.Header.Get("X-Download-Ticket")
		if ticket == "" {
			cookie, err := r.Cookie("download_ticket")
			if err == nil {
				ticket = cookie.Value
			}
		}
		if ticket == "" {
			ticket = r.URL.Query().Get("ticket")
		}
		if !h.tickets.consume(ticket, rec.ID) {
			writeError(w, http.StatusUnauthorized, "请先验证提取码", "PASSPHRASE_REQUIRED")
			return
		}
	}

	f, err := h.files.Open(file.StoragePath)
	if err != nil {
		writeError(w, http.StatusGone, "文件不可用，请联系分享者", "FILE_UNAVAILABLE")
		return
	}
	defer f.Close()

	if err := h.shares.IncrementDownload(r.Context(), rec.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "下载失败，请稍后重试", "DOWNLOAD_FAILED")
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", contentDisposition(file.OriginalName))
	w.Header().Set("Content-Length", strconv.FormatInt(file.Size, 10))
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, f)
}

func (h *DownloadHandler) loadShare(r *http.Request, token string) (*store.ShareRecord, *store.FileRecord, store.ShareStatus, string) {
	rec, err := h.shares.GetByToken(r.Context(), token)
	if err != nil || rec == nil {
		return nil, nil, store.ShareNotFound, "分享不存在或已失效，请联系分享者重新发送"
	}
	status := h.shares.CheckAccess(rec)
	if status != store.ShareOK {
		return rec, nil, status, shareStatusMessage(status)
	}
	file, err := h.files.GetByID(r.Context(), rec.FileID)
	if err != nil || file == nil {
		return rec, nil, store.ShareNotFound, "分享不存在或已失效，请联系分享者重新发送"
	}
	return rec, file, store.ShareOK, ""
}

func shareStatusMessage(s store.ShareStatus) string {
	switch s {
	case store.ShareRevoked:
		return "分享已失效，请联系分享者重新发送"
	case store.ShareExpired:
		return "分享已过期，请联系分享者重新发送"
	case store.ShareExceeded:
		return "下载次数已达上限，请联系分享者"
	default:
		return "分享不存在或已失效，请联系分享者重新发送"
	}
}

func shareErrorCode(s store.ShareStatus) string {
	switch s {
	case store.ShareRevoked:
		return "SHARE_REVOKED"
	case store.ShareExpired:
		return "SHARE_EXPIRED"
	case store.ShareExceeded:
		return "SHARE_EXCEEDED"
	default:
		return "SHARE_NOT_FOUND"
	}
}

func qrcodePNG(content string) ([]byte, error) {
	return qrcode.Encode(content, qrcode.Medium, 256)
}

type ticketStore struct {
	mu      sync.Mutex
	tickets map[string]ticketEntry
}

type ticketEntry struct {
	shareID   string
	expiresAt time.Time
}

func newTicketStore() *ticketStore {
	ts := &ticketStore{tickets: make(map[string]ticketEntry)}
	go ts.cleanupLoop()
	return ts
}

func (ts *ticketStore) issue(shareID string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	ticket := hex.EncodeToString(b)
	ts.mu.Lock()
	ts.tickets[ticket] = ticketEntry{shareID: shareID, expiresAt: time.Now().Add(15 * time.Minute)}
	ts.mu.Unlock()
	return ticket
}

func (ts *ticketStore) consume(ticket, shareID string) bool {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	entry, ok := ts.tickets[ticket]
	if !ok || entry.shareID != shareID || time.Now().After(entry.expiresAt) {
		return false
	}
	delete(ts.tickets, ticket)
	return true
}

func (ts *ticketStore) cleanupLoop() {
	for {
		time.Sleep(5 * time.Minute)
		ts.mu.Lock()
		now := time.Now()
		for k, v := range ts.tickets {
			if now.After(v.expiresAt) {
				delete(ts.tickets, k)
			}
		}
		ts.mu.Unlock()
	}
}

func contentDisposition(name string) string {
	return "attachment; filename=\"" + name + "\""
}
