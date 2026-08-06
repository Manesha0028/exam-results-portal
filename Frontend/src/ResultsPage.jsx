import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')
const COOPERATIVE_DEVELOPMENT_EXAM_NAME = 'Certificate Course in Co-operative Development'
const QUARTERLY_ACCOUNTING_EXAM_NAME = 'Certificate Course of the Quarterly Accounting principals'
const DIPLOMA_HRM_EXAM_NAME = 'Diploma in Human Resource Management'

const SUBJECTS = [
  { name: 'Cooperative',               code: 'CDAL01' },
  { name: 'Marketing Management',      code: 'CDAL02' },
  { name: 'Information Technology',    code: 'CDAL03' },
  { name: 'Secraterial Practices',     code: 'CDAL04' },
  { name: 'Public Relations',          code: 'CDAL05' },
  { name: 'Accountancy',               code: 'CDAL06' },
  { name: 'Financial Management',      code: 'CDAL07' },
  { name: 'Law & Practices',           code: 'CDAL08' },
  { name: 'Human resource Management', code: 'CDAL09' },
  { name: 'Field Assignment',          code: 'CDAL10' },
]

const COOPERATIVE_DEVELOPMENT_SUBJECTS = [
  { name: 'Co-operative & Business Environment CDOL01', code: 'CDOL01' },
  { name: 'Management CDOL02', code: 'CDOL02' },
  { name: 'Accounting & Co-operative Accounting Procedures CDOL03', code: 'CDOL03' },
  { name: 'Legal Environment & Co-operative Law CDOL04', code: 'CDOL04' },
  { name: 'Office Management CDOL05', code: 'CDOL05' },
  { name: 'Marketing & Co-operative Marketing CDOL06', code: 'CDOL06' },
]

const STATUS_CHIPS = [
  { key: 'all',         label: 'All' },
  { key: 'pass',        label: 'Pass' },
  { key: 'repeat',      label: 'Has Repeat' },
  { key: 'failed',      label: 'Has Failure' },
  { key: 'distinction', label: 'Has Distinction' },
  { key: 'absent',      label: 'Fully Absent' },
  { key: 'partial',     label: 'Partial Absent' },
]

function gradeClass(grade) {
  if (!grade) return ''
  const g = grade.trim().toUpperCase()
  if (g === 'D')  return 'grade-d'
  if (g === 'C')  return 'grade-c'
  if (g === 'S')  return 'grade-s'
  if (g === 'F')  return 'grade-f'
  if (g === 'AB') return 'grade-ab'
  return ''
}

function normalizeExamName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function formatAverageValue(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return ''

  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) {
    return normalized
  }

  return String(Math.round(numericValue))
}

function getQuarterlyPaperMarks(candidate) {
  const subjects = candidate.subjects || []
  const firstPaper = subjects.find((subject) => subject.code === 'QAP01')
    || subjects.find((subject) => (subject.name || '').toLowerCase().includes('1st'))
  const secondPaper = subjects.find((subject) => subject.code === 'QAP02')
    || subjects.find((subject) => (subject.name || '').toLowerCase().includes('2nd'))

  return {
    first: firstPaper?.mark || '',
    second: secondPaper?.mark || '',
  }
}

function getCooperativeDevelopmentSubjectCells(candidate) {
  const subjects = candidate.subjects || []
  const subjectMap = {}

  subjects.forEach((subject) => {
    subjectMap[subject.code] = subject
  })

  return COOPERATIVE_DEVELOPMENT_SUBJECTS.map((subject) => {
    const current = subjectMap[subject.code]
    return {
      code: subject.code,
      name: subject.name,
      mark: current?.mark || '',
      grade: current?.grade || '',
    }
  })
}

