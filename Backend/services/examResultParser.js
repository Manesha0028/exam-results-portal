const XLSX = require("xlsx");

const PRIMARY_HEADER_ROW_INDEX = 5;
const SUBJECT_CODE_ROW_INDEX = 6;
const DATA_START_ROW_INDEX = 7;
const SUBJECT_START_COLUMN_INDEX = 5;

const REQUIRED_TRAILING_LABELS = {
  total: "total",
  average: "average",
  finalGrade: "final grade",
  repeatSubjectCode: "repeat subject code",
};

class ExamParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ExamParseError";
  }
}

function normalizeCell(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return normalizeCell(value).toLowerCase();
}

function parseNumericCell(value) {
  const normalized = normalizeCell(value).replace(/,/g, "");

  if (!normalized || normalized === "-") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isCandidateRow(row, trailingIndexes) {
  const candidateIdentity = row.slice(0, SUBJECT_START_COLUMN_INDEX).some((cell) => normalizeCell(cell));
  const hasTrailingValue = [
    trailingIndexes.totalIndex,
    trailingIndexes.averageIndex,
    trailingIndexes.finalGradeIndex,
    trailingIndexes.repeatSubjectCodeIndex,
  ].some((index) => normalizeCell(row[index]));

  return candidateIdentity || hasTrailingValue;
}

function getTrailingIndexes(primaryHeaderRow) {
  const normalizedHeaders = primaryHeaderRow.map(normalizeKey);

  const totalIndex = normalizedHeaders.indexOf(REQUIRED_TRAILING_LABELS.total);
  const averageIndex = normalizedHeaders.indexOf(REQUIRED_TRAILING_LABELS.average);
  const finalGradeIndex = normalizedHeaders.indexOf(REQUIRED_TRAILING_LABELS.finalGrade);
  const repeatSubjectCodeIndex = normalizedHeaders.indexOf(REQUIRED_TRAILING_LABELS.repeatSubjectCode);

  if ([totalIndex, averageIndex, finalGradeIndex, repeatSubjectCodeIndex].some((index) => index === -1)) {
    throw new ExamParseError(
      "The worksheet is missing one or more required trailing columns: Total, Average, Final Grade, Repeat Subject Code.",
    );
  }

  if (!(totalIndex < averageIndex && averageIndex < finalGradeIndex && finalGradeIndex < repeatSubjectCodeIndex)) {
    throw new ExamParseError("The trailing summary columns are not in the expected order.");
  }

  return {
    totalIndex,
    averageIndex,
    finalGradeIndex,
    repeatSubjectCodeIndex,
  };
}

function buildSubjectMap(primaryHeaderRow, subjectCodeRow, totalIndex) {
  const subjects = [];

  for (let columnIndex = SUBJECT_START_COLUMN_INDEX; columnIndex < totalIndex; columnIndex += 2) {
    const name = normalizeCell(primaryHeaderRow[columnIndex]);
    const code = normalizeCell(subjectCodeRow[columnIndex]);

    if (!name && !code) {
      continue;
    }

    if (columnIndex + 1 >= totalIndex) {
      throw new ExamParseError(`Subject \"${name || code}\" does not have a grade column pair.`);
    }

    if (!name || !code) {
      throw new ExamParseError(
        `Invalid subject header structure near Excel column ${columnIndex + 1}. Each subject needs a merged name and a code in the first column of its pair.`,
      );
    }

    subjects.push({
      name,
      code,
      markColumnIndex: columnIndex,
      gradeColumnIndex: columnIndex + 1,
    });
  }

  if (subjects.length === 0) {
    throw new ExamParseError("No subject columns were found between the candidate metadata and trailing summary columns.");
  }

  return subjects;
}

function mapCandidateRow(row, subjects, trailingIndexes) {
  return {
    candidateName: normalizeCell(row[1]),
    nicNumber: normalizeCell(row[2]),
    indexNo: normalizeCell(row[3]),
    center: normalizeCell(row[4]),
    subjects: subjects.map((subject) => ({
      code: subject.code,
      name: subject.name,
      mark: normalizeCell(row[subject.markColumnIndex]),
      grade: normalizeCell(row[subject.gradeColumnIndex]),
    })),
    total: parseNumericCell(row[trailingIndexes.totalIndex]),
    average: normalizeCell(row[trailingIndexes.averageIndex]),
    finalGrade: normalizeCell(row[trailingIndexes.finalGradeIndex]),
    repeatSubjectCode: normalizeCell(row[trailingIndexes.repeatSubjectCodeIndex]),
  };
}

function validateCandidate(candidate, rowIndex) {
  if (!candidate.candidateName || !candidate.nicNumber || !candidate.indexNo || !candidate.center) {
    throw new ExamParseError(
      `Candidate data is incomplete on worksheet row ${rowIndex + 1}. Expected Candidate's Name, NIC Number, Index No., and Center.`,
    );
  }
}

function parseExamResultsWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new ExamParseError("The uploaded workbook does not contain any worksheets.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  if (rows.length <= DATA_START_ROW_INDEX) {
    throw new ExamParseError("The uploaded worksheet is too short to contain the required header and candidate rows.");
  }

  const primaryHeaderRow = rows[PRIMARY_HEADER_ROW_INDEX] || [];
  const subjectCodeRow = rows[SUBJECT_CODE_ROW_INDEX] || [];
  const trailingIndexes = getTrailingIndexes(primaryHeaderRow);
  const subjects = buildSubjectMap(primaryHeaderRow, subjectCodeRow, trailingIndexes.totalIndex);

  return rows
    .slice(DATA_START_ROW_INDEX)
    .filter((row) => isCandidateRow(row, trailingIndexes))
    .map((row, rowOffset) => {
      const worksheetRowIndex = DATA_START_ROW_INDEX + rowOffset;
      const candidate = mapCandidateRow(row, subjects, trailingIndexes);
      validateCandidate(candidate, worksheetRowIndex);
      return candidate;
    });
}

module.exports = {
  ExamParseError,
  parseExamResultsWorkbook,
};