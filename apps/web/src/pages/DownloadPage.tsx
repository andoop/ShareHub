import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  downloadFile,
  formatSize,
  getPublicShare,
  verifyPassphrase,
  PublicShareInfo,
} from '../api/client'
import UploadProgress from '../components/UploadProgress'

export default function DownloadPage() {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<PublicShareInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [passphrase, setPassphrase] = useState('')
  const [passError, setPassError] = useState('')
  const [verified, setVerified] = useState(false)
  const [ticket, setTicket] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
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

  const handleDownload = async () => {
    if (!info || info.status !== 'ok') return
    setDownloading(true)
    setDownloadProgress(0)
    try {
      const blob = await downloadFile(token, ticket, setDownloadProgress)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = info.fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const apiErr = err as { error?: string }
      setInfo({ ...info, status: 'error', message: apiErr.error || '下载失败，请稍后重试' })
    } finally {
      setDownloading(false)
      setDownloadProgress(null)
    }
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
              {downloading ? '下载中…' : '下载文件'}
            </button>
            {downloadProgress !== null && (
              <UploadProgress progress={downloadProgress} label="下载中" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
