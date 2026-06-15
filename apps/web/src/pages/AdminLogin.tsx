import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, setToken } from '../api/client'
import { useToast } from '../components/Toast'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [user, setUser] = useState('admin')
  const [pass, setPass] = useState('')
  const [userError, setUserError] = useState('')
  const [passError, setPassError] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = () => {
    let ok = true
    if (!user.trim()) {
      setUserError('请输入用户名')
      ok = false
    } else {
      setUserError('')
    }
    if (!pass) {
      setPassError('请输入密码')
      ok = false
    } else {
      setPassError('')
    }
    return ok
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await login(user.trim(), pass)
      setToken(res.token)
      showToast('登录成功')
      navigate('/admin', { replace: true })
    } catch (err: unknown) {
      const apiErr = err as { error?: string }
      showToast(apiErr.error || '用户名或密码错误', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="card" style={{ maxWidth: 420, margin: '48px auto' }}>
        <h1 style={{ marginTop: 0 }}>ShareHub 控制台</h1>
        <p style={{ color: 'var(--color-muted)' }}>登录后上传文件并创建分享链接</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              className="input"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
            />
            {userError && <div className="field-error">{userError}</div>}
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              className="input"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
            {passError && <div className="field-error">{passError}</div>}
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
