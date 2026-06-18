package store

import (
	"bytes"
	"context"
	"testing"

	"github.com/local/sharehub/internal/db"
)

func TestShareStoreCreateReturnsToken(t *testing.T) {
	dir := t.TempDir()
	conn, err := db.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	fs, err := NewFileStore(conn, dir, "")
	if err != nil {
		t.Fatal(err)
	}
	content := []byte("hello world")
	rec, err := fs.Save(context.Background(), "test.txt", int64(len(content)), bytes.NewReader(content))
	if err != nil {
		t.Fatal(err)
	}

	ss := NewShareStore(conn)
	share, err := ss.Create(context.Background(), CreateShareInput{
		FileID:     rec.ID,
		Passphrase: "blue7",
		Note:       "test",
	})
	if err != nil {
		t.Fatal(err)
	}
	if share.Token == "" {
		t.Fatal("expected non-empty token")
	}
	if !share.HasPassphrase {
		t.Fatal("expected hasPassphrase true")
	}
}
