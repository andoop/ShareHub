package api

import (
	"io"
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/local/sharehub/internal/auth"
	"github.com/local/sharehub/internal/config"
	"github.com/local/sharehub/internal/store"
)

type Server struct {
	cfg    config.Config
	auth   *auth.Service
	authH  *AuthHandler
	fileH  *FileHandler
	shareH *ShareHandler
	downH  *DownloadHandler
	webFS  fs.FS
}

func NewServer(cfg config.Config, files *store.FileStore, shares *store.ShareStore, webFS fs.FS) *Server {
	authSvc := auth.NewService(cfg.AdminUser, cfg.AdminPass, cfg.JWTSecret)
	return &Server{
		cfg:    cfg,
		auth:   authSvc,
		authH:  NewAuthHandler(authSvc),
		fileH:  NewFileHandler(files, cfg.MaxUploadMB),
		shareH: NewShareHandler(shares, files, cfg.PublicBaseURL),
		downH:  NewDownloadHandler(shares, files),
		webFS:  webFS,
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Logger)

	r.Post("/api/auth/login", s.authH.Login)

	r.Route("/api", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(s.auth.Middleware)
			r.Get("/auth/me", s.authH.Me)
			r.Post("/files/upload", s.fileH.Upload)
			r.Get("/files", s.fileH.List)
			r.Post("/shares", s.shareH.Create)
			r.Get("/shares", s.shareH.List)
			r.Delete("/shares/{id}", s.shareH.Revoke)
			r.Get("/shares/{id}/qrcode", s.shareH.QRCode)
		})
	})

	r.Route("/api/public/shares/{token}", func(r chi.Router) {
		r.Get("/", s.downH.GetInfo)
		r.Post("/verify", s.downH.Verify)
		r.Get("/download", s.downH.Download)
	})

	if s.webFS != nil {
		r.Get("/*", s.serveSPA)
	}

	return r
}

func (s *Server) serveSPA(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" {
		path = "index.html"
	}
	if strings.HasPrefix(path, "api/") {
		writeError(w, http.StatusNotFound, "页面不存在", "NOT_FOUND")
		return
	}
	f, err := s.webFS.Open(path)
	if err != nil {
		f, err = s.webFS.Open("index.html")
		if err != nil {
			writeError(w, http.StatusNotFound, "页面不存在", "NOT_FOUND")
			return
		}
	}
	defer f.Close()
	stat, err := f.Stat()
	if err != nil || stat.IsDir() {
		idx, err := s.webFS.Open("index.html")
		if err != nil {
			writeError(w, http.StatusNotFound, "页面不存在", "NOT_FOUND")
			return
		}
		defer idx.Close()
		idxStat, _ := idx.Stat()
		rs, ok := idx.(io.ReadSeeker)
		if !ok {
			writeError(w, http.StatusInternalServerError, "页面加载失败", "INTERNAL")
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeContent(w, r, "index.html", idxStat.ModTime(), rs)
		return
	}
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		writeError(w, http.StatusInternalServerError, "页面加载失败", "INTERNAL")
		return
	}
	if ct := mimeForPath(path); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeContent(w, r, path, stat.ModTime(), rs)
}

func mimeForPath(path string) string {
	switch {
	case strings.HasSuffix(path, ".html"):
		return "text/html; charset=utf-8"
	case strings.HasSuffix(path, ".js"):
		return "application/javascript"
	case strings.HasSuffix(path, ".css"):
		return "text/css; charset=utf-8"
	case strings.HasSuffix(path, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(path, ".png"):
		return "image/png"
	case strings.HasSuffix(path, ".ico"):
		return "image/x-icon"
	default:
		return ""
	}
}