function classifyCandidate(candidate) {
  const grades = (candidate.subjects || []).map((s) => (s.grade || '').trim().toUpperCase())
  const absentCount   = grades.filter((g) => g === 'AB' || g === '-' || g === '').length
  const totalSubjects = grades.length
  const isFullyAbsent  = totalSubjects > 0 && absentCount === totalSubjects
  const isPartialAbsent = !isFullyAbsent && absentCount > 0
  const hasFailed      = grades.some((g) => g === 'F')
  const hasDistinction = grades.some((g) => g === 'D')
  const hasRepeat      = (candidate.repeatSubjectCode || '').trim() !== ''
  const isPass         = (candidate.finalGrade || '').trim() !== '' && !isFullyAbsent
  return { isFullyAbsent, isPartialAbsent, hasFailed, hasDistinction, hasRepeat, isPass }
}

function applyFilters(results, { search, status, center, finalGrade, minTotal, maxTotal }) {
  const q = search.trim().toLowerCase()

  return results.filter((c) => {
    // search: NIC, Index No., or Name
    if (q) {
      const inNic   = (c.nicNumber   || '').toLowerCase().includes(q)
      const inIndex = (c.indexNo     || '').toLowerCase().includes(q)
      const inName  = (c.candidateName || '').toLowerCase().includes(q)
      if (!inNic && !inIndex && !inName) return false
    }

    // center filter
    if (center && (c.center || '') !== center) return false

    // final grade filter
    if (finalGrade && (c.finalGrade || '').trim() !== finalGrade) return false

    // total range
    if (minTotal !== '' && (c.total === null || c.total < Number(minTotal))) return false
    if (maxTotal !== '' && (c.total === null || c.total > Number(maxTotal))) return false

    // status chip
    if (status !== 'all') {
      const cls = classifyCandidate(c)
      if (status === 'pass'        && !cls.isPass)         return false
      if (status === 'repeat'      && !cls.hasRepeat)      return false
      if (status === 'failed'      && !cls.hasFailed)      return false
      if (status === 'distinction' && !cls.hasDistinction) return false
      if (status === 'absent'      && !cls.isFullyAbsent)  return false
      if (status === 'partial'     && !cls.isPartialAbsent) return false
    }

    return true
  })
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

  // Exclude if any subject contains S, AB, F, or appears incomplete.
  return !subjectGrades.some((grade) => {
    if (grade === 'S' || grade === 'AB' || grade === 'F') return true
    if (grade.includes('FAIL') || grade.includes('NOT') || grade.includes('COMPLETE') || grade.includes('INCOMPLETE')) return true
    return false
  })
}

function finalGradeRankWeight(finalGradeValue) {
  const grade = String(finalGradeValue || '').trim().toUpperCase()
  if (grade === 'D') return 4
  if (grade === 'C') return 3
  if (grade === 'S') return 2
  if (grade === 'F') return 1
  return 0
}

function islandPlaceLabel(place) {
  if (place === 1) return 'First place'
  if (place === 2) return 'Second place'
  if (place === 3) return 'Third place'
  return `${place}th place`
}

