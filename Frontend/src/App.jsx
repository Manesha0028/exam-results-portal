import { useState } from 'react'
import './App.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

function formatSubjectSnapshot(subjects) {
  return subjects
    .slice(0, 3)
    .map((subject) => `${subject.code}: ${subject.mark || '-'} ${subject.grade || ''}`.trim())
    .join(' • ')
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [uploadResult, setUploadResult] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()

    if (!selectedFile) {
      setErrorMessage('Select an Excel .xls or .xlsx file before uploading.')
      return
    }

    setIsUploading(true)
    setErrorMessage('')
    setUploadResult(null)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch(`${API_BASE_URL}/api/exam-results/upload`, {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => ({ message: 'Upload failed.' }))

      if (!response.ok) {
        throw new Error(payload.message || 'Upload failed.')
      }

      setUploadResult(payload)
    } catch (error) {
      setErrorMessage(error.message || 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Exam Results Portal</p>
        <h1>Automated Excel ingestion for irregular result sheets.</h1>
        <p className="hero-copy">
          Upload the NCCSL workbook, skip the banner rows, extract dynamic subject pairs,
          and persist candidate results into MongoDB without hardcoding subject columns.
        </p>

        <div className="rule-grid">
          <article>
            <span>Skipped</span>
            <strong>Rows 0-4</strong>
            <p>Title banners, grading legend, and metadata are ignored.</p>
          </article>
          <article>
            <span>Parsed</span>
            <strong>Subject pairs</strong>
            <p>Each subject uses one mark column and the next grade column.</p>
          </article>
          <article>
            <span>Ignored</span>
            <strong>Side tables</strong>
            <p>Columns beyond Repeat Subject Code are excluded from storage.</p>
          </article>
        </div>
      </section>

      <section className="workspace-panel">
        <div className="panel-card upload-card">
          <div>
            <p className="section-kicker">Upload workbook</p>
            <h2>Send the exam sheet to the parser</h2>
            <p className="section-copy">
              The backend expects the first worksheet to match the merged-header structure
              you described and will upsert records by Index No.
            </p>
          </div>

          <form className="upload-form" onSubmit={handleSubmit}>
            <label className="file-picker" htmlFor="exam-file">
              <span>Excel file</span>
              <input
                id="exam-file"
                type="file"
                accept=".xls,.xlsx"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] || null)
                  setErrorMessage('')
                }}
              />
            </label>

            <div className="file-meta">
              <div>
                <span>Selected</span>
                <strong>{selectedFile ? selectedFile.name : 'No file selected'}</strong>
              </div>
              <div>
                <span>Size</span>
                <strong>
                  {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : '--'}
                </strong>
              </div>
            </div>

            <button className="submit-button" type="submit" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload and parse'}
            </button>
          </form>

          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
          {uploadResult ? <p className="feedback success">{uploadResult.message}</p> : null}
        </div>

        <div className="panel-card response-card">
          <p className="section-kicker">Response snapshot</p>
          <h2>What the backend returned</h2>

          <div className="metric-strip">
            <article>
              <span>Processed</span>
              <strong>{uploadResult?.recordsProcessed ?? 0}</strong>
            </article>
            <article>
              <span>Inserted</span>
              <strong>{uploadResult?.insertedCount ?? 0}</strong>
            </article>
            <article>
              <span>Updated</span>
              <strong>{uploadResult?.modifiedCount ?? 0}</strong>
            </article>
          </div>

          <p className="response-note">
            Preview rows come directly from the parsed payload before the extra worksheet side
            calculations are discarded.
          </p>
        </div>
      </section>

      <section className="preview-panel panel-card">
        <div className="preview-header">
          <div>
            <p className="section-kicker">Preview</p>
            <h2>Parsed candidates</h2>
          </div>
          <p className="section-copy">
            The first five candidates returned by the upload endpoint are shown below.
          </p>
        </div>

        {uploadResult?.preview?.length ? (
          <div className="preview-table">
            <div className="preview-row preview-row-head">
              <span>Candidate</span>
              <span>Index No.</span>
              <span>Center</span>
              <span>Subjects</span>
              <span>Final Grade</span>
            </div>

            {uploadResult.preview.map((candidate) => (
              <div className="preview-row" key={candidate.indexNo}>
                <span>
                  <strong>{candidate.candidateName}</strong>
                  <small>{candidate.nicNumber}</small>
                </span>
                <span>{candidate.indexNo}</span>
                <span>{candidate.center}</span>
                <span>{formatSubjectSnapshot(candidate.subjects)}</span>
                <span>
                  <strong>{candidate.finalGrade || '--'}</strong>
                  <small>{candidate.average || '--'}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No upload preview yet.</p>
            <span>Upload a workbook to inspect the parsed candidate records.</span>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
