import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import './App.css'
import ResultsPage from './ResultsPage.jsx'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

function Nav() {
  return (
    <nav className="site-nav">
      <span className="site-nav-brand">Exam Results Portal</span>
      <div className="site-nav-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Upload</NavLink>
        <NavLink to="/results" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Results</NavLink>
      </div>
    </nav>
  )
}

function UploadPage() {
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
      <section className="panel-card upload-simple">
        <p className="eyebrow">Upload workbook</p>
        <h1>Import exam results</h1>
        <p className="hero-copy upload-help">
          Choose the Excel file and upload it.
        </p>

        <form className="upload-form upload-form-simple" onSubmit={handleSubmit}>
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

          <div className="file-meta file-meta-simple">
            <div>
              <span>Selected file</span>
              <strong>{selectedFile ? selectedFile.name : 'No file selected'}</strong>
            </div>
          </div>

          <button className="submit-button" type="submit" disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Upload file'}
          </button>
        </form>

        {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
        {uploadResult ? <p className="feedback success">{uploadResult.message}</p> : null}
      </section>
    </main>
  )
}

function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </>
  )
}

export default App
