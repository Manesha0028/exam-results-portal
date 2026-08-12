import { useEffect, useState } from 'react'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin)
).replace(/\/$/, '')

function formatDateTime(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString()
}

function formatFileSize(value) {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadsPage({ authToken, getOperationPassword, onOperationAuthFailure }) {
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function loadUploads() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/exam-results/uploads`, {
        headers: authToken
          ? {
              Authorization: `Bearer ${authToken}`,
            }
          : {},
      })
      const payload = await response.json().catch(() => ({ uploads: [] }))

      if (response.status === 401) {
        onAuthFailure()
        throw new Error(payload.message || 'Admin session expired. Please log in again.')
      }

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load uploaded sheets.')
      }

      setUploads(Array.isArray(payload.uploads) ? payload.uploads : [])
    } catch (loadError) {
      setError(loadError.message || 'Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUploads()
  }, [])

  async function handleDelete(upload) {
    const confirmed = window.confirm(
      `Delete the uploaded file for ${upload.exam?.name || 'this exam'} (${upload.exam?.academicYear || 'unknown year'})? This will also remove the parsed table data.`,
    )

    if (!confirmed) {
      return
    }

    setBusyId(upload._id)
    setActionError('')

    const operationPassword = await getOperationPassword()
    if (!operationPassword) {
      setBusyId('')
      setActionError('Operation password is required to delete uploads.')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/exam-results/uploads/${upload._id}`, {
        method: 'DELETE',
        headers: {
          'x-operation-password': operationPassword,
        },
      })
      const payload = await response.json().catch(() => ({ message: 'Delete failed.' }))

      if (response.status === 401) {
        onOperationAuthFailure()
        throw new Error(payload.message || 'Invalid operation password. Please enter it again.')
      }

      if (!response.ok) {
        throw new Error(payload.message || 'Delete failed.')
      }

      await loadUploads()
    } catch (deleteError) {
      setActionError(deleteError.message || 'Delete failed.')
    } finally {
      setBusyId('')
    }
  }

  async function handleDownload(upload) {
    setBusyId(upload._id)
    setActionError('')

    const operationPassword = await getOperationPassword()
    if (!operationPassword) {
      setBusyId('')
      setActionError('Operation password is required to download uploads.')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/exam-results/uploads/${upload._id}/download`, {
        headers: {
          'x-operation-password': operationPassword,
        },
      })

      if (response.status === 401) {
        onOperationAuthFailure()
        const payload = await response.json().catch(() => ({ message: 'Download failed.' }))
        throw new Error(payload.message || 'Invalid operation password. Please enter it again.')
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'Download failed.' }))
        throw new Error(payload.message || 'Download failed.')
      }

      const fileBlob = await response.blob()
      const objectUrl = window.URL.createObjectURL(fileBlob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = upload.originalFileName || upload.storedFileName || 'upload.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch (downloadError) {
      setActionError(downloadError.message || 'Download failed.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel uploads-hero">
        <p className="eyebrow">Exam Results Portal</p>
        <h1>Uploaded Sheets</h1>
        <p className="hero-copy">
          Manage each newly uploaded Excel sheet here. Download a copy or delete the sheet and its parsed rows together.
        </p>
      </section>

      <section className="panel-card uploads-card">
        {loading && <p className="feedback">Loading uploaded sheets...</p>}
        {error ? <p className="feedback error">{error}</p> : null}
        {actionError ? <p className="feedback error">{actionError}</p> : null}

        {!loading && !error && uploads.length === 0 && (
          <div className="empty-state">
            <p>No uploaded sheets yet.</p>
            <span>Upload an Excel workbook from the home page to see it here.</span>
          </div>
        )}

        {!loading && uploads.length > 0 && (
          <div className="results-scroll">
            <table className="results-table uploads-table">
              <thead>
                <tr className="rt-head-top">
                  <th>Exam Name</th>
                  <th>Academic Year</th>
                  <th>File Name</th>
                  <th>Uploaded</th>
                  <th>Records</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload, index) => (
                  <tr key={upload._id} className={index % 2 === 0 ? 'rt-even' : 'rt-odd'}>
                    <td>{upload.exam?.name || 'Unknown exam'}</td>
                    <td>{upload.exam?.academicYear || '—'}</td>
                    <td>
                      <div className="upload-file-cell">
                        <strong>{upload.originalFileName || 'Unnamed workbook'}</strong>
                        <small>{upload.storedFileName || 'Stored file not available'}</small>
                      </div>
                    </td>
                    <td>{formatDateTime(upload.createdAt)}</td>
                    <td>{upload.recordsProcessed ?? 0}</td>
                    <td>{formatFileSize(upload.fileSize)}</td>
                    <td>
                      <div className="upload-actions">
                        <a
                          className="table-action table-action-download"
                          href="#"
                          onClick={(event) => {
                            event.preventDefault()
                            handleDownload(upload)
                          }}
                        >
                          {busyId === upload._id ? 'Working...' : 'Download'}
                        </a>
                        <button
                          className="table-action table-action-delete"
                          type="button"
                          onClick={() => handleDelete(upload)}
                          disabled={busyId === upload._id}
                        >
                          {busyId === upload._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}