export interface ApiError {
  error: string
  code: string
}

export interface FileRecord {
  id: string
  name: string
  size: number
  createdAt: string
}

export interface ShareRecord {
  id: string
  fileId: string
  token: string
  hasPassphrase: boolean
  expiresAt?: string
  maxDownloads?: number
  downloadCount: number
  note: string
  revoked: boolean
  createdAt: string
  fileName?: string
  fileSize?: number
  shareUrl: string
  status: string
}

export interface PublicShareInfo {
  fileName: string
  size: number
  needsPassphrase: boolean
  status: string
  message?: string
  shareMessage?: string
}

function getToken(): string | null {
  return localStorage.getItem('sharehub_token')
}

export function setToken(token: string) {
  localStorage.setItem('sharehub_token', token)
}

export function clearToken() {
  localStorage.removeItem('sharehub_token')
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const data = await res.json()
    return { error: data.error || '操作失败，请稍后重试', code: data.code || 'UNKNOWN' }
  } catch {
    return { error: '操作失败，请稍后重试', code: 'UNKNOWN' }
  }
}

export async function login(user: string, pass: string): Promise<{ token: string; user: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pass }),
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export async function fetchMe(): Promise<{ user: string }> {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export async function listFiles(): Promise<FileRecord[]> {
  const res = await fetch('/api/files', {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export function uploadFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<FileRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/files/upload')
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        try {
          reject(JSON.parse(xhr.responseText))
        } catch {
          reject({ error: '上传失败，请稍后重试', code: 'UPLOAD_FAILED' })
        }
      }
    }
    xhr.onerror = () => reject({ error: '网络异常，请检查连接', code: 'NETWORK' })
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

export async function listShares(): Promise<ShareRecord[]> {
  const res = await fetch('/api/shares', {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export async function createShare(body: {
  fileId: string
  passphrase?: string
  expiresAt?: string
  maxDownloads?: number
  note?: string
}): Promise<ShareRecord & { shareUrl: string }> {
  const res = await fetch('/api/shares', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export async function revokeShare(id: string): Promise<void> {
  const res = await fetch(`/api/shares/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw await parseError(res)
}

export interface StorageInfo {
  dataDir: string
  blobDir: string
  databasePath: string
  usedBytes: number
  fileCount: number
  diskFreeBytes?: number
  maxUploadMB: number
  configurable: boolean
  configHint: string
}

export async function fetchStorageInfo(): Promise<StorageInfo> {
  const res = await fetch('/api/storage', {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export async function getPublicShare(token: string): Promise<PublicShareInfo> {
  if (!token) {
    return {
      fileName: '',
      size: 0,
      needsPassphrase: false,
      status: 'not_found',
      message: '分享链接无效',
    }
  }
  const res = await fetch(`/api/public/shares/${encodeURIComponent(token)}`)
  let data: PublicShareInfo
  try {
    data = await res.json()
  } catch {
    throw { error: '无法加载分享信息，请刷新重试', code: 'BAD_RESPONSE' }
  }
  if (!res.ok && res.status !== 410) throw data
  return data
}

export async function verifyPassphrase(token: string, passphrase: string): Promise<string> {
  const res = await fetch(`/api/public/shares/${token}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  })
  if (!res.ok) throw await parseError(res)
  const data = await res.json()
  return data.downloadTicket
}

export function downloadFile(
  token: string,
  ticket: string | null,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = `/api/public/shares/${token}/download`
    xhr.open('GET', url)
    xhr.responseType = 'blob'
    if (ticket) {
      xhr.setRequestHeader('X-Download-Ticket', ticket)
    }
    xhr.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response)
      } else {
        const reader = new FileReader()
        reader.onload = () => {
          try {
            reject(JSON.parse(reader.result as string))
          } catch {
            reject({ error: '下载失败，请稍后重试', code: 'DOWNLOAD_FAILED' })
          }
        }
        reader.readAsText(xhr.response)
      }
    }
    xhr.onerror = () => reject({ error: '网络异常，请检查连接', code: 'NETWORK' })
    xhr.send()
  })
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
