import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  formatSize,
  getPublicShare,
  verifyPassphrase,
  PublicShareInfo,
} from '../api/client'

export default function DownloadPage() {
  const { token = '' } = useParams()
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
        setInfo({ fileName: '', size: 0, needsPassphrase: false, status: 'not_found', message: '分享不存在或已失效，请联系分享者重新发送' })
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
    // 大文件 + iOS Safari 不支持 XHR blob 触发下载，改直链让浏览器原生处理
    let url = `/api/public/shares/${encodeURIComponent(token)}/download`
    if (ticket) {
      url += `?ticket=${encodeURIComponent(ticket)}`
    }
    window.location.href = url
    setTimeout(() => setDownloading(false), 1500)
  }

  if (loading) {
    return (
      <div className="app-shell">
        <div className="card">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </div>
    )
  }

  if (!info || info.status !== 'ok') {
    return (
      <div className="app-shell">
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h1 style={{ marginTop: 0 }}>无法下载</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '1.05rem' }}>
            {info?.message || '分享不存在或已失效，请联系分享者重新发送'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="card">
        <h1 style={{ marginTop: 0 }}>{info.fileName}</h1>
        <p style={{ color: 'var(--color-muted)' }}>文件大小：{formatSize(info.size)}</p>

        {info.needsPassphrase && !verified ? (
          <form onSubmit={handleVerify}>
            <div className="form-group">
              <label>请输入提取码</label>
              <input
                className="input"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="向分享者获取提取码"
              />
              {passError && <div className="field-error">{passError}</div>}
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>
              验证并继续
            </button>
          </form>
        ) : (
          <>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 16 }}
              disabled={downloading}
              onClick={handleDownload}
            >
              {downloading ? '正在打开下载…' : '下载文件'}
            </button>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: 12 }}>
              大文件将交由浏览器下载；若未自动开始，请稍候或刷新后重试。
            </p>
          </>
        )}
      </div>
    </div>
  )
}
