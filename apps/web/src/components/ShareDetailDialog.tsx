import { useEffect, useState } from 'react'
import { ShareRecord, formatDateTime } from '../api/client'
import { useToast } from './Toast'

function getToken(): string | null {
  return localStorage.getItem('sharehub_token')
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

interface Props {
  share: ShareRecord
  onClose: () => void
}

export default function ShareDetailDialog({ share, onClose }: Props) {
  const { showToast } = useToast()
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    fetch(`/api/shares/${share.id}/qrcode`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('qrcode failed')
        return res.blob()
      })
      .then((blob) => {
        if (!revoked) setQrBlobUrl(URL.createObjectURL(blob))
      })
      .catch(() => showToast('二维码加载失败', 'error'))
    return () => {
      revoked = true
      if (qrBlobUrl) URL.revokeObjectURL(qrBlobUrl)
    }
  }, [share.id, showToast])

  const handleCopy = async (input: HTMLInputElement | null) => {
    const ok = await copyText(share.shareUrl, input)
    showToast(ok ? '链接已复制' : '请长按链接手动复制', ok ? 'success' : 'error')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>分享详情</h2>
        <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>
          {share.fileName}
        </p>
        {share.note && (
          <p className="share-detail-message">「{share.note}」</p>
        )}
        <p>
          状态：<span className={share.status === '有效' ? 'status-active' : 'status-revoked'}>{share.status}</span>
          {share.hasPassphrase && ' · 已启用提取码'}
        </p>
        <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>
          创建时间：{formatDateTime(share.createdAt)}
          <br />
          有效期：{share.expiresAt ? formatDateTime(share.expiresAt) : '永久'}
        </p>
        <div className="share-url">
          <input
            className="input share-url-input"
            readOnly
            value={share.shareUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            className="btn btn-primary"
            onClick={(e) => handleCopy((e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement) ?? null)}
          >
            复制链接
          </button>
        </div>
        <div className="qrcode-box">
          <p>扫码下载</p>
          {qrBlobUrl ? (
            <img src={qrBlobUrl} alt="分享二维码" />
          ) : (
            <div className="skeleton" style={{ width: 200, height: 200, margin: '0 auto' }} />
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