export default function ResultsPage() {
  const [exams, setExams] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingExams, setLoadingExams] = useState(true)
  const [error,   setError]   = useState('')
  const [selectionError, setSelectionError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const [selectedExamName, setSelectedExamName] = useState('')
  const [selectedExamYear, setSelectedExamYear] = useState('')
  const [appliedExamName, setAppliedExamName] = useState('')
  const [appliedExamYear, setAppliedExamYear] = useState('')
  const [showIslandRanks, setShowIslandRanks] = useState(false)

  // filter state
  const [search,     setSearch]     = useState('')
  const [status,     setStatus]     = useState('all')
  const [center,     setCenter]     = useState('')
  const [finalGrade, setFinalGrade] = useState('')
  const [minTotal,   setMinTotal]   = useState('')
  const [maxTotal,   setMaxTotal]   = useState('')

  useEffect(() => {
    setLoadingExams(true)
    fetch(`${API_BASE_URL}/api/exams`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload.exams) setExams(payload.exams)
        else setError(payload.message || 'Failed to load exam list.')
      })
      .catch(() => setError('Could not reach the server.'))
      .finally(() => setLoadingExams(false))
  }, [])

  const examNameOptions = useMemo(() => {
    return [...new Set(exams.map((exam) => (exam.name || '').trim()).filter(Boolean))].sort()
  }, [exams])

  const examYearOptions = useMemo(() => {
    const scoped = selectedExamName
      ? exams.filter((exam) => (exam.name || '').trim() === selectedExamName)
      : exams

    return [...new Set(scoped.map((exam) => (exam.academicYear || '').trim()).filter(Boolean))].sort()
  }, [exams, selectedExamName])

  const searchedResults = useMemo(() => {
    if (!appliedExamName || !appliedExamYear) {
      return []
    }

    return results.filter(
      (r) => (r.exam?.name || '').trim() === appliedExamName &&
             (r.exam?.academicYear || '').trim() === appliedExamYear,
    )
  }, [results, appliedExamName, appliedExamYear])

  // derive unique filter options from data
  const centerOptions = useMemo(
    () => [...new Set(searchedResults.map((r) => r.center || '').filter(Boolean))].sort(),
    [searchedResults],
  )
  const finalGradeOptions = useMemo(
    () => [...new Set(searchedResults.map((r) => (r.finalGrade || '').trim()).filter(Boolean))].sort(),
    [searchedResults],
  )

  const filtered = useMemo(
    () => applyFilters(searchedResults, { search, status, center, finalGrade, minTotal, maxTotal }),
    [searchedResults, search, status, center, finalGrade, minTotal, maxTotal],
  )

  const topIslandRanks = useMemo(() => {
    const sortedEligibleCandidates = searchedResults
      .filter((candidate) => isEligibleForIslandRank(candidate))
      .sort((a, b) => {
        const totalDifference = Number(b.total) - Number(a.total)
        if (totalDifference !== 0) return totalDifference
        const finalGradeDifference =
          finalGradeRankWeight(b.finalGrade) - finalGradeRankWeight(a.finalGrade)
        if (finalGradeDifference !== 0) return finalGradeDifference
        return (a.candidateName || '').localeCompare(b.candidateName || '')
      })

    const rankedCandidates = []
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

      rankedCandidates.push({
        candidate,
        place: currentPlace,
      })
    }

    return rankedCandidates
  }, [searchedResults])

  function handleExamSearch() {
    if (!selectedExamName || !selectedExamYear) {
      setSelectionError('Select exam name and exam year, then click Search.')
      return
    }

    const selectedExam = exams.find(
      (exam) => (exam.name || '').trim() === selectedExamName && (exam.academicYear || '').trim() === selectedExamYear,
    )

    if (!selectedExam?.id) {
      setSelectionError('Selected exam could not be found. Please choose again.')
      return
    }

    setSelectionError('')
    setError('')
    setLoading(true)
    setHasSearched(false)
    setAppliedExamName(selectedExamName)
    setAppliedExamYear(selectedExamYear)
    setShowIslandRanks(false)
    resetFilters()

    fetch(`${API_BASE_URL}/api/exam-results?examId=${encodeURIComponent(selectedExam.id)}`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload.results) {
          setResults(payload.results)
          setHasSearched(true)
        } else {
          setError(payload.message || 'Failed to load results for selected exam.')
        }
      })
      .catch(() => setError('Could not reach the server.'))
      .finally(() => setLoading(false))
  }

  function resetFilters() {
    setSearch('')
    setStatus('all')
    setCenter('')
    setFinalGrade('')
    setMinTotal('')
    setMaxTotal('')
  }

  const isDirty = search || status !== 'all' || center || finalGrade || minTotal !== '' || maxTotal !== ''
  const isCooperativeDevelopmentExam =
    normalizeExamName(appliedExamName) === normalizeExamName(COOPERATIVE_DEVELOPMENT_EXAM_NAME)
  const isQuarterlyAccountingExam =
    normalizeExamName(appliedExamName) === normalizeExamName(QUARTERLY_ACCOUNTING_EXAM_NAME)
  const isDhrmExam =
    normalizeExamName(appliedExamName) === normalizeExamName(DIPLOMA_HRM_EXAM_NAME)
  const dynamicSubjectColumns = useMemo(() => {
    const resultWithSubjects = filtered.find((candidate) => Array.isArray(candidate.subjects) && candidate.subjects.length > 0)
      || searchedResults.find((candidate) => Array.isArray(candidate.subjects) && candidate.subjects.length > 0)

    if (!resultWithSubjects) {
      return SUBJECTS
    }

    return resultWithSubjects.subjects.map((subject, index) => {
      const code = (subject.code || '').trim()
      const name = (subject.name || '').trim()
      return {
        code: code || `SUB${String(index + 1).padStart(2, '0')}`,
        name: name || code || `Subject ${index + 1}`,
      }
    })
  }, [filtered, searchedResults])

  return (
    <main className="app-shell">
      {/* ── Filter bar ── */}
      <section className="panel-card exam-selector-bar">
        <div className="filter-row filter-row-controls">
          <label className="filter-label">
            Exam Name
            <select
              className="filter-select"
              value={selectedExamName}
              onChange={(e) => {
                setSelectedExamName(e.target.value)
                setSelectedExamYear('')
                setSelectionError('')
              }}
              disabled={loadingExams}
            >
              <option value="">Select exam name</option>
              {examNameOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <label className="filter-label">
            Exam Year
            <select
              className="filter-select"
              value={selectedExamYear}
              onChange={(e) => {
                setSelectedExamYear(e.target.value)
                setSelectionError('')
              }}
              disabled={loadingExams || !selectedExamName}
            >
              <option value="">Select exam year</option>
              {examYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>

          <button className="submit-button exam-search-button" type="button" onClick={handleExamSearch}>
            Search
          </button>
        </div>

        {selectionError ? <p className="feedback error exam-selection-error">{selectionError}</p> : null}
      </section>

      <section className="panel-card filter-bar">
        <div className="island-ranks-toolbar">
          <button
            className="submit-button island-ranks-button"
            type="button"
            onClick={() => setShowIslandRanks((current) => !current)}
            disabled={!hasSearched || searchedResults.length === 0}
          >
            Islan Ranks
          </button>
        </div>

        {showIslandRanks && hasSearched && (
          <div className="island-ranks-card">
            <h3>Island Top 3 Places</h3>
            {topIslandRanks.length === 0 ? (
              <p className="rank-empty">No eligible candidates found for island ranks.</p>
            ) : (
              <ol>
                {topIslandRanks.map(({ candidate, place }, index) => {
                  return (
                    <li key={`${place}-${candidate.indexNo || candidate.nicNumber || candidate.candidateName || 'candidate'}-${index}`}>
                      <strong>{islandPlaceLabel(place)}:</strong> {candidate.candidateName || 'Unnamed candidate'} ({candidate.total} marks)
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )}

        {/* Row 1: search + status chips */}
        <div className="filter-row">
          <div className="filter-search-wrap">
            <svg className="filter-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <input
              className="filter-search"
              type="text"
              placeholder="Search by name, NIC or Index No."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-chips">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.key}
                className={`chip ${status === chip.key ? 'chip-active' : ''}`}
                onClick={() => setStatus(chip.key)}
                type="button"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: dropdowns + range + reset */}
        <div className="filter-row filter-row-controls">
          <label className="filter-label">
            Center
            <select className="filter-select" value={center} onChange={(e) => setCenter(e.target.value)}>
              <option value="">All centers</option>
              {centerOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="filter-label">
            Final Grade
            <select className="filter-select" value={finalGrade} onChange={(e) => setFinalGrade(e.target.value)}>
              <option value="">All grades</option>
              {finalGradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          <label className="filter-label">
            Total ≥
            <input
              className="filter-input-num"
              type="number"
              min="0"
              max="1000"
              placeholder="0"
              value={minTotal}
              onChange={(e) => setMinTotal(e.target.value)}
            />
          </label>

          <label className="filter-label">
            Total ≤
            <input
              className="filter-input-num"
              type="number"
              min="0"
              max="1000"
              placeholder="1000"
              value={maxTotal}
              onChange={(e) => setMaxTotal(e.target.value)}
            />
          </label>

          <div className="filter-meta">
            <span className="filter-count">{filtered.length} / {searchedResults.length} candidates</span>
            {isDirty && (
              <button className="filter-reset" type="button" onClick={resetFilters}>Clear filters</button>
            )}
          </div>
        </div>
      </section>

      {/* ── Table ── */}
      <section className="panel-card results-table-card">
        {loading && <p className="feedback">Loading results…</p>}
        {error   && <p className="feedback error">{error}</p>}

        {!loading && !error && loadingExams && (
          <div className="empty-state">
            <p>Loading exam list...</p>
            <span>Please wait.</span>
          </div>
        )}

        {!loading && !error && !hasSearched && !loadingExams && (
          <div className="empty-state">
            <p>Select exam name and exam year.</p>
            <span>Click Search to view the result table.</span>
          </div>
        )}

        {!loading && !error && hasSearched && searchedResults.length === 0 && (
          <div className="empty-state">
            <p>No records found for the selected exam.</p>
            <span>Try another exam name or year.</span>
          </div>
        )}

        {!loading && searchedResults.length > 0 && filtered.length === 0 && (
          <div className="empty-state">
            <p>No candidates match the current filters.</p>
            <span><button className="filter-reset" type="button" onClick={resetFilters}>Clear filters</button></span>
          </div>
        )}

        {!loading && filtered.length > 0 && isQuarterlyAccountingExam && (
          <div className="results-scroll">
            <table className="results-table">
              <thead>
                <tr className="rt-head-top">
                  <th className="rt-no">No</th>
                  <th className="rt-name">Name</th>
                  <th className="rt-index">Index No</th>
                  <th className="rt-nic">ID NO</th>
                  <th className="rt-trailing">1st Paper Marks</th>
                  <th className="rt-trailing">2nd Paper Marks</th>
                  <th className="rt-trailing">Total Marks</th>
                  <th className="rt-trailing">Grade</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((candidate, idx) => {
                  const marks = getQuarterlyPaperMarks(candidate)
                  return (
                    <tr key={candidate.indexNo || idx} className={idx % 2 === 0 ? 'rt-even' : 'rt-odd'}>
                      <td className="rt-no rt-center-cell">{idx + 1}</td>
                      <td className="rt-name">{candidate.candidateName || ''}</td>
                      <td className="rt-index">{candidate.indexNo || ''}</td>
                      <td className="rt-nic">{candidate.nicNumber || ''}</td>
                      <td className="rt-trailing rt-center-cell">{marks.first}</td>
                      <td className="rt-trailing rt-center-cell">{marks.second}</td>
                      <td className="rt-trailing rt-center-cell">{candidate.total ?? ''}</td>
                      <td className={`rt-trailing rt-center-cell ${gradeClass(candidate.finalGrade || '')}`}>
                        {candidate.finalGrade || ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && isCooperativeDevelopmentExam && (
          <div className="results-scroll">
            <table className="results-table">
              <thead>
                <tr className="rt-head-top">
                  <th rowSpan={2} className="rt-no">No</th>
                  <th rowSpan={2} className="rt-name">Candidate&apos;s Name</th>
                  <th rowSpan={2} className="rt-nic">NIC Number</th>
                  <th rowSpan={2} className="rt-index">Index No</th>
                  {COOPERATIVE_DEVELOPMENT_SUBJECTS.map((subject) => (
                    <th key={subject.code} colSpan={2} className="rt-subject-name">
                      <span className="rt-subject-title">{subject.name}</span>
                    </th>
                  ))}
                  <th rowSpan={2} className="rt-trailing">Total</th>
                  <th rowSpan={2} className="rt-trailing">Average</th>
                  <th rowSpan={2} className="rt-trailing">Final Grade</th>
                  <th rowSpan={2} className="rt-trailing rt-repeat">Repeat Subject Code</th>
                  <th rowSpan={2} className="rt-trailing">Place</th>
                </tr>
                <tr className="rt-head-code">
                  {COOPERATIVE_DEVELOPMENT_SUBJECTS.map((subject) => (
                    <>
                      <th key={`${subject.code}-mark`} className="rt-sub-col">Mark</th>
                      <th key={`${subject.code}-grade`} className="rt-sub-col rt-grade-col">Grade</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((candidate, idx) => {
                  const subjectCells = getCooperativeDevelopmentSubjectCells(candidate)

                  return (
                    <tr key={candidate.indexNo || idx} className={idx % 2 === 0 ? 'rt-even' : 'rt-odd'}>
                      <td className="rt-no rt-center-cell">{idx + 1}</td>
                      <td className="rt-name">{candidate.candidateName || ''}</td>
                      <td className="rt-nic">{candidate.nicNumber || ''}</td>
                      <td className="rt-index">{candidate.indexNo || ''}</td>
                      {subjectCells.map((subject) => (
                        <>
                          <td key={`${subject.code}-m`} className="rt-mark">{subject.mark || '-'}</td>
                          <td key={`${subject.code}-g`} className={`rt-grade ${gradeClass(subject.grade || '')}`}>{subject.grade || '-'}</td>
                        </>
                      ))}
                      <td className="rt-trailing rt-center-cell">{candidate.total ?? ''}</td>
                      <td className="rt-trailing rt-center-cell">{formatAverageValue(candidate.average)}</td>
                      <td className="rt-trailing rt-center-cell">{candidate.finalGrade || ''}</td>
                      <td className="rt-trailing rt-repeat">{candidate.repeatSubjectCode || ''}</td>
                      <td className="rt-trailing rt-center-cell">{candidate.place || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && !isQuarterlyAccountingExam && !isCooperativeDevelopmentExam && (
          <div className="results-scroll">
            <table className="results-table">
              <thead>
                <tr className="rt-head-top">
                  <th rowSpan={2} className="rt-no">No</th>
                  <th rowSpan={2} className="rt-name">Candidate&apos;s Name</th>
                  <th rowSpan={2} className="rt-nic">NIC Number</th>
                  <th rowSpan={2} className="rt-index">Index No.</th>
                  <th rowSpan={2} className="rt-center">Center</th>
                  {dynamicSubjectColumns.map((s) => (
                    <th key={s.code} colSpan={2} className="rt-subject-name">
                      <span className="rt-subject-title">{s.name}</span>
                      {!isDhrmExam && <span className="rt-subject-code">{s.code}</span>}
                    </th>
                  ))}
                  <th rowSpan={2} className="rt-trailing">Total</th>
                  <th rowSpan={2} className="rt-trailing">Average</th>
                  <th rowSpan={2} className="rt-trailing">Final Grade</th>
                  <th rowSpan={2} className="rt-trailing rt-repeat">Repeat Subject Code</th>
                </tr>
                <tr className="rt-head-code">
                  {dynamicSubjectColumns.map((s) => (
                    <>
                      <th key={`${s.code}-mark`} className="rt-sub-col">Mark</th>
                      <th key={`${s.code}-grade`} className="rt-sub-col rt-grade-col">Grade</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((candidate, idx) => {
                  const subjectMap = {}
                  candidate.subjects?.forEach((s) => { subjectMap[s.code] = s })
                  return (
                    <tr key={candidate.indexNo || idx} className={idx % 2 === 0 ? 'rt-even' : 'rt-odd'}>
                      <td className="rt-no rt-center-cell">{idx + 1}</td>
                      <td className="rt-name">{candidate.candidateName || ''}</td>
                      <td className="rt-nic">{candidate.nicNumber || ''}</td>
                      <td className="rt-index">{candidate.indexNo || ''}</td>
                      <td className="rt-center-col">{candidate.center || ''}</td>
                      {dynamicSubjectColumns.map((s) => {
                        const sub   = subjectMap[s.code]
                        const mark  = sub?.mark  || '-'
                        const grade = sub?.grade || '-'
                        return (
                          <>
                            <td key={`${s.code}-m`} className="rt-mark">{mark}</td>
                            <td key={`${s.code}-g`} className={`rt-grade ${gradeClass(grade)}`}>{grade}</td>
                          </>
                        )
                      })}
                      <td className="rt-trailing rt-center-cell">{candidate.total ?? ''}</td>
                      <td className="rt-trailing rt-center-cell">{formatAverageValue(candidate.average)}</td>
                      <td className="rt-trailing rt-center-cell">{candidate.finalGrade || ''}</td>
                      <td className="rt-trailing rt-repeat">{candidate.repeatSubjectCode || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
