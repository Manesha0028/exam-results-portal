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

const COOPERATIVE_DEVELOPMENT_SUBJECTS = [
  { name: "Co-operative & Business Environment", code: "CDOL01" },
  { name: "Management", code: "CDOL02" },
  { name: "Accounting & Co-operative Accounting Procedures", code: "CDOL03" },
  { name: "Legal Environment & Co-operative Law", code: "CDOL04" },
  { name: "Office Management", code: "CDOL05" },
  { name: "Marketing & Co-operative Marketing", code: "CDOL06" },
];

const COOPERATIVE_DEVELOPMENT_HEADER_CHECKS = [
  { cell: "B6", expected: ["No", "No."] },
  { cell: "F7", expected: ["M"] },
  { cell: "G7", expected: ["G"] },
  { cell: "H7", expected: ["M"] },
  { cell: "I7", expected: ["G"] },
  { cell: "J7", expected: ["M"] },
  { cell: "K7", expected: ["G"] },
  { cell: "L7", expected: ["M"] },
  { cell: "M7", expected: ["G"] },
  { cell: "N7", expected: ["M"] },
  { cell: "O7", expected: ["G"] },
  { cell: "P7", expected: ["M"] },
  { cell: "Q7", expected: ["G"] },
];

const COOPERATIVE_DEVELOPMENT_COLUMN_MAP = [
  { colLetter: "B", name: "No" },
  { colLetter: "C", name: "Candidate's Name" },
  { colLetter: "D", name: "NIC Number" },
  { colLetter: "E", name: "Index No" },
  { colLetter: "F", name: "Co-operative & Business Environment CDOL01 Mark" },
  { colLetter: "G", name: "Co-operative & Business Environment CDOL01 Grade" },
  { colLetter: "H", name: "Management CDOL02 Mark" },
  { colLetter: "I", name: "Management CDOL02 Grade" },
  { colLetter: "J", name: "Accounting & Co-operative Accounting Procedures CDOL03 Mark" },
  { colLetter: "K", name: "Accounting & Co-operative Accounting Procedures CDOL03 Grade" },
  { colLetter: "L", name: "Legal Environment & Co-operative Law CDOL04 Mark" },
  { colLetter: "M", name: "Legal Environment & Co-operative Law CDOL04 Grade" },
  { colLetter: "N", name: "Office Management CDOL05 Mark" },
  { colLetter: "O", name: "Office Management CDOL05 Grade" },
  { colLetter: "P", name: "Marketing & Co-operative Marketing CDOL06 Mark" },
  { colLetter: "Q", name: "Marketing & Co-operative Marketing CDOL06 Grade" },
  { colLetter: "R", name: "Total" },
  { colLetter: "S", name: "Average" },
  { colLetter: "T", name: "Final Grade" },
  { colLetter: "AA", name: "Repeat Subject Code" },
  { colLetter: "AB", name: "Place" },
];

const COOPERATIVE_DEVELOPMENT_HEADERS = [
  "No",
  "Candidate's Name",
  "NIC Number",
  "Index No",
  "Co-operative & Business Environment CDOL01 Mark",
  "Co-operative & Business Environment CDOL01 Grade",
  "Management CDOL02 Mark",
  "Management CDOL02 Grade",
  "Accounting & Co-operative Accounting Procedures CDOL03 Mark",
  "Accounting & Co-operative Accounting Procedures CDOL03 Grade",
  "Legal Environment & Co-operative Law CDOL04 Mark",
  "Legal Environment & Co-operative Law CDOL04 Grade",
  "Office Management CDOL05 Mark",
  "Office Management CDOL05 Grade",
  "Marketing & Co-operative Marketing CDOL06 Mark",
  "Marketing & Co-operative Marketing CDOL06 Grade",
  "Total",
  "Average",
  "Final Grade",
  "Repeat Subject Code",
  "Place",
];

