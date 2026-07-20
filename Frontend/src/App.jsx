import { useEffect, useState } from 'react'
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
  const [exams, setExams] = useState([])
  const [selectedUploadExamName, setSelectedUploadExamName] = useState('')
  const [selectedUploadExamYear, setSelectedUploadExamYear] = useState('')
  const [isLoadingExams, setIsLoadingExams] = useState(true)

  const [examName, setExamName] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [isCreatingExam, setIsCreatingExam] = useState(false)
  const [createMessage, setCreateMessage] = useState('')

  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [uploadResult, setUploadResult] = useState(null)

  async function loadExams() {
    setIsLoadingExams(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/exams`)
      const payload = await response.json().catch(() => ({ exams: [] }))
      const nextExams = Array.isArray(payload.exams) ? payload.exams : []
      setExams(nextExams)

      const hasCurrentMatch = nextExams.some(
        (exam) => exam.name === selectedUploadExamName && exam.academicYear === selectedUploadExamYear,
      )

      if (!hasCurrentMatch) {
        if (nextExams.length > 0) {
          setSelectedUploadExamName(nextExams[0].name)
          setSelectedUploadExamYear(nextExams[0].academicYear)
        } else {
          setSelectedUploadExamName('')
          setSelectedUploadExamYear('')
        }
      }
    } catch (_error) {
      setExams([])
    } finally {
      setIsLoadingExams(false)
    }
  }

  useEffect(() => {
    loadExams()
  }, [])

  async function handleCreateExam(event) {
    event.preventDefault()

    if (!examName.trim() || !academicYear.trim()) {
      setErrorMessage('Exam name and academic year are required to create an exam.')
      return
    }

    setIsCreatingExam(true)
    setErrorMessage('')
    setCreateMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/exams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: examName.trim(),
          academicYear: academicYear.trim(),
        }),
      })

      const payload = await response.json().catch(() => ({ message: 'Create exam failed.' }))

      if (!response.ok) {
        throw new Error(payload.message || 'Create exam failed.')
      }

      if (payload.exam?.name && payload.exam?.academicYear) {
        setSelectedUploadExamName(payload.exam.name)
        setSelectedUploadExamYear(payload.exam.academicYear)
      }

      setExamName('')
      setAcademicYear('')
      setCreateMessage(payload.message || 'Exam created successfully.')
      await loadExams()
    } catch (error) {
      setErrorMessage(error.message || 'Create exam failed.')
    } finally {
      setIsCreatingExam(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!selectedFile) {
      setErrorMessage('Select an Excel .xls or .xlsx file before uploading.')
      return
    }

    if (!selectedUploadExamName || !selectedUploadExamYear) {
      setErrorMessage('Select exam name and exam year before uploading.')
      return
    }

    const selectedExam = exams.find(
      (exam) => exam.name === selectedUploadExamName && exam.academicYear === selectedUploadExamYear,
    )

    if (!selectedExam?.id) {
      setErrorMessage('Selected exam could not be found. Refresh exam list and try again.')
      return
    }

    setIsUploading(true)
    setErrorMessage('')
    setUploadResult(null)

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('examId', selectedExam.id)

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
        <h1>Import exam results</h1>

        <div className="upload-sections">
          <section className="upload-block">
            <p className="eyebrow">1. Create Exam</p>
            <form className="upload-form upload-form-simple" onSubmit={handleCreateExam}>
              <label className="file-picker" htmlFor="exam-name">
                <span>Exam name</span>
                <input
                  id="exam-name"
                  type="text"
                  value={examName}
                  placeholder="Certificate Course of Co-operative Development"
                  onChange={(event) => {
                    setExamName(event.target.value)
                    setErrorMessage('')
                  }}
                />
              </label>

              <label className="file-picker" htmlFor="academic-year">
                <span>Academic year</span>
                <input
                  id="academic-year"
                  type="text"
                  value={academicYear}
                  placeholder="2023-2024"
                  onChange={(event) => {
                    setAcademicYear(event.target.value)
                    setErrorMessage('')
                  }}
                />
              </label>

              <button className="submit-button" type="submit" disabled={isCreatingExam}>
                {isCreatingExam ? 'Creating...' : 'Create exam'}
              </button>
            </form>
          </section>

          <section className="upload-block">
            <p className="eyebrow">2. Upload Results</p>
            <form className="upload-form upload-form-simple" onSubmit={handleSubmit}>
              <label className="file-picker" htmlFor="exam-name-select">
                <span>Select exam name (required)</span>
                <select
                  id="exam-name-select"
                  value={selectedUploadExamName}
                  onChange={(event) => {
                    setSelectedUploadExamName(event.target.value)
                    setSelectedUploadExamYear('')
                    setErrorMessage('')
                  }}
                  disabled={isLoadingExams}
                >
                  <option value="">Select exam name</option>
                  {[...new Set(exams.map((exam) => exam.name))].map((examNameOption) => (
                    <option key={examNameOption} value={examNameOption}>{examNameOption}</option>
                  ))}
                </select>
              </label>

              <label className="file-picker" htmlFor="exam-year-select">
                <span>Select exam year (required)</span>
                <select
                  id="exam-year-select"
                  value={selectedUploadExamYear}
                  onChange={(event) => {
                    setSelectedUploadExamYear(event.target.value)
                    setErrorMessage('')
                  }}
                  disabled={isLoadingExams || !selectedUploadExamName}
                >
                  <option value="">Select exam year</option>
                  {exams
                    .filter((exam) => exam.name === selectedUploadExamName)
                    .map((exam) => exam.academicYear)
                    .filter((value, index, arr) => arr.indexOf(value) === index)
                    .sort()
                    .map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                </select>
              </label>

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

              <button
                className="submit-button"
                type="submit"
                disabled={
                  isUploading ||
                  exams.length === 0 ||
                  !selectedUploadExamName ||
                  !selectedUploadExamYear
                }
              >
                {isUploading ? 'Uploading...' : 'Upload file'}
              </button>
            </form>
          </section>
        </div>

        {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
        {createMessage ? <p className="feedback success">{createMessage}</p> : null}
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
