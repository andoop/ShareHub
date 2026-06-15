import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  formatSize,
  getPublicShare,
  verifyPassphrase,
  PublicShareInfo,
} from '../api/client'
import { useToast } from '../components/Toast'

function fileExtension(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0 || i === name.length - 1) return 'FILE'
  return name.slice(i + 1).toUpperCase().slice(0, 4)
}

function buildDownloadUrl(token: string, ticket: string | null): string {
  let url = `${window.location.origin}/api/public/shares/${encodeURIComponent(token)}/download`
  if (ticket) {
    url += `?ticket=${encodeURIComponent(ticket)}`
  }
  return url
}

async function copyText(text: string, inputEl?: HTMLInputElement | null): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback */
  }
  if (inputEl) {
    inputEl.focus()
    inputEl.select()
    inputEl.setSelectionRange(0, text.length)
  }
  try {
    return document.execCommand('copy')
  } catch {
    return false
  }
}

export default function DownloadPage() {
  const { token = '' } = useParams()
  const { showToast } = useToast()
  const downloadInputRef = useRef<HTMLInputElement>(null)
  const [info, setInfo] = useState<PublicShareInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [passphrase, setPassphrase] = useState('')
  const [passError, setPassError] = useState('')
  const [verified, setVerified] = useState(false)
  const [ticket, setTicket] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    getPublicShare(token)
      .then((data) => {
        setInfo(data)
        if (data.status !== 'ok') return
        if (!data.needsPassphrase) {
          setVerified(true)
        }
      })
      .catch(() => {
        setInfo({
          fileName: '',
          size: 0,
          needsPassphrase: false,
          status: 'not_found',
          message: '分享不存在或已失效，请联系分享者重新发送',
        })
      })
      .finally(() => setLoading(false))
  }, [token])

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!passphrase.trim()) {
      setPassError('请输入提取码')
      return
    }
    setPassError('')
    try {
      const t = await verifyPassphrase(token, passphrase.trim())
      setTicket(t)
      setVerified(true)
    } catch (err: unknown) {
      const apiErr = err as { error?: string }
      setPassError(apiErr.error || '提取码错误，请向分享者确认')
    }
  }

  const handleDownload = () => {
    if (!info || info.status !== 'ok') return
    setDownloading(true)
    window.location.href = buildDownloadUrl(token, ticket)
    setTimeout(() => setDownloading(false), 1500)
  }

  const handleCopyDownloadLink = async () => {
    const url = buildDownloadUrl(token, ticket)
    const ok = await copyText(url, downloadInputRef.current)
    showToast(ok ? '下载链接已复制' : '请长按上方链接手动复制', ok ? 'success' : 'error')
  }

  const downloadUrl = useMemo(
    () => (verified ? buildDownloadUrl(token, ticket) : ''),
    [verified, token, ticket],
  )

  if (loading) {
    return (
      <div className="download-page">
        <header className="download-header">
          <span className="download-brand">ShareHub</span>
        </header>
        <div className="download-card">
          <div className="skeleton" style={{ height: 48, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 24, width: '60%' }} />
        </div>
      </div>
    )
  }

  if (!info || info.status !== 'ok') {
    return (
      <div className="download-page">
        <header className="download-header">
          <span className="download-brand">ShareHub</span>
        </header>
        <div className="download-card download-card--error">
          <div className="download-error-icon" aria-hidden>!</div>
          <h1>无法下载</h1>
          <p>{info?.message || '分享不存在或已失效，请联系分享者重新发送'}</p>
        </div>
      </div>
    )
  }

  const ext = fileExtension(info.fileName)

  return (
    <div className="download-page">
      <header className="download-header">
        <span className="download-brand">ShareHub</span>
        <span className="download-tagline">安全文件分享</span>
      </header>

      <div className="download-card">
        {info.shareMessage && (
          <blockquote className="download-message">{info.shareMessage}</blockquote>
        )}

        <div className="download-file">
          <div className="download-file-icon" aria-hidden>{ext}</div>
          <div className="download-file-meta">
            <h1>{info.fileName}</h1>
            <div className="download-chips">
              <span className="download-chip">{formatSize(info.size)}</span>
              {info.needsPassphrase && (
                <span className="download-chip download-chip--lock">需要提取码</span>
              )}
            </div>
          </div>
        </div>

        {info.needsPassphrase && !verified ? (
          <form className="download-form" onSubmit={handleVerify}>
            <div className="form-group">
              <label>请输入提取码</label>
              <input
                className="input"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="向分享者获取提取码"
                autoComplete="off"
              />
              {passError && <div className="field-error">{passError}</div>}
            </div>
            <button className="btn btn-primary download-btn" type="submit">
              验证并继续
            </button>
          </form>
        ) : (
          <div className="download-actions">
            <button
              className="btn btn-primary download-btn"
              disabled={downloading}
              onClick={handleDownload}
            >
              {downloading ? '正在打开下载…' : '下载文件'}
            </button>
            <div className="download-link-row">
              <label>下载直链</label>
              <div className="share-url">
                <input
                  ref={downloadInputRef}
                  className="input"
                  readOnly
                  value={downloadUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button className="btn btn-secondary" type="button" onClick={handleCopyDownloadLink}>
                  复制链接
                </button>
              </div>
            </div>
            <p className="download-hint">
              大文件将交由浏览器下载；若未自动开始，可复制直链到其他下载工具。
            </p>
          </div>
        )}
      </div>

      <footer className="download-footer">由 ShareHub 提供文件分享服务</footer>
    </div>
  )
}