const COOPERATIVE_DEVELOPMENT_CELL_MAP = [
  { key: "no", col: "B" },
  { key: "candidateName", col: "C" },
  { key: "nicNumber", col: "D" },
  { key: "indexNo", col: "E" },
  { key: "cdol01Mark", col: "F" },
  { key: "cdol01Grade", col: "G" },
  { key: "cdol02Mark", col: "H" },
  { key: "cdol02Grade", col: "I" },
  { key: "cdol03Mark", col: "J" },
  { key: "cdol03Grade", col: "K" },
  { key: "cdol04Mark", col: "L" },
  { key: "cdol04Grade", col: "M" },
  { key: "cdol05Mark", col: "N" },
  { key: "cdol05Grade", col: "O" },
  { key: "cdol06Mark", col: "P" },
  { key: "cdol06Grade", col: "Q" },
  { key: "total", col: "R" },
  { key: "average", col: "S" },
  { key: "finalGrade", col: "T" },
  { key: "repeatSubjectCode", col: "AA" },
  { key: "place", col: "AB" },
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

function normalizeCooperativeDevelopmentFinalGrade(value) {
  const normalized = normalizeCell(value);

  if (!normalized) {
    return "";
  }

  const gradeMap = {
    0: "ordinary class",
    1: "second upper class",
    2: "first upper class",
    4: "repeat",
  };

  if (Object.prototype.hasOwnProperty.call(gradeMap, normalized)) {
    return gradeMap[normalized];
  }

  const numericValue = Number(normalized);
  if (Number.isFinite(numericValue) && Object.prototype.hasOwnProperty.call(gradeMap, String(numericValue))) {
    return gradeMap[String(numericValue)];
  }

  return normalized;
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

function getWorkbookWorksheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new ExamParseError("The uploaded workbook does not contain any worksheets.");
  }

  return workbook.Sheets[firstSheetName];
}

function getCellText(worksheet, cellAddress) {
  const cell = worksheet[cellAddress];
  return normalizeCell(cell?.v ?? cell?.w ?? "");
}

function getMergedCellText(worksheet, cellAddress) {
  const directValue = getCellText(worksheet, cellAddress);

  if (directValue) {
    return directValue;
  }

  const merges = worksheet["!merges"] || [];
  const target = XLSX.utils.decode_cell(cellAddress);

  for (const merge of merges) {
    if (
      target.r >= merge.s.r &&
      target.r <= merge.e.r &&
      target.c >= merge.s.c &&
      target.c <= merge.e.c
    ) {
      return getCellText(worksheet, XLSX.utils.encode_cell(merge.s));
    }
  }

  return "";
}

