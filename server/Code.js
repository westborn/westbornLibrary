function getFormDestinationSheet(form) {
  const form_id = form.getId()
  try {
    const destination_id = form.getDestinationId()
    if (destination_id) {
      const spreadsheet = SpreadsheetApp.openById(destination_id)
      const matches = spreadsheet.getSheets().filter(function (sheet) {
        const url = sheet.getFormUrl()
        return url && url.indexOf(form_id) > -1
      })
      return matches.length > 0 ? matches[0] : null
    }
    return null
  } catch (error) {
    return null
  }
}

/**
 * Searches sheet data for text in a column and returns row number
 * @param {*} data spreadsheet.getvalues() result
 * @param {*} columnName named of the column to search
 * @param {*} searchText text to search for
 * @returns {Number} row number or null
 *
 */
function getRowFromColumnSearch(data, columnName, searchText) {
  const columnNumber = data[0].indexOf(columnName)
  for (var i = 0; i < data.length; i++) {
    if (data[i][columnNumber] === searchText) {
      return i + 1
    }
  }
  return null
}

// https://developers.google.com/drive/api/v2/ref-search-terms
function findFilesInFolder(folderID, searchExpression) {
  const files = folderID.searchFiles(searchExpression)
  const res = []
  while (files.hasNext()) {
    res.push(files.next())
  }
  return res
}

/*
  get full path & file name from file id
*/
function getFileName(id) {
  var file = DriveApp.getFileById(id)
  var fileName = file.getName()
  var strFolders = getFolders(file)
  return strFolders + '/' + fileName
}

function getFolders(object) {
  var folders = object.getParents()
  if (!folders.hasNext()) {
    return 'My Drive'
  }
  var folder = folders.next()

  var folderNames = []

  while (folder.getParents().hasNext()) {
    var folderName = folder.getName()
    folderNames.unshift(folderName)
    folder = folder.getParents().next()
  }

  return folderNames.join('/')
}

/* copySheet
  * make copy of sheet and mave it after current sheet

  * SS           SpreadSheet
  * strToCopy    Name of sheet to copy
  * strName      Name of new sheet
*/
function copySheet(SS, strToCopy, strName) {
  var SS = SS || SpreadsheetApp.getActiveSpreadsheet()
  var sheet = SS.getSheetByName(strToCopy)
  var newSheet = sheet.copyTo(SS)
  newSheet.setName(strName)
  var index = sheet.getIndex() + 1
  SS.setActiveSheet(newSheet)
  SS.moveActiveSheet(index)
}

/*
  Creates sheet if it does not exist
  Returns sheet object

  * ss           SpreadSheet                 default: current sheet
  * name         Name of sheet
*/
function createSheetIfNotExists(ss, name) {
  var ss = ss || SpreadsheetApp.getActiveSpreadsheet()

  try {
    ss.setActiveSheet(ss.getSheetByName(name))
  } catch (e) {
    ss.insertSheet(name)
  }

  var sheet = ss.getSheetByName(name)
  return sheet
}

function getMyFolder(sheetObj) {
  return DriveApp.getFileById(sheetObj.getId()).getParents().next()
}

function checkIfFolderExistElseCreate(parent, folderName) {
  let folder
  try {
    folder = parent.getFoldersByName(folderName).next()
  } catch (e) {
    folder = parent.createFolder(folderName)
  }
  return folder
}

function showToast(msg, duration) {
  SpreadsheetApp.getActive().toast(msg, 'U3A Courses', duration)
}

/**
 * List all Named Ranges in a spreadsheet
 * @param {object} ss spreadsheet object with Named Ranges
 * @returns {object} an array of objects with all rangeNames in A1 notation addresses ("named Range": 'Sheet'!A1:B2)
 *
 */
function listNamedRangesA1(ss) {
  let sheetIdToName = {}
  ss.getSheets().forEach(function (e) {
    sheetIdToName[e.getSheetId()] = e.getSheetName()
  })
  let result = {}
  res = Sheets.Spreadsheets.get(ss.getId(), {
    fields: 'namedRanges',
  }).namedRanges.forEach(function (e) {
    const id = e.range.sheetId || 0
    const sRow = e.range.startRowIndex || 0
    const eRow = e.range.endRowIndex || 1
    const sCol = e.range.startColumnIndex || 0
    const eCol = e.range.endColumnIndex || 1
    const sheetName = sheetIdToName[id.toString()]
    const a1notation = ss
      .getSheetByName(sheetName)
      .getRange(sRow + 1, sCol + 1, eRow - sRow, eCol - sCol)
      .getA1Notation()
    result[e.name] = `'${sheetName}'!${a1notation}`
  })
  return result
}
/**
 * @param {object} selectedRange range to be converted to a PDF
 * @param {string} fileName for the PDF
 * @param {string} folderName for the PDF
 * @returns {object} file object of the PDF file created
 *
 */
