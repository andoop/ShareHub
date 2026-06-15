package store

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type FileRecord struct {
	ID           string    `json:"id"`
	OriginalName string    `json:"name"`
	Size         int64     `json:"size"`
	StoragePath  string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
}

type FileStore struct {
	db      *sql.DB
	dataDir string
	blobDir string
}

func NewFileStore(db *sql.DB, dataDir string) (*FileStore, error) {
	blobDir := filepath.Join(dataDir, "blobs")
	if err := os.MkdirAll(blobDir, 0o755); err != nil {
		return nil, fmt.Errorf("create blob dir: %w", err)
	}
	return &FileStore{db: db, dataDir: dataDir, blobDir: blobDir}, nil
}

func (s *FileStore) DataDir() string  { return s.dataDir }
func (s *FileStore) BlobDir() string { return s.blobDir }

func (s *FileStore) UsageStats(ctx context.Context) (totalBytes int64, fileCount int, err error) {
	err = s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(size),0), COUNT(*) FROM files`).Scan(&totalBytes, &fileCount)
	return
}

func (s *FileStore) Save(ctx context.Context, name string, size int64, r io.Reader) (*FileRecord, error) {
	id := uuid.New().String()
	storagePath := filepath.Join(s.blobDir, id)
	f, err := os.Create(storagePath)
	if err != nil {
		return nil, fmt.Errorf("create blob: %w", err)
	}
	written, err := io.Copy(f, r)
	closeErr := f.Close()
	if err != nil {
		os.Remove(storagePath)
		return nil, fmt.Errorf("write blob: %w", err)
	}
	if closeErr != nil {
		os.Remove(storagePath)
		return nil, fmt.Errorf("close blob: %w", closeErr)
	}
	now := time.Now().UTC()
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO files (id, original_name, size, storage_path, created_at) VALUES (?, ?, ?, ?, ?)`,
		id, name, written, storagePath, now.Format(time.RFC3339),
	)
	if err != nil {
		os.Remove(storagePath)
		return nil, fmt.Errorf("insert file: %w", err)
	}
	return &FileRecord{
		ID:           id,
		OriginalName: name,
		Size:         written,
		StoragePath:  storagePath,
		CreatedAt:    now,
	}, nil
}

func (s *FileStore) List(ctx context.Context) ([]FileRecord, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, original_name, size, storage_path, created_at FROM files ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []FileRecord
	for rows.Next() {
		var rec FileRecord
		var created string
		if err := rows.Scan(&rec.ID, &rec.OriginalName, &rec.Size, &rec.StoragePath, &created); err != nil {
			return nil, err
		}
		rec.CreatedAt, _ = time.Parse(time.RFC3339, created)
		out = append(out, rec)
	}
	return out, rows.Err()
}

func (s *FileStore) GetByID(ctx context.Context, id string) (*FileRecord, error) {
	var rec FileRecord
	var created string
	err := s.db.QueryRowContext(ctx,
		`SELECT id, original_name, size, storage_path, created_at FROM files WHERE id = ?`, id,
	).Scan(&rec.ID, &rec.OriginalName, &rec.Size, &rec.StoragePath, &created)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	rec.CreatedAt, _ = time.Parse(time.RFC3339, created)
	return &rec, nil
}

func (s *FileStore) Open(path string) (*os.File, error) {
	return os.Open(path)
}
