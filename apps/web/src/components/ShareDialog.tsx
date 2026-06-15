import { useState } from 'react'
import { createShare, qrcodeUrl, FileRecord } from '../api/client'
import { useToast } from './Toast'

interface Props {
  file: FileRecord
  onClose: () => void
  onCreated: () => void
}

export default function ShareDialog({ file, onClose, onCreated }: Props) {
  const { showToast } = useToast()
  const [usePass, setUsePass] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [note, setNote] = useState('')
  const [expiresHours, setExpiresHours] = useState('')
  const [maxDownloads, setMaxDownloads] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ shareUrl: string; id: string } | null>(null)
  const [passError, setPassError] = useState('')

  const handleCreate = async () => {
    if (usePass && passphrase.length < 4) {
      setPassError('提取码至少 4 个字符')
      return
    }
    setPassError('')
    setLoading(true)
    try {
      let expiresAt: string | undefined
      if (expiresHours) {
        const h = parseInt(expiresHours, 10)
        if (h > 0) {
          expiresAt = new Date(Date.now() + h * 3600000).toISOString()
        }
      }
      const body: Parameters<typeof createShare>[0] = {
        fileId: file.id,
        note,
      }
      if (usePass) body.passphrase = passphrase
      if (expiresAt) body.expiresAt = expiresAt
      if (maxDownloads) {
        const n = parseInt(maxDownloads, 10)
        if (n > 0) body.maxDownloads = n
      }
      const share = await createShare(body)
      setResult({ shareUrl: share.shareUrl, id: share.id })
      showToast('分享创建成功')
      onCreated()
    } catch (e: unknown) {
      const err = e as { error?: string }
      showToast(err.error || '创建分享失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.shareUrl)
      showToast('链接已复制')
    } catch {
      showToast('复制失败，请手动选择链接', 'error')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!result ? (
          <>
            <h2>创建分享 · {file.name}</h2>
            <div className="form-group">
              <label>备注（可选）</label>
              <input
                className="input"
                placeholder="例如：发给小李"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="checkbox-row">
              <input
                id="usePass"
                type="checkbox"
                checked={usePass}
                onChange={(e) => setUsePass(e.target.checked)}
              />
              <label htmlFor="usePass">启用提取码</label>
            </div>
            {usePass && (
              <div className="form-group">
                <input
                  className="input"
                  placeholder="设置提取码"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
                {passError && <div className="field-error">{passError}</div>}
              </div>
            )}
            <div className="form-group">
              <label>有效期（小时，可选）</label>
              <input
                className="input"
                type="number"
                min="1"
                placeholder="留空表示永不过期"
                value={expiresHours}
                onChange={(e) => setExpiresHours(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>最大下载次数（可选）</label>
              <input
                className="input"
                type="number"
                min="1"
                placeholder="留空表示不限"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>
                取消
              </button>
              <button className="btn btn-primary" disabled={loading} onClick={handleCreate}>
                {loading ? '创建中…' : '创建分享'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>分享已就绪</h2>
            <div className="share-url">
              <input className="input" readOnly value={result.shareUrl} />
              <button className="btn btn-primary" onClick={copyLink}>
                复制链接
              </button>
            </div>
            <div className="qrcode-box">
              <p>扫码下载</p>
              <img src={qrcodeUrl(result.id)} alt="分享二维码" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onClose}>
                完成
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
