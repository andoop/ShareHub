import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearToken,
  fetchMe,
  formatSize,
  listFiles,
  listShares,
  revokeShare,
  fetchStorageInfo,
  StorageInfo,
  FileRecord,
  ShareRecord,
  uploadFile,
} from '../api/client'
import ShareDialog from '../components/ShareDialog'
import ShareDetailDialog from '../components/ShareDetailDialog'
import UploadProgress from '../components/UploadProgress'
import { useToast } from '../components/Toast'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState('')
  const [files, setFiles] = useState<FileRecord[]>([])
  const [shares, setShares] = useState<ShareRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [shareFile, setShareFile] = useState<FileRecord | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ShareRecord | null>(null)
  const [detailShare, setDetailShare] = useState<ShareRecord | null>(null)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    try {
      const me = await fetchMe()
      setUser(me.user)
      const [f, s, st] = await Promise.all([listFiles(), listShares(), fetchStorageInfo()])
      setFiles(f)
      setShares(s)
      setStorage(st)
    } catch {
      clearToken()
      navigate('/admin/login', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const file = fileList[0]
    setUploadProgress(0)
    try {
      const rec = await uploadFile(file, setUploadProgress)
      setFiles((prev) => [rec, ...prev])
      showToast(`${file.name} 上传成功`)
    } catch (e: unknown) {
      const err = e as { error?: string }
      showToast(err.error || '上传失败', 'error')
    } finally {
      setUploadProgress(null)
    }
  }

  const confirmRevoke = async () => {
    if (!revokeTarget) return
    try {
      await revokeShare(revokeTarget.id)
      showToast('分享已撤销')
      setRevokeTarget(null)
      load()
    } catch (e: unknown) {
      const err = e as { error?: string }
      showToast(err.error || '撤销失败', 'error')
    }
  }

  const logout = () => {
    clearToken()
    navigate('/admin/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="app-shell">
        <div className="card">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="header-bar">
        <div>
          <h1>ShareHub 控制台</h1>
          <span className="badge">已登录 · {user}</span>
        </div>
        <button className="btn btn-secondary" onClick={logout}>
          退出登录
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div
          className={`dropzone${dragOver ? ' dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleUpload(e.dataTransfer.files)
          }}
        >
          <strong>点击或拖拽文件到此处上传</strong>
          <p>支持大文件，上传后可一键创建分享</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(e) => handleUpload(e.target.files)}
        />
        {uploadProgress !== null && <UploadProgress progress={uploadProgress} />}
      </div>

      {storage && (
        <details className="card storage-details" style={{ marginBottom: 20 }}>
          <summary className="storage-summary">
            <span className="storage-summary-title">存储与空间</span>
            <span className="storage-summary-meta">
              已用 {formatSize(storage.usedBytes)} · {storage.fileCount} 个文件
            </span>
          </summary>
          <p style={{ color: 'var(--color-muted)', marginTop: 12 }}>
            文件保存在服务器本地目录，通过环境变量配置（重启后生效）。
          </p>
          <table className="file-table storage-table">
            <tbody>
              <tr>
                <td data-label="工作目录">工作目录</td>
                <td data-label="路径"><code>{storage.dataDir}</code></td>
              </tr>
              <tr>
                <td data-label="文件目录">文件目录</td>
                <td data-label="路径"><code>{storage.blobDir}</code></td>
              </tr>
              <tr>
                <td data-label="数据库">数据库</td>
                <td data-label="路径"><code>{storage.databasePath}</code></td>
              </tr>
              <tr>
                <td data-label="已用空间">已用空间</td>
                <td data-label="数值">
                  {formatSize(storage.usedBytes)} · {storage.fileCount} 个文件
                </td>
              </tr>
              {storage.diskFreeBytes != null && (
                <tr>
                  <td data-label="磁盘剩余">磁盘剩余</td>
                  <td data-label="数值">{formatSize(storage.diskFreeBytes)}</td>
                </tr>
              )}
              <tr>
                <td data-label="单文件上限">单文件上限</td>
                <td data-label="数值">{storage.maxUploadMB} MB</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>{storage.configHint}</p>
        </details>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>我的文件</h2>
        {files.length === 0 ? (
          <div className="empty-state">
            <h3>还没有文件</h3>
            <p>上传第一个文件，然后创建分享链接</p>
          </div>
        ) : (
          <table className="file-table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>大小</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td data-label="文件名">{f.name}</td>
                  <td data-label="大小">{formatSize(f.size)}</td>
                  <td data-label="状态">已上传</td>
                  <td data-label="操作">
                    <button className="btn btn-primary" onClick={() => setShareFile(f)}>
                      创建分享
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>分享记录</h2>
        {shares.length === 0 ? (
          <div className="empty-state">
            <h3>暂无分享</h3>
            <p>为文件创建分享后，链接与二维码将显示在这里</p>
          </div>
        ) : (
          <table className="file-table">
            <thead>
              <tr>
                <th>文件</th>
                <th>分享文案</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => (
                <tr
                  key={s.id}
                  className="share-row-clickable"
                  onClick={() => setDetailShare(s)}
                >
                  <td data-label="文件">{s.fileName}</td>
                  <td data-label="分享文案">{s.note || '—'}</td>
                  <td data-label="状态" className={s.status === '有效' ? 'status-active' : 'status-revoked'}>
                    {s.status}
                  </td>
                  <td data-label="操作" onClick={(e) => e.stopPropagation()}>
                    {s.status === '有效' && (
                      <button className="btn btn-danger" onClick={() => setRevokeTarget(s)}>
                        撤销
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {shareFile && (
        <ShareDialog
          file={shareFile}
          onClose={() => setShareFile(null)}
          onCreated={load}
        />
      )}

      {detailShare && (
        <ShareDetailDialog share={detailShare} onClose={() => setDetailShare(null)} />
      )}

      {revokeTarget && (
        <div className="modal-backdrop" onClick={() => setRevokeTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>确认撤销分享？</h2>
            <p>撤销后，分享链接将立即失效，接收者无法再下载。</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setRevokeTarget(null)}>
                取消
              </button>
              <button className="btn btn-danger" onClick={confirmRevoke}>
                确认撤销
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
