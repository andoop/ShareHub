package db

import (
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaFS embed.FS

func Open(dataDir string) (*sql.DB, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	dbPath := filepath.Join(dataDir, "sharehub.db")
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)", dbPath)
	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	conn.SetMaxOpenConns(1)
	// 外接盘/网络盘瞬断会让 SQLite 连接进入不可恢复的损坏状态
	// （报 "database disk image is malformed"），而磁盘上的文件其实完好。
	// Go 的 database/sql 只在驱动返回 ErrBadConn 时丢弃连接，SQLite 的
	// corrupt/IO 错误不属于此类，于是这条坏连接会被永久复用，必须重启进程才恢复。
	// 设定有限的连接寿命，让坏连接在盘恢复后自动被新连接替换，无需人工重启。
	conn.SetConnMaxLifetime(30 * time.Second)
	schema, err := schemaFS.ReadFile("schema.sql")
	if err != nil {
		return nil, fmt.Errorf("read schema: %w", err)
	}
	if _, err := conn.Exec(string(schema)); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return conn, nil
}
