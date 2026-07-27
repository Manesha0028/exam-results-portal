const XLSX = require("xlsx");

const CURRENT_FORMAT_EXAM_NAME = "Certificate Course of Co-operative Development Advanced Level";
const QUARTERLY_ACCOUNTING_EXAM_NAME = "Certificate Course of the Quarterly Accounting principals";

const DATA_START_ROW_INDEX = 7;
const NO_COLUMN_INDEX = 1;
const CANDIDATE_NAME_COLUMN_INDEX = 2;
const NIC_NUMBER_COLUMN_INDEX = 3;
const INDEX_NO_COLUMN_INDEX = 4;
const CENTER_COLUMN_INDEX = 5;
const SUBJECT_START_COLUMN_INDEX = 6;
const SUBJECT_COLUMN_PAIR_COUNT = 10;
const TOTAL_COLUMN_INDEX = 26;
const AVERAGE_COLUMN_INDEX = 27;
const FINAL_GRADE_COLUMN_INDEX = 28;
const REPEAT_SUBJECT_CODE_COLUMN_INDEX = 29;

const FIXED_SUBJECTS = [
  { name: "Cooperative", code: "CDAL01" },
  { name: "Marketing Management", code: "CDAL02" },
  { name: "Information Technology", code: "CDAL03" },
  { name: "Secraterial Practices", code: "CDAL04" },
  { name: "Public Relations", code: "CDAL05" },
  { name: "Accountancy", code: "CDAL06" },
  { name: "Financial Management", code: "CDAL07" },
  { name: "Law & Practices", code: "CDAL08" },
  { name: "Human resource Management", code: "CDAL09" },
  { name: "Field Assignment", code: "CDAL10" },
];

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

function parseNumericCell(value) {
  const normalized = normalizeCell(value).replace(/,/g, "");

  if (!normalized || normalized === "-") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getWorkbookRows(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new ExamParseError("The uploaded workbook does not contain any worksheets.");
  }

  const worksheet = workbook.Sheets[firstSheetName];

  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
}

function validateAdvancedLevelResultsSheet(buffer) {
  const rows = getWorkbookRows(buffer);
  const columnCount = rows.reduce((maxColumns, row) => Math.max(maxColumns, (row || []).length), 0);

  if (!rows || rows.length === 0) {
    throw new ExamParseError("The uploaded workbook does not contain any worksheets.");
  }

  if (columnCount < 29) {
    throw new ExamParseError(
      `Invalid column count. Expected 29 columns, found ${columnCount}. Please ensure you are uploading the full 10-subject result sheet.`,
    );
  }

  const topRowsText = rows.slice(0, 5).flat().map(normalizeCell).filter(Boolean);
  const fullHeaderString = topRowsText.join(" ");

  const requiredKeywords = [
    "National Co-operative Council",
    "Certificate Course",
    "Result Sheet",
  ];

  const missingKeywords = requiredKeywords.filter(
    (keyword) => !fullHeaderString.toLowerCase().includes(keyword.toLowerCase()),
  );

  if (missingKeywords.length > 0) {
    throw new ExamParseError(`Missing expected header title text: ${missingKeywords.join(", ")}.`);
  }

  const requiredCodes = Array.from({ length: 10 }, (_value, index) => `CDAL${String(index + 1).padStart(2, "0")}`);
  const foundCodes = requiredCodes.filter((code) => fullHeaderString.includes(code));

  if (foundCodes.length < requiredCodes.length) {
    throw new ExamParseError(
      `Uploaded file lacks the required subject codes (CDAL01 - CDAL10). Found: ${foundCodes.length}/10 codes.`,
    );
  }
}

function validateQuarterlyAccountingSheet(buffer) {
  const rows = getWorkbookRows(buffer);

  if (!rows || rows.length === 0) {
    throw new ExamParseError("The uploaded workbook does not contain any worksheets.");
  }

  const columnCount = rows.reduce((maxColumns, row) => Math.max(maxColumns, (row || []).length), 0);
  const dataBlockRows = rows.map((row) => (row || []).slice(0, 8));
  const dataBlockColumnCount = dataBlockRows.reduce((maxColumns, row) => Math.max(maxColumns, row.length), 0);

  if (dataBlockColumnCount < 8) {
    throw new ExamParseError(
      `Invalid column layout. Expected 8 columns for this section, but found ${dataBlockColumnCount}. If you are uploading the 10-subject result sheet, please use the correct upload page.`,
    );
  }

  const topRowsText = dataBlockRows.slice(0, 7).flat().map(normalizeCell).filter(Boolean);
  const fullHeaderString = topRowsText.join(" ").toLowerCase();

  if (!fullHeaderString.includes("quarterly accounting") && !fullHeaderString.includes("accounting")) {
    throw new ExamParseError("Document title mismatch. Expected 'Quarterly Accounting principals' result sheet.");
  }

  const requiredColumnSignatures = ["1st paper", "2nd paper", "total marks"];
  const missingSignatures = requiredColumnSignatures.filter(
    (signature) => !fullHeaderString.includes(signature),
  );

  if (missingSignatures.length > 0) {
    throw new ExamParseError(`Missing required paper mark headers: ${missingSignatures.join(", ")}.`);
  }
}