function findColumnLetterByHeader(worksheet, headerText, options = {}) {
  const {
    startRow = 1,
    endRow = 10,
    startColumnIndex = 0,
    endColumnIndex = 60,
  } = options;

  const expected = normalizeCell(headerText).toLowerCase();

  if (!expected) {
    return "";
  }

  for (let row = startRow; row <= endRow; row += 1) {
    for (let columnIndex = startColumnIndex; columnIndex <= endColumnIndex; columnIndex += 1) {
      const columnLetter = XLSX.utils.encode_col(columnIndex);
      const value = getMergedCellText(worksheet, `${columnLetter}${row}`).toLowerCase();

      if (value === expected) {
        return columnLetter;
      }
    }
  }

  return "";
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

function validateCooperativeDevelopmentSheet(buffer) {
  const worksheet = getWorkbookWorksheet(buffer);

  if (!worksheet) {
    throw new ExamParseError("The uploaded workbook does not contain any worksheets.");
  }

  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");

  if (range.e.r + 1 < 8) {
    throw new ExamParseError("Excel sheet missing or contains too few rows.");
  }

  const b6Value = getMergedCellText(worksheet, "B6").toLowerCase();
  if (b6Value !== "no" && b6Value !== "no.") {
    throw new ExamParseError(`Format Mismatch: Cell B6 must contain 'No', but found '${getMergedCellText(worksheet, "B6")}'.`);
  }

  for (const check of COOPERATIVE_DEVELOPMENT_HEADER_CHECKS) {
    if (check.cell === "B6") {
      continue;
    }

    const value = getMergedCellText(worksheet, check.cell).toUpperCase();
    if (!check.expected.includes(value)) {
      throw new ExamParseError(`Format Mismatch: ${check.cell} expected '${check.expected[0]}', but found '${value}'.`);
    }
  }

  const headerText = [];
  for (let rowNumber = 1; rowNumber <= 7; rowNumber += 1) {
    COOPERATIVE_DEVELOPMENT_COLUMN_MAP.forEach((column) => {
      headerText.push(getMergedCellText(worksheet, `${column.colLetter}${rowNumber}`));
    });
  }

  const fullHeaderString = headerText.join(" ").toLowerCase();
  const requiredCodes = ["CDOL01", "CDOL02", "CDOL03", "CDOL04", "CDOL05", "CDOL06"];
  const missingCodes = requiredCodes.filter((code) => !fullHeaderString.includes(code.toLowerCase()));

  if (missingCodes.length > 0) {
    throw new ExamParseError(`Format Mismatch: Lacks required subject codes: ${missingCodes.join(", ")}.`);
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

function parseCooperativeDevelopmentWorkbook(buffer) {
  validateCooperativeDevelopmentSheet(buffer);
  const worksheet = getWorkbookWorksheet(buffer);
  const results = [];
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  const maxRow = range.e.r + 1;
  const finalGradeColumn = findColumnLetterByHeader(worksheet, "Final Grade", {
    startRow: 5,
    endRow: 8,
    startColumnIndex: 17,
    endColumnIndex: 55,
  }) || "T";
  const repeatSubjectCodeColumn = findColumnLetterByHeader(worksheet, "Repeat Subject Code", {
    startRow: 5,
    endRow: 8,
    startColumnIndex: 17,
    endColumnIndex: 55,
  }) || "AA";
  const placeColumn = findColumnLetterByHeader(worksheet, "Place", {
    startRow: 5,
    endRow: 8,
    startColumnIndex: 17,
    endColumnIndex: 55,
  }) || "AB";

  for (let rowNumber = 8; rowNumber <= maxRow; rowNumber += 1) {
    const noValue = getMergedCellText(worksheet, `B${rowNumber}`);
    const nameValue = getMergedCellText(worksheet, `C${rowNumber}`);

    if (!noValue && !nameValue) {
      break;
    }

    const candidate = {
      candidateName: getMergedCellText(worksheet, `C${rowNumber}`),
      nicNumber: getMergedCellText(worksheet, `D${rowNumber}`),
      indexNo: getMergedCellText(worksheet, `E${rowNumber}`),
      center: "",
      subjects: COOPERATIVE_DEVELOPMENT_SUBJECTS.map((subject, subjectIndex) => {
        const markCol = String.fromCharCode(70 + subjectIndex * 2);
        const gradeCol = String.fromCharCode(71 + subjectIndex * 2);

        return {
          code: subject.code,
          name: subject.name,
          mark: getMergedCellText(worksheet, `${markCol}${rowNumber}`),
          grade: getMergedCellText(worksheet, `${gradeCol}${rowNumber}`),
        };
      }),
      total: parseNumericCell(getMergedCellText(worksheet, `R${rowNumber}`)),
      average: getMergedCellText(worksheet, `S${rowNumber}`),
      finalGrade: normalizeCooperativeDevelopmentFinalGrade(getMergedCellText(worksheet, `${finalGradeColumn}${rowNumber}`)),
      repeatSubjectCode: getMergedCellText(worksheet, `${repeatSubjectCodeColumn}${rowNumber}`),
      place: getMergedCellText(worksheet, `${placeColumn}${rowNumber}`),
    };

    validateCandidate(candidate, rowNumber);
    results.push(candidate);
  }

  return results;
}

function normalizeExamName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function parseExamResultsWorkbookForExam(examName, buffer) {
  const normalizedExamName = normalizeExamName(examName);

  if (normalizedExamName === normalizeExamName(CURRENT_FORMAT_EXAM_NAME)) {
    return parseCurrentFormatWorkbook(buffer);
  }

  if (normalizedExamName === normalizeExamName("Certificate Course in Co-operative Development")) {
    return parseCooperativeDevelopmentWorkbook(buffer);
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
  COOPERATIVE_DEVELOPMENT_SUBJECTS,
  QUARTERLY_ACCOUNTING_EXAM_NAME,
};