function makePDFfromRange(selectedRange, fileName, folderName) {
  const sheetToExport = selectedRange.getSheet()
  const ss = sheetToExport.getParent()
  const myFolder = getMyFolder(ss)
  const folder = checkIfFolderExistElseCreate(myFolder, folderName)

  const fileList = folder.getFilesByName(fileName)
  if (fileList.hasNext()) {
    fileList.next().setTrashed(true)
  }
  const url = ss.getUrl()
  const rangeParam =
    '&r1=' +
    (selectedRange.getRow() - 1) +
    '&r2=' +
    selectedRange.getLastRow() +
    '&c1=' +
    (selectedRange.getColumn() - 1) +
    '&c2=' +
    selectedRange.getLastColumn()

  const sheetParam = '&gid=' + selectedRange.getSheet().getSheetId()

  const exportUrl =
    url.replace(/\/edit.*$/, '') +
    '/export?exportFormat=pdf&format=pdf' +
    '&size=A4' +
    '&portrait=true' +
    '&fitw=true' +
    '&top_margin=0.75' +
    '&bottom_margin=0.75' +
    '&left_margin=0.7' +
    '&right_margin=0.7' +
    '&sheetnames=false&printtitle=false' +
    '&pagenum=false' +
    '&gridlines=false' +
    '&fzr=FALSE' +
    sheetParam +
    rangeParam

  //  Logger.log("exportUrl=" + exportUrl);
  const response = UrlFetchApp.fetch(exportUrl, {
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
    },
  })

  const blob = response.getBlob()

  blob.setName(fileName)
  const pdfFile = folder.createFile(blob)

  showToast(`PDF Created as : ${pdfFile.getName()}`, 10)

  return pdfFile
}

/**
 * Create an object from a 2 dimensional array (usually sheet data)
 * from https://stackoverflow.com/questions/47555347/creating-a-json-object-from-google-sheets
 *
 * @param {Array} data 2 dimensional array of rows with headings in first row
 * @return {Array.<{}>} array of objects with keys from row 1 with values from each other row
 *
 */
function getJsonArrayFromData(data) {
  const result = []
  const headers = data[0]
  const cols = headers.length

  for (var i = 1, l = data.length; i < l; i++) {
    // get a row to fill the object
    const row = data[i]
    // clear object
    const obj = {}
    for (var col = 0; col < cols; col++) {
      // fill object with new values
      obj[headers[col]] = row[col]
    }
    // add object in a final result
    result.push(obj)
  }

  return result
}

/**
 * Invokes a function, performing up to 5 retries with exponential backoff.
 * Retries with delays of approximately 1, 2, 4, 8 then 16 seconds for a total of
 * about 32 seconds before it gives up and rethrows the last error.
 * See: https://developers.google.com/google-apps/documents-list/#implementing_exponential_backoff
 * Author: peter.herrmann@gmail.com (Peter Herrmann)
 * Calls an anonymous function that concatenates a greeting with the current Apps user's email
 * var example1 = GASRetry.call(function(){return "Hello, " + Session.getActiveUser().getEmail();});
 * Calls an existing function
 * var example2 = GASRetry.call(myFunction);
 * Calls an anonymous function that calls an existing function with an argument
 * var example3 = GASRetry.call(function(){myFunction("something")});
 * Calls an anonymous function that invokes DocsList.setTrashed on myFile and logs retries with the Logger.log function.
 * var example4 = GASRetry.call(function(){myFile.setTrashed(true)}, Logger.log);
 *
 * @param {Function} func The anonymous or named function to call.
 * @param {Function} optLoggerFunction Optionally, you can pass a function that will be used to log to in the case of a retry.
 *                                     For example, Logger.log (no parentheses) will work.
 * @returns {*} The value returned by the called function.
 */
function expBackOff(func, optLoggerFunction) {
  for (var n = 0; n < 6; n++) {
    try {
      return func()
    } catch (e) {
      if (optLoggerFunction) {
        optLoggerFunction('GASRetry ' + n + ': ' + e)
      }
      if (n == 5) {
        throw e
      }
      Utilities.sleep(Math.pow(2, n) * 1000 + Math.round(Math.random() * 1000))
    }
  }
}

/**
 * returns details about the selected cell/range in a sheet or the currenty active sheet.
 *
 * @param {number} oneColOnly default 0 - 1 if selection should only be in one column
 * @param {String} inSheet  or use the active sheet
 * @returns {object} data various elements from the selected range
 * @returns {object} data.sheetSelected - {Sheet object} of the selected sheet
 * @returns {string} data.colSelected
 * @returns {string} data.rowSelected
 * @returns {string} data.rangeSelected in A1 notation
 * @returns {string} data.numRowsSelected
 * @returns {string} data.numColsSelected
 * @returns {string} data.activeCellValue - string, number, date etc
 *
 */
function metaSelected(oneColOnly = 0, inSheet) {
  const sheetSelected = SpreadsheetApp.getActive().getActiveSheet()
  const activeRange = SpreadsheetApp.getActive().getActiveRange()
  const firstColSelected = activeRange.getColumn()
  const lastColSelected = activeRange.getLastColumn()

  if (inSheet && sheetSelected.getSheetName() != inSheet) {
    showToast('You need to select cells on the "' + inSheet + '" sheet', 20)
    return null
  }
  if (oneColOnly && firstColSelected != lastColSelected) {
    showToast('You need to select in ONE column only', 20)
    return null
  }

  return {
    sheetSelected,
    rowSelected: activeRange.getRow(),
    colSelected: activeRange.getColumn(),
    activeCellValue: activeRange.getValue(),
    rangeSelected: activeRange.getA1Notation(),
    numRowsSelected: activeRange.getNumRows(),
    numColsSelected: activeRange.getNumColumns(),
  }
}

