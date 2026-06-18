package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"

	"github.com/local/sharehub/internal/api"
	"github.com/local/sharehub/internal/config"
	"github.com/local/sharehub/internal/db"
	"github.com/local/sharehub/internal/store"
)

//go:embed all:static
var staticFS embed.FS

func main() {
	cfg := config.Load()
	if cfg.AdminPass == "" {
		log.Fatal("SHAREHUB_ADMIN_PASS required")
	}

	conn, err := db.Open(cfg.DataDir)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer conn.Close()

	fileStore, err := store.NewFileStore(conn, cfg.DataDir, cfg.BlobDir)
	if err != nil {
		log.Fatalf("file store: %v", err)
	}
	shareStore := store.NewShareStore(conn)

	var webFS fs.FS
	sub, err := fs.Sub(staticFS, "static")
	if err == nil {
		if _, err := fs.Stat(sub, "index.html"); err == nil {
			webFS = sub
		}
	}

	srv := api.NewServer(cfg, fileStore, shareStore, webFS)
	addr := cfg.Addr
	log.Printf("ShareHub listening on %s", addr)
	if err := http.ListenAndServe(addr, srv.Router()); err != nil {
		log.Fatal(err)
	}
}
