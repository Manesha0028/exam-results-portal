import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

function normalizeExamName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function getSubjectGrade(subject) {
  return (subject?.grade || '').trim() || '-'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function toDataUrlFromPublicAsset(path) {
  try {
    const response = await fetch(path)
    if (!response.ok) {
      return ''
    }

    const blob = await response.blob()
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    return dataUrl
  } catch (_error) {
    return ''
  }
}

function islandPlaceLabel(place) {
  if (place === 1) return 'First place'
  if (place === 2) return 'Second place'
  if (place === 3) return 'Third place'
  return `${place}th place`
}

function finalGradeRankWeight(finalGradeValue) {
  const grade = String(finalGradeValue || '').trim().toUpperCase()
  if (grade === 'D') return 4
  if (grade === 'C') return 3
  if (grade === 'S') return 2
  if (grade === 'F') return 1
  return 0
}

function isEligibleForIslandRank(candidate) {
  const finalGrade = String(candidate.finalGrade || '').trim().toUpperCase()
  const hasRepeat = String(candidate.repeatSubjectCode || '').trim() !== ''
  const hasNotCompleted =
    finalGrade.includes('NOT') ||
    finalGrade.includes('COMPLETE') ||
    finalGrade.includes('INCOMPLETE') ||
    finalGrade.includes('NC')

  if (!Number.isFinite(Number(candidate.total))) return false
  if (!finalGrade) return false
  if (finalGrade === 'AB' || finalGrade === 'F' || finalGrade.includes('FAIL')) return false
  if (hasNotCompleted) return false
  if (hasRepeat) return false

  const subjectGrades = (candidate.subjects || [])
    .map((subject) => String(subject.grade || '').trim().toUpperCase())
    .filter(Boolean)

  return !subjectGrades.some((grade) => {
    if (grade === 'S' || grade === 'AB' || grade === 'F') return true
    if (grade.includes('FAIL') || grade.includes('NOT') || grade.includes('COMPLETE') || grade.includes('INCOMPLETE')) return true
    return false
  })
}

function getCandidateIslandRankLabel(allResults, targetCandidate) {
  const sortedEligibleCandidates = allResults
    .filter((candidate) => isEligibleForIslandRank(candidate))
    .sort((a, b) => {
      const totalDifference = Number(b.total) - Number(a.total)
      if (totalDifference !== 0) return totalDifference
      const finalGradeDifference =
        finalGradeRankWeight(b.finalGrade) - finalGradeRankWeight(a.finalGrade)
      if (finalGradeDifference !== 0) return finalGradeDifference
      return (a.candidateName || '').localeCompare(b.candidateName || '')
    })

  const candidateIdentifier = normalizeExamName(targetCandidate.indexNo || targetCandidate.nicNumber || targetCandidate.candidateName || '')
  let currentPlace = 0
  let previousRankKey = ''

  for (const candidate of sortedEligibleCandidates) {
    const rankKey = `${Number(candidate.total)}|${finalGradeRankWeight(candidate.finalGrade)}`

    if (rankKey !== previousRankKey) {
      currentPlace += 1
      previousRankKey = rankKey
    }

    if (currentPlace > 3) {
      break
    }

    const currentIdentifier = normalizeExamName(candidate.indexNo || candidate.nicNumber || candidate.candidateName || '')
    if (currentIdentifier === candidateIdentifier) {
      return islandPlaceLabel(currentPlace)
    }
  }

  return ''
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

  function handleResetForm() {
    setSelectedExamName('')
    setSelectedExamYear('')
    setIndexNumber('')
    resetResultState()
  }

  async function handleDownloadPdf() {
    if (!studentResult?.candidate) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const logoDataUrl = await toDataUrlFromPublicAsset('/company-logo.png')
    const logoSrc = logoDataUrl || `${window.location.origin}/company-logo.png`
    const subjectRows = (studentResult.candidate.subjects || [])
      .map((subject) => `
        <tr>
          <td>${escapeHtml(subject?.name || subject?.code || '-')}</td>
          <td>${escapeHtml(getSubjectGrade(subject))}</td>
        </tr>
      `)
      .join('')

    const islandRankLine = studentResult.islandRankLabel
      ? `<p><strong>Island Rank:</strong> ${escapeHtml(studentResult.islandRankLabel)}</p>`
      : ''

    const html = `
      <html>
        <head>
          <title>Student Result</title>
          <style>
            body { font-family: "Trebuchet MS", "Segoe UI", sans-serif; margin: 20px; color: #1d2a28; }
            .report { max-width: 900px; margin: 0 auto; border: 1px solid #d4dbda; border-radius: 14px; padding: 16px; }
            .report-topline { margin: 0 0 10px; font-size: 13px; text-align: center; }
            .report-logo { display: block; margin: 8px auto; width: 120px; height: auto; }
            .report-org { text-align: center; margin-bottom: 10px; }
            .report-org p { margin: 2px 0; }
            .report-title { margin: 8px 0 12px; text-align: center; }
            .report-meta p { margin: 4px 0; }
            .report table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            .report th, .report td { border: 1px solid #d4dbda; padding: 8px 10px; text-align: left; }
            .report th { background: #e8f4f2; }
          </style>
        </head>
        <body>
          <div class="report">
            <p class="report-topline">Exam Results - Department of Examinations- National Cooperative Council of Sri Lanka</p>
            <img class="report-logo" id="print-logo" src="${escapeHtml(logoSrc)}" alt="National Co-Operative Council of Sri Lanka logo" />
            <div class="report-org">
              <p>National Co-Operative Council of Sri Lanka</p>
              <p>ශ්‍රී ලංකා ජාතික සමුපකාර මණ්ඩලය</p>
              <p>இலங்கை தேசிய கூட்டுறவு சபை</p>
            </div>
            <h2 class="report-title">${escapeHtml(studentResult.examName || '-')}</h2>
            <div class="report-meta">
              ${islandRankLine}
              <p><strong>Examination:</strong> ${escapeHtml(studentResult.examName || '-')}</p>
              <p><strong>Year:</strong> ${escapeHtml(studentResult.academicYear || '-')}</p>
              <p><strong>Name:</strong> ${escapeHtml(studentResult.candidate.candidateName || '-')}</p>
              <p><strong>Index number:</strong> ${escapeHtml(studentResult.candidate.indexNo || '-')}</p>
              <p><strong>NIC Number:</strong> ${escapeHtml(studentResult.candidate.nicNumber || '-')}</p>
              <p><strong>Final Grade:</strong> ${escapeHtml(studentResult.candidate.finalGrade || '-')}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Results</th>
                </tr>
              </thead>
              <tbody>
                ${subjectRows}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()

    const triggerPrint = () => {
      printWindow.focus()
      printWindow.print()
    }

    const logo = printWindow.document.getElementById('print-logo')
    if (!logo) {
      triggerPrint()
      return
    }

    if (logo.complete) {
      triggerPrint()
      return
    }

    logo.addEventListener('load', triggerPrint, { once: true })
    logo.addEventListener('error', triggerPrint, { once: true })
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

      const allResults = Array.isArray(payload.results) ? payload.results : []
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
        islandRankLabel: getCandidateIslandRankLabel(allResults, candidate),
      })
      setMessage('Check below')
    } catch (submissionError) {
      setError(submissionError.message || 'Failed to load results.')
    } finally {
      setLoadingResult(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="student-result-heading-wrap">
        <h1 className="student-result-heading">FIND YOUR EXAM RESULTS HERE</h1>
      </header>

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

          <div className="student-result-actions">
            <button className="submit-button student-result-submit" type="submit" disabled={loadingResult || loadingExams}>
              {loadingResult ? 'Searching...' : 'Submit'}
            </button>
            <button className="submit-button student-result-reset" type="button" onClick={handleResetForm} disabled={loadingResult}>
              Reset
            </button>
          </div>
        </form>

        {error ? <p className="feedback error">{error}</p> : null}
        {message ? <p className="feedback success">{message}</p> : null}
      </section>

      {studentResult && (
        <section className="panel-card student-result-card" id="student-result-card">
          <p className="student-report-topline">Exam Results - Department of Examinations- National Cooperative Council of Sri Lanka</p>

          <img className="student-report-logo" src="/company-logo.png" alt="National Co-Operative Council of Sri Lanka logo" />

          <div className="student-report-org-copy">
            <p>National Co-Operative Council of Sri Lanka</p>
            <p>ශ්‍රී ලංකා ජාතික සමුපකාර මණ්ඩලය</p>
            <p>இலங்கை தேசிய கூட்டுறவு சபை</p>
          </div>

          <h2 className="student-report-exam-title">{studentResult.examName || '-'}</h2>

          <div className="student-report-meta">
            {studentResult.islandRankLabel ? <p className="student-island-rank">Island Rank: {studentResult.islandRankLabel}</p> : null}
            <p>Examination : {studentResult.examName || '-'}</p>
            <p>Year: {studentResult.academicYear || '-'}</p>
            <p>Name: {studentResult.candidate.candidateName || '-'}</p>
            <p>Index number: {studentResult.candidate.indexNo || '-'}</p>
            <p>NIC Number: {studentResult.candidate.nicNumber || '-'}</p>
            <p>Final Grade: {studentResult.candidate.finalGrade || '-'}</p>
          </div>

          <div className="student-result-table-wrap">
            <table className="student-result-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Results</th>
                </tr>
              </thead>
              <tbody>
                {(studentResult.candidate.subjects || []).map((subject, index) => (
                  <tr key={`${subject.code || subject.name || 'subject'}-${index}`}>
                    <td>{subject.name || subject.code || '-'}</td>
                    <td>{getSubjectGrade(subject)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="submit-button student-result-download" type="button" onClick={handleDownloadPdf}>
            Download Result Sheet
          </button>
        </section>
      )}
    </main>
  )
}