function isCandidateRow(row, trailingIndexes) {
  return normalizeCell(row[INDEX_NO_COLUMN_INDEX]);
}

function mapCandidateRow(row) {
  const subjects = FIXED_SUBJECTS.map((subject, subjectIndex) => {
    const markColumnIndex = SUBJECT_START_COLUMN_INDEX + subjectIndex * 2;
    const gradeColumnIndex = markColumnIndex + 1;

    return {
      code: subject.code,
      name: subject.name,
      mark: normalizeCell(row[markColumnIndex]),
      grade: normalizeCell(row[gradeColumnIndex]),
    };
  });

  return {
    candidateName: normalizeCell(row[CANDIDATE_NAME_COLUMN_INDEX]),
    nicNumber: normalizeCell(row[NIC_NUMBER_COLUMN_INDEX]),
    indexNo: normalizeCell(row[INDEX_NO_COLUMN_INDEX]),
    center: normalizeCell(row[CENTER_COLUMN_INDEX]),
    subjects,
    total: parseNumericCell(row[TOTAL_COLUMN_INDEX]),
    average: normalizeCell(row[AVERAGE_COLUMN_INDEX]),
    finalGrade: normalizeCell(row[FINAL_GRADE_COLUMN_INDEX]),
    repeatSubjectCode: normalizeCell(row[REPEAT_SUBJECT_CODE_COLUMN_INDEX]),
  };
}

function validateCandidate(candidate, rowIndex) {
  if (!candidate.indexNo) {
    throw new ExamParseError(`Candidate data is incomplete on worksheet row ${rowIndex + 1}. Expected Index No.`);
  }
}

function parseCurrentFormatWorkbook(buffer) {
  validateAdvancedLevelResultsSheet(buffer);
  const rows = getWorkbookRows(buffer);

  if (rows.length <= DATA_START_ROW_INDEX) {
    throw new ExamParseError("The uploaded worksheet is too short to contain the required header and candidate rows.");
  }

  return rows
    .slice(DATA_START_ROW_INDEX)
    .filter((row) => isCandidateRow(row))
    .map((row, rowOffset) => {
      const worksheetRowIndex = DATA_START_ROW_INDEX + rowOffset;
      const candidate = mapCandidateRow(row);
      validateCandidate(candidate, worksheetRowIndex);
      return candidate;
    });
}

function parseQuarterlyAccountingWorkbook(buffer) {
  validateQuarterlyAccountingSheet(buffer);
  const rows = getWorkbookRows(buffer);

  if (rows.length < 3) {
    throw new ExamParseError("The uploaded worksheet is too short for Quarterly Accounting format.");
  }

  const startRow = 2;
  const endRow = rows.length;

  const candidates = [];

  for (let rowIndex = startRow; rowIndex < endRow; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const dataRow = row.slice(0, 8);
    const noCell = normalizeCell(dataRow[0]);
    const nameCell = normalizeCell(dataRow[1]);

    if (!noCell && !nameCell) {
      continue;
    }

    const indexNo = normalizeCell(dataRow[2]);
    if (!indexNo) {
      continue;
    }

    const firstPaperMarks = normalizeCell(dataRow[4]);
    const secondPaperMarks = normalizeCell(dataRow[5]);

    const candidate = {
      candidateName: nameCell || "Unknown Candidate",
      nicNumber: normalizeCell(dataRow[3]) || "N/A",
      indexNo,
      center: "N/A",
      subjects: [
        {
          code: "QAP01",
          name: "1st Paper Marks",
          mark: firstPaperMarks,
          grade: "",
        },
        {
          code: "QAP02",
          name: "2nd Paper Marks",
          mark: secondPaperMarks,
          grade: "",
        },
      ],
      total: parseNumericCell(dataRow[6]),
      average: "",
      finalGrade: normalizeCell(dataRow[7]),
      repeatSubjectCode: "",
    };

    validateCandidate(candidate, rowIndex);
    candidates.push(candidate);
  }

  return candidates;
}

function normalizeExamName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function parseExamResultsWorkbookForExam(examName, buffer) {
  const normalizedExamName = normalizeExamName(examName);

  if (normalizedExamName === normalizeExamName(CURRENT_FORMAT_EXAM_NAME)) {
    return parseCurrentFormatWorkbook(buffer);
  }

  if (normalizedExamName === normalizeExamName(QUARTERLY_ACCOUNTING_EXAM_NAME)) {
    return parseQuarterlyAccountingWorkbook(buffer);
  }

  throw new ExamParseError(
    `No Excel format is configured for exam \"${examName}\" yet.`,
  );
}

module.exports = {
  ExamParseError,
  parseExamResultsWorkbookForExam,
  CURRENT_FORMAT_EXAM_NAME,
  QUARTERLY_ACCOUNTING_EXAM_NAME,
};