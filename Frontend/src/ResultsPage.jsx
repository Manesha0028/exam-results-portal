import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

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

  return (
    <main className="app-shell">
      <section className="hero-panel results-hero">
        <p className="eyebrow">Exam Results Portal</p>
        <h1>Result Sheet</h1>
        <p className="hero-copy">
          {appliedExamName && appliedExamYear
            ? `${appliedExamName} · Academic Year ${appliedExamYear}`
            : 'Select exam name and year, then search to view results.'}
        </p>
        <p className="grade-legend">
          (75 &ge; D – Distinction)&ensp;(55–74 = C – Credit)&ensp;(35–54 = S – Simple Pass)&ensp;(34&lt; F = Failure)&ensp;(AB = Absent)
        </p>
      </section>

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

        {!loading && filtered.length > 0 && (
          <div className="results-scroll">
            <table className="results-table">
              <thead>
                <tr className="rt-head-top">
                  <th rowSpan={2} className="rt-no">No</th>
                  <th rowSpan={2} className="rt-name">Candidate&apos;s Name</th>
                  <th rowSpan={2} className="rt-nic">NIC Number</th>
                  <th rowSpan={2} className="rt-index">Index No.</th>
                  <th rowSpan={2} className="rt-center">Center</th>
                  {SUBJECTS.map((s) => (
                    <th key={s.code} colSpan={2} className="rt-subject-name">
                      <span className="rt-subject-title">{s.name}</span>
                      <span className="rt-subject-code">{s.code}</span>
                    </th>
                  ))}
                  <th rowSpan={2} className="rt-trailing">Total</th>
                  <th rowSpan={2} className="rt-trailing">Average</th>
                  <th rowSpan={2} className="rt-trailing">Final Grade</th>
                  <th rowSpan={2} className="rt-trailing rt-repeat">Repeat Subject Code</th>
                </tr>
                <tr className="rt-head-code">
                  {SUBJECTS.map((s) => (
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
                      {SUBJECTS.map((s) => {
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
                      <td className="rt-trailing rt-center-cell">{candidate.average || ''}</td>
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
