package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type ShareRecord struct {
	ID             string     `json:"id"`
	FileID         string     `json:"fileId"`
	Token          string     `json:"token"`
	HasPassphrase  bool       `json:"hasPassphrase"`
	ExpiresAt      *time.Time `json:"expiresAt,omitempty"`
	MaxDownloads   *int       `json:"maxDownloads,omitempty"`
	DownloadCount  int        `json:"downloadCount"`
	Note           string     `json:"note"`
	Revoked        bool       `json:"revoked"`
	CreatedAt      time.Time  `json:"createdAt"`
	FileName       string     `json:"fileName,omitempty"`
	FileSize       int64      `json:"fileSize,omitempty"`
}

type CreateShareInput struct {
	FileID       string
	Passphrase   string
	ExpiresAt    *time.Time
	MaxDownloads *int
	Note         string
}

type ShareStore struct {
	db *sql.DB
}

func NewShareStore(db *sql.DB) *ShareStore {
	return &ShareStore{db: db}
}

func generateToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *ShareStore) Create(ctx context.Context, in CreateShareInput) (*ShareRecord, error) {
	token, err := generateToken()
	if err != nil {
		return nil, fmt.Errorf("generate token: %w", err)
	}
	id := uuid.New().String()
	now := time.Now().UTC()

	var passHash *string
	hasPass := in.Passphrase != ""
	if hasPass {
		h, err := bcrypt.GenerateFromPassword([]byte(in.Passphrase), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("hash passphrase: %w", err)
		}
		hs := string(h)
		passHash = &hs
	}

	var expiresStr *string
	if in.ExpiresAt != nil {
		es := in.ExpiresAt.UTC().Format(time.RFC3339)
		expiresStr = &es
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO shares (id, file_id, token, pass_hash, expires_at, max_downloads, download_count, note, revoked, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?)`,
		id, in.FileID, token, passHash, expiresStr, in.MaxDownloads, in.Note, now.Format(time.RFC3339),
	)
	if err != nil {
		return nil, fmt.Errorf("insert share: %w", err)
	}

	rec := &ShareRecord{
		ID:            id,
		FileID:        in.FileID,
		Token:         token,
		HasPassphrase: hasPass,
		ExpiresAt:     in.ExpiresAt,
		MaxDownloads:  in.MaxDownloads,
		DownloadCount: 0,
		Note:          in.Note,
		Revoked:       false,
		CreatedAt:     now,
	}
	return rec, nil
}

func scanShare(row interface {
	Scan(dest ...any) error
}) (*ShareRecord, error) {
	var rec ShareRecord
	var passHash sql.NullString
	var expiresStr sql.NullString
	var maxDownloads sql.NullInt64
	var revoked int
	var created string
	err := row.Scan(
		&rec.ID, &rec.FileID, &rec.Token, &passHash, &expiresStr, &maxDownloads,
		&rec.DownloadCount, &rec.Note, &revoked, &created,
	)
	if err != nil {
		return nil, err
	}
	rec.HasPassphrase = passHash.Valid && passHash.String != ""
	rec.Revoked = revoked != 0
	if expiresStr.Valid {
		t, _ := time.Parse(time.RFC3339, expiresStr.String)
		rec.ExpiresAt = &t
	}
	if maxDownloads.Valid {
		n := int(maxDownloads.Int64)
		rec.MaxDownloads = &n
	}
	rec.CreatedAt, _ = time.Parse(time.RFC3339, created)
	return &rec, nil
}

const shareSelect = `
	SELECT id, file_id, token, pass_hash, expires_at, max_downloads, download_count, note, revoked, created_at
	FROM shares`

func (s *ShareStore) GetByToken(ctx context.Context, token string) (*ShareRecord, error) {
	row := s.db.QueryRowContext(ctx, shareSelect+` WHERE token = ?`, token)
	rec, err := scanShare(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return rec, err
}

func (s *ShareStore) GetByID(ctx context.Context, id string) (*ShareRecord, error) {
	row := s.db.QueryRowContext(ctx, shareSelect+` WHERE id = ?`, id)
	rec, err := scanShare(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return rec, err
}

func (s *ShareStore) List(ctx context.Context) ([]ShareRecord, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT s.id, s.file_id, s.token, s.pass_hash, s.expires_at, s.max_downloads,
		       s.download_count, s.note, s.revoked, s.created_at, f.original_name, f.size
		FROM shares s
		JOIN files f ON f.id = s.file_id
		ORDER BY s.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ShareRecord
	for rows.Next() {
		var rec ShareRecord
		var passHash sql.NullString
		var expiresStr sql.NullString
		var maxDownloads sql.NullInt64
		var revoked int
		var created string
		if err := rows.Scan(
			&rec.ID, &rec.FileID, &rec.Token, &passHash, &expiresStr, &maxDownloads,
			&rec.DownloadCount, &rec.Note, &revoked, &created, &rec.FileName, &rec.FileSize,
		); err != nil {
			return nil, err
		}
		rec.HasPassphrase = passHash.Valid && passHash.String != ""
		rec.Revoked = revoked != 0
		if expiresStr.Valid {
			t, _ := time.Parse(time.RFC3339, expiresStr.String)
			rec.ExpiresAt = &t
		}
		if maxDownloads.Valid {
			n := int(maxDownloads.Int64)
			rec.MaxDownloads = &n
		}
		rec.CreatedAt, _ = time.Parse(time.RFC3339, created)
		out = append(out, rec)
	}
	return out, rows.Err()
}

func (s *ShareStore) Revoke(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `UPDATE shares SET revoked = 1 WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *ShareStore) VerifyPassphrase(ctx context.Context, token, passphrase string) error {
	var passHash sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT pass_hash FROM shares WHERE token = ?`, token).Scan(&passHash)
	if err != nil {
		return err
	}
	if !passHash.Valid || passHash.String == "" {
		return nil
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passHash.String), []byte(passphrase)); err != nil {
		return err
	}
	return nil
}

func (s *ShareStore) IncrementDownload(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE shares SET download_count = download_count + 1 WHERE id = ?`, id)
	return err
}

type ShareStatus string

const (
	ShareOK       ShareStatus = "ok"
	ShareRevoked  ShareStatus = "revoked"
	ShareExpired  ShareStatus = "expired"
	ShareExceeded ShareStatus = "exceeded"
	ShareNotFound ShareStatus = "not_found"
)

func (s *ShareStore) CheckAccess(rec *ShareRecord) ShareStatus {
	if rec == nil {
		return ShareNotFound
	}
	if rec.Revoked {
		return ShareRevoked
	}
	if rec.ExpiresAt != nil && time.Now().After(*rec.ExpiresAt) {
		return ShareExpired
	}
	if rec.MaxDownloads != nil && rec.DownloadCount >= *rec.MaxDownloads {
		return ShareExceeded
	}
	return ShareOK
}
