interface Props {
  progress: number
  label?: string
}

export default function UploadProgress({ progress, label }: Props) {
  return (
    <div className="progress-wrap">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-label">
        {label || '上传中'} · {progress}%
      </div>
    </div>
  )
}
