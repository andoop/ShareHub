package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/local/sharehub/internal/config"
	"github.com/local/sharehub/internal/db"
	"github.com/local/sharehub/internal/store"
)

func testServer(t *testing.T) (*Server, *store.ShareStore, *store.FileStore) {
	t.Helper()
	dir := t.TempDir()
	conn, err := db.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	files, err := store.NewFileStore(conn, dir, "")
	if err != nil {
		t.Fatal(err)
	}
	shares := store.NewShareStore(conn)
	cfg := config.Config{
		AdminUser:   "admin",
		AdminPass:   "Secret123!",
		JWTSecret:   "test-secret",
		MaxUploadMB: 100,
	}
	srv := NewServer(cfg, files, shares, nil)
	return srv, shares, files
}

func loginToken(t *testing.T, srv *Server) string {
	t.Helper()
	body := bytes.NewBufferString(`{"user":"admin","pass":"Secret123!"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("login status %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	return resp.Token
}

func TestAuthLoginSuccess(t *testing.T) {
	srv, _, _ := testServer(t)
	body := bytes.NewBufferString(`{"user":"admin","pass":"Secret123!"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestAuthLoginFailure(t *testing.T) {
	srv, _, _ := testServer(t)
	body := bytes.NewBufferString(`{"user":"admin","pass":"wrong"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestUploadUnauthorized(t *testing.T) {
	srv, _, _ := testServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/files/upload", nil)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestUploadAndList(t *testing.T) {
	srv, _, _ := testServer(t)
	token := loginToken(t, srv)

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("file", "vacation.mp4")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.Copy(part, bytes.NewReader(make([]byte, 1024))); err != nil {
		t.Fatal(err)
	}
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/files/upload", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("upload status %d: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/files", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("list status %d", w.Code)
	}
	var files []store.FileRecord
	if err := json.NewDecoder(w.Body).Decode(&files); err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || files[0].OriginalName != "vacation.mp4" {
		t.Fatalf("unexpected files: %+v", files)
	}
}

func TestShareCreateRevokeAndDownload(t *testing.T) {
	srv, shares, files := testServer(t)
	token := loginToken(t, srv)

	rec, err := files.Save(context.Background(), "report.pdf", 5, bytes.NewReader([]byte("hello")))
	if err != nil {
		t.Fatal(err)
	}

	// create share with passphrase
	body := bytes.NewBufferString(`{"fileId":"` + rec.ID + `","passphrase":"blue7","note":"发给小李"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/shares", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("create share %d: %s", w.Code, w.Body.String())
	}
	var created createShareResponse
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	if created.Token == "" || created.Note != "发给小李" {
		t.Fatalf("unexpected share: %+v", created)
	}

	// wrong passphrase
	body = bytes.NewBufferString(`{"passphrase":"wrong1"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/public/shares/"+created.Token+"/verify", body)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong passphrase, got %d", w.Code)
	}

	// correct passphrase
	body = bytes.NewBufferString(`{"passphrase":"blue7"}`)
	req = httptest.NewRequest(http.MethodPost, "/api/public/shares/"+created.Token+"/verify", body)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("verify failed %d", w.Code)
	}
	var verifyResp verifyResponse
	if err := json.NewDecoder(w.Body).Decode(&verifyResp); err != nil {
		t.Fatal(err)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/public/shares/"+created.Token+"/download", nil)
	req.Header.Set("X-Download-Ticket", verifyResp.DownloadTicket)
	w = httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("download failed %d: %s", w.Code, w.Body.String())
	}

	// revoke
	req = httptest.NewRequest(http.MethodDelete, "/api/shares/"+created.ID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("revoke failed %d", w.Code)
	}

	share, _ := shares.GetByID(context.Background(), created.ID)
	if share == nil || !share.Revoked {
		t.Fatal("share should be revoked")
	}

	req = httptest.NewRequest(http.MethodGet, "/api/public/shares/"+created.Token+"/", nil)
	w = httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusGone {
		t.Fatalf("expected 410 after revoke, got %d", w.Code)
	}
}

func TestExpiredShare(t *testing.T) {
	srv, shares, files := testServer(t)
	rec, err := files.Save(context.Background(), "old.txt", 3, bytes.NewReader([]byte("x")))
	if err != nil {
		t.Fatal(err)
	}
	past := time.Now().Add(-time.Hour)
	share, err := shares.Create(context.Background(), store.CreateShareInput{
		FileID:    rec.ID,
		ExpiresAt: &past,
	})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/public/shares/"+share.Token+"/", nil)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusGone {
		t.Fatalf("expected 410 for expired, got %d", w.Code)
	}
}

func TestDirectDownloadNoPassphrase(t *testing.T) {
	srv, shares, files := testServer(t)
	rec, err := files.Save(context.Background(), "report.pdf", 5, bytes.NewReader([]byte("hello")))
	if err != nil {
		t.Fatal(err)
	}
	share, err := shares.Create(context.Background(), store.CreateShareInput{FileID: rec.ID})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/public/shares/"+share.Token+"/download", nil)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("direct download failed %d", w.Code)
	}
}
