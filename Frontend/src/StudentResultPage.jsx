import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')
const QUARTERLY_ACCOUNTING_EXAM_NAME = 'Certificate Course of the Quarterly Accounting principals'

function normalizeExamName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function getSubjectGrade(subject) {
  return (subject?.grade || '').trim() || '-'
}

function getQuarterlySubjectMark(subject) {
  return (subject?.mark || '').trim() || '-'
}

function isQuarterlyAccountingExam(examName) {
  return normalizeExamName(examName) === normalizeExamName(QUARTERLY_ACCOUNTING_EXAM_NAME)
}

export default function StudentResultPage() {
  const [exams, setExams] = useState([])
  const [selectedExamName, setSelectedExamName] = useState('')
  const [selectedExamYear, setSelectedExamYear] = useState('')
  const [indexNumber, setIndexNumber] = useState('')
  const [loadingExams, setLoadingExams] = useState(true)
  const [loadingResult, setLoadingResult] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [studentResult, setStudentResult] = useState(null)
  const showMarksInsteadOfGrades = studentResult
    ? isQuarterlyAccountingExam(studentResult.examName)
    : false

  useEffect(() => {
    setLoadingExams(true)
    fetch(`${API_BASE_URL}/api/exams`)
      .then((res) => res.json())
      .then((payload) => {
        if (Array.isArray(payload.exams)) {
          setExams(payload.exams)
        } else {
          setError(payload.message || 'Failed to load exam list.')
        }
      })
      .catch(() => setError('Could not reach the server.'))
      .finally(() => setLoadingExams(false))
  }, [])

  const examNameOptions = useMemo(
    () => [...new Set(exams.map((exam) => (exam.name || '').trim()).filter(Boolean))].sort(),
    [exams],
  )

  const examYearOptions = useMemo(() => {
    const scoped = selectedExamName
      ? exams.filter((exam) => (exam.name || '').trim() === selectedExamName)
      : exams

    return [...new Set(scoped.map((exam) => (exam.academicYear || '').trim()).filter(Boolean))].sort()
  }, [exams, selectedExamName])

  function resetResultState() {
    setError('')
    setMessage('')
    setStudentResult(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const trimmedIndexNumber = indexNumber.trim()
    if (!selectedExamName || !selectedExamYear || !trimmedIndexNumber) {
      setError('Select exam, year, and enter the index number before submitting.')
      setMessage('')
      setStudentResult(null)
      return
    }

    const selectedExam = exams.find(
      (exam) => (exam.name || '').trim() === selectedExamName && (exam.academicYear || '').trim() === selectedExamYear,
    )

    if (!selectedExam?.id) {
      setError('Selected exam could not be found. Please choose again.')
      setMessage('')
      setStudentResult(null)
      return
    }

    setLoadingResult(true)
    setError('')
    setMessage('')
    setStudentResult(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/exam-results?examId=${encodeURIComponent(selectedExam.id)}`)
      const payload = await response.json().catch(() => ({ results: [] }))

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load results.')
      }

      const candidate = Array.isArray(payload.results)
        ? payload.results.find((result) => normalizeExamName(result.indexNo) === normalizeExamName(trimmedIndexNumber))
        : null

      if (!candidate) {
        setMessage('No result found for the entered index number.')
        return
      }

      setStudentResult({
        examName: selectedExam.name,
        academicYear: selectedExam.academicYear,
        candidate,
      })
      setMessage('Result found successfully.')
    } catch (submissionError) {
      setError(submissionError.message || 'Failed to load results.')
    } finally {
      setLoadingResult(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel student-result-hero">
        <p className="eyebrow">Student Result View</p>
        <h1>Check Your Result</h1>
        <p className="hero-copy">
          Select the exam, select the year, enter your index number, and submit to view only your matched result.
        </p>
      </section>

      <section className="panel-card student-result-form-card">
        <form className="student-result-form" onSubmit={handleSubmit}>
          <label className="filter-label">
            Select the exam
            <select
              className="filter-select"
              value={selectedExamName}
              onChange={(event) => {
                setSelectedExamName(event.target.value)
                setSelectedExamYear('')
                resetResultState()
              }}
              disabled={loadingExams}
            >
              <option value="">Select the exam</option>
              {examNameOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="filter-label">
            Select the year
            <select
              className="filter-select"
              value={selectedExamYear}
              onChange={(event) => {
                setSelectedExamYear(event.target.value)
                resetResultState()
              }}
              disabled={loadingExams || !selectedExamName}
            >
              <option value="">Select the year</option>
              {examYearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <label className="filter-label">
            Index number
            <input
              className="filter-input-text"
              type="text"
              value={indexNumber}
              onChange={(event) => {
                setIndexNumber(event.target.value)
                resetResultState()
              }}
              placeholder="Enter index number"
            />
          </label>

          <button className="submit-button student-result-submit" type="submit" disabled={loadingResult || loadingExams}>
            {loadingResult ? 'Searching...' : 'Submit'}
          </button>
        </form>

        {error ? <p className="feedback error">{error}</p> : null}
        {message ? <p className="feedback success">{message}</p> : null}
      </section>

      {studentResult && (
        <section className="panel-card student-result-card">
          <div className="student-result-header">
            <p className="eyebrow">Result</p>
            <h2>{studentResult.examName}</h2>
            <p className="student-result-meta">Academic Year: {studentResult.academicYear}</p>
          </div>

          <div className="student-info-grid">
            <div>
              <span>Student Name</span>
              <strong>{studentResult.candidate.candidateName || '-'}</strong>
            </div>
            <div>
              <span>NIC Number</span>
              <strong>{studentResult.candidate.nicNumber || '-'}</strong>
            </div>
            <div>
              <span>Index Number</span>
              <strong>{studentResult.candidate.indexNo || '-'}</strong>
            </div>
            <div>
              <span>Final Grade</span>
              <strong>{studentResult.candidate.finalGrade || '-'}</strong>
            </div>
          </div>

          <div className="student-subject-list">
            <div className="student-subject-list-head">
              <span>{showMarksInsteadOfGrades ? 'Mark' : 'Grade'}</span>
              <span>Subject</span>
            </div>
            {(studentResult.candidate.subjects || []).map((subject) => (
              <div key={subject.code} className="student-subject-row">
                <strong className={`student-grade-chip ${(showMarksInsteadOfGrades ? getQuarterlySubjectMark(subject) : getSubjectGrade(subject)) === '-' ? 'student-grade-empty' : ''}`}>
                  {showMarksInsteadOfGrades ? getQuarterlySubjectMark(subject) : getSubjectGrade(subject)}
                </strong>
                <span>{subject.name || subject.code}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}