function dateDiffMinutes(dte1, dte2) {
  const d1 = new Date(dte1)
  const d2 = new Date(dte2)
  let diff = (d2.getTime() - d1.getTime()) / 1000
  return Math.abs(Math.round(diff / 60))
}

/**
 * formats a date to be dd/mm/yyyy hh:mm
 *
 * @param {Date Object} dte
 * @returns {string} formatted date
 */
function googleSheetDateTime(dte) {
  return new Date(dte)
    .toLocaleString('en-AU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(',', '')
}

/**
 * format time to readable form eg 1 hr or 2hrs 45mins
 *
 * @param {Date Object} dte
 * @returns {string} formatted time
 */
function getTextTime(value) {
  if (value === null) {
    return ''
  }
  if (value <= 0) {
    return ''
  }
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  var hour = hours > 1 ? hours + 'hrs' : hours + 'hr'
  var hour = hours === 0 ? (hour = '') : hour
  var min = minutes === 0 ? '' : minutes === 1 ? minutes + 'min' : minutes + 'mins'
  return `${hour} ${min}`.trim()
}

// weekday: 'short',
// month: 'short',
// day: 'numeric',
// year: 'numeric',
// hour: 'numeric',
// minute: '2-digit',
// second: '2-digit',
// hour12: true,
function fmtDateTimeLocal(
  dte = new Date(),
  options = {
    month: 'short',
    day: 'numeric',
  }
) {
  return new Date(dte).toLocaleString('en-AU', options)
}

/**
 * find the date for the friday prior to date passed in
 *
 * @param {Date Object} date
 * @returns {number} date Timestamp
 */
function getPreviousFridayTimestamp(date) {
  var d = new Date(date),
    day = d.getDay(),
    // if day  sun-thu then go back 1 week + that many days
    // else if Fri-Sat go back
    diff = day <= 5 ? 7 - 5 + day : day - 5

  d.setDate(d.getDate() - diff)
  d.setHours(23)
  d.setMinutes(59)
  d.setSeconds(59)

  return d.getTime()
}

/**
 * strip all? HTML decorations from a string
 *
 * @param {string} text
 * @returns {string} text with HTML removed
 */
const stripHTML = (text) => {
  return text
    .replace(/(<([^>]+)>)/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .trim()
}

/**
 * Get a Gmail draft message by matching the subject line.
 * @param {string} subject_line to search for draft message
 * @return {object} containing the subject, plain and html message body and attachments
 */
function getGmailTemplateFromDrafts_(subject_line) {
  try {
    // get drafts
    const drafts = GmailApp.getDrafts()
    // filter the drafts that match subject line
    const draft = drafts.filter(subjectFilter_(subject_line))[0]
    // get the message object
    const msg = draft.getMessage()
    // getting attachments so they can be included in the merge
    const attachments = msg.getAttachments()
    return {
      message: { subject: subject_line, text: msg.getPlainBody(), html: msg.getBody() },
      attachments: attachments,
    }
  } catch (e) {
    throw new Error("Oops - can't find Gmail draft")
  }

  /**
   * Filter draft objects with the matching subject linemessage by matching the subject line.
   * @param {string} subject_line to search for draft message
   * @return {object} GmailDraft object
   */
  function subjectFilter_(subject_line) {
    return function (element) {
      if (element.getMessage().getSubject() === subject_line) {
        return element
      }
    }
  }
}

/**
 * Fill template string with data object
 * @see https://stackoverflow.com/a/378000/1027723
 * @param {string} template string containing {{}} markers which are replaced with data
 * @param {object} data object used to replace {{}} markers
 * @return {object} message replaced with data
 */
function fillinTemplateFromObject(template, data) {
  // we have two templates one for plain text and the html body
  // stringifing the object means we can do a global replace
  let template_string = JSON.stringify(template)

  // token replacement
  template_string = template_string.replace(/{{[^{}]+}}/g, (key) => {
    return escapeData(data[key.replace(/[{}]+/g, '')] || '')
  })
  return JSON.parse(template_string)
}

/**
 * Escape cell data to make JSON safe
 * @see https://stackoverflow.com/a/9204218/1027723
 * @param {string} str to escape JSON special characters from
 * @return {string} escaped string
 */
function escapeData(str) {
  return str
    .replace(/[\\]/g, '\\\\')
    .replace(/[\"]/g, '\\"')
    .replace(/[\/]/g, '\\/')
    .replace(/[\b]/g, '\\b')
    .replace(/[\f]/g, '\\f')
    .replace(/[\n]/g, '\\n')
    .replace(/[\r]/g, '\\r')
    .replace(/[\t]/g, '\\t')
}
