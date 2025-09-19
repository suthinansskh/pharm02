var SHEET_ID = "15Vd-K-0f7yEXTioI8-M5tQB2992UbktMGkCEbk3M-sU";
var RECORDS_SHEET = "record";
var EVENTS_SHEET = "event";
var USERS_SHEET = "user";

function doGet(e) {
  try {
    var action = e.parameter.action || 'test';
    var callback = e.parameter.callback;
    var result;
    
    // Debug logging - ดูว่า action ที่ส่งมาคืออะไร
    console.log('doGet called with action:', action);
    console.log('All parameters:', JSON.stringify(e.parameter));
    
      switch (action) {
        case 'test':
          result = {status: "success", message: "Script is working!", timestamp: new Date()};
          break;
        case 'getEvents':
          var events = getEvents();
          result = {success: true, data: events};
          break;
        case 'getRecords':
          var records = getRecords();
          result = {success: true, data: records};
          break;
        case 'getUsers':
          var users = getUsers();
          result = {success: true, data: users};
          break;
        case 'addRecord':
          // Handle record submission via GET request (JSONP)
          result = addRecord(e.parameter);
          break;
        case 'addEvent':
          // Handle event submission via GET request (JSONP)
          result = addEvent(e.parameter);
          break;
        case 'addUser':
          // Handle user submission via GET request (JSONP)
          result = addUser(e.parameter);
          break;
        case 'updateEvent':
          // Handle event update via GET request (JSONP)
          result = updateEvent(e.parameter);
          break;
        case 'cleanTestData':
          // Handle test data cleanup via GET request (JSONP)
          result = cleanTestData(e);
          break;
        case 'removeDuplicates':
          // Handle duplicate removal via GET request (JSONP)
          result = removeDuplicates(e);
          break;
        default:
          result = {success: false, error: "Unknown action: " + action};
      }    // JSONP response - bypasses CORS completely
    if (callback) {
      var jsonpResponse = callback + '(' + JSON.stringify(result) + ');';
      return ContentService.createTextOutput(jsonpResponse)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    // Regular JSON response with CORS headers
    var output = ContentService.createTextOutput(JSON.stringify(result));
    output.setMimeType(ContentService.MimeType.JSON);
    output.setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600'
    });
    
    return output;
    
  } catch (error) {
    console.error('doGet error:', error);
    var errorResult = {
      success: false,
      error: error.toString(),
      stack: error.stack || 'no stack trace'
    };
    
    if (e.parameter.callback) {
      var jsonpError = e.parameter.callback + '(' + JSON.stringify(errorResult) + ');';
      return ContentService.createTextOutput(jsonpError)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    var output = ContentService.createTextOutput(JSON.stringify(errorResult));
    output.setMimeType(ContentService.MimeType.JSON);
    output.setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    return output;
  }
}

function getRecords() {
  try {
    console.log('getRecords called, SHEET_ID:', SHEET_ID);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(RECORDS_SHEET);
    
    if (!sheet) {
      console.log('Records sheet not found, creating new sheet');
      sheet = ss.insertSheet(RECORDS_SHEET);
      // Exact column headers as specified: Timestamp, Name, Position, Department, Date, Event, Points
      sheet.appendRow(['Timestamp', 'Name', 'Position', 'Department', 'Date', 'Event', 'Points']);
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    console.log('Records data retrieved, rows:', data.length);
    
    if (data.length <= 1) {
      console.log('No records found (only headers or empty)');
      return [];
    }
    
    var headers = data.shift();
    console.log('Headers:', headers);
    
    var records = data.map(function(row) {
      var record = {};
      headers.forEach(function(header, i) {
        record[header] = row[i];
      });
      return record;
    });
    
    console.log('Processed records:', records.length);
    return records;
  } catch (error) {
    console.error('getRecords error:', error);
    throw new Error("getRecords error: " + error.toString());
  }
}

function getEvents() {
  try {
    console.log('getEvents called');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(EVENTS_SHEET);
    
    if (!sheet) {
      sheet = ss.insertSheet(EVENTS_SHEET);
      // Exact column headers as specified: ID, Name, Catagory, Point, Date, Organizer, Status, Description, Updated At
      sheet.appendRow(['ID', 'Name', 'Catagory', 'Point', 'Date', 'Organizer', 'Status', 'Description', 'Updated At']);
      
      // Add sample events data
      var today = new Date();
      var sampleEvents = [
        [1, 'ประชุมรายเดือนกลุ่มงานเภสัชกรรม', 'ประชุม', 2, today.toISOString().split('T')[0], 'หน.เภสัชกรรม', 'active', 'ประชุมประจำเดือนของกลุ่มงานเภสัชกรรม', today],
        [2, 'อบรมการใช้ยาอย่างปลอดภัย', 'อบรม', 4, today.toISOString().split('T')[0], 'เภสัชกรอาวุโส', 'active', 'อบรมให้ความรู้เรื่องการใช้ยาอย่างปลอดภัย', today],
        [3, 'สัมมนาเภสัชศาสตร์คลินิก', 'สัมมนา', 6, today.toISOString().split('T')[0], 'ภาควิชาเภสัชกรรม', 'active', 'สัมมนาประจำปีเรื่องเภสัชศาสตร์คลินิก', today],
        [4, 'ตรวจเยี่ยมหอผู้ป่วย', 'งานประจำ', 1, today.toISOString().split('T')[0], 'เภสัชกรประจำหอ', 'active', 'ตรวจเยี่ยมผู้ป่วยในหอผู้ป่วย', today]
      ];
      
      sampleEvents.forEach(function(eventRow) {
        sheet.appendRow(eventRow);
      });
      
      return sampleEvents.map(function(row) {
        return {
          'ID': row[0],
          'Name': row[1],
          'Catagory': row[2],
          'Point': row[3],
          'Date': row[4],
          'Organizer': row[5],
          'Status': row[6],
          'Description': row[7],
          'Updated At': row[8]
        };
      });
    }
    
    var data = sheet.getDataRange().getValues();
    console.log('Events data retrieved, rows:', data.length);
    
    if (data.length <= 1) {
      console.log('No events found (only headers or empty)');
      return [];
    }
    
    var headers = data.shift();
    console.log('Events headers (raw):', headers);
    
    // Clean headers by trimming whitespace
    var cleanHeaders = headers.map(function(header) {
      return String(header || '').trim();
    });
    console.log('Events headers (cleaned):', cleanHeaders);
    
    var events = data.map(function(row) {
      var event = {};
      cleanHeaders.forEach(function(header, i) {
        if (header) { // Only add non-empty headers
          event[header] = row[i];
        }
      });
      return event;
    });
    
    console.log('Processed events:', events.length);
    return events;
  } catch (error) {
    console.error('getEvents error:', error);
    throw new Error("getEvents error: " + error.toString());
  }
}

function doPost(e) {
  try {
    var data;
    var isIframeSubmission = false;
    
    // Handle both JSON and form data submissions
    if (e.postData && e.postData.type === 'application/json') {
      // Regular JSON POST request
      data = JSON.parse(e.postData.contents);
    } else {
      // Form data from iframe submission (CORS-free)
      data = e.parameter;
      isIframeSubmission = true;
    }
    
    var result;
    
    // Handle different types of operations
    if (data.action === 'addRecord' || (!data.type && !data.action)) {
      result = addRecord(data);
    } else if (data.type === 'event' || data.action === 'addEvent') {
      result = addEvent(data);
    } else if (data.type === 'user' || data.action === 'addUser') {
      result = addUser(data);
    } else {
      result = addRecord(data);
    }
    
    // For iframe submissions, return HTML instead of JSON
    if (isIframeSubmission) {
      var htmlResponse = `
        <html>
          <head><title>Form Submitted</title></head>
          <body>
            <script>
              if (window.parent !== window) {
                window.parent.postMessage(${JSON.stringify(result)}, '*');
              }
            </script>
            <p style="text-align: center; font-family: Arial, sans-serif; color: #4CAF50;">
              ✅ บันทึกข้อมูลเรียบร้อยแล้ว!
            </p>
          </body>
        </html>
      `;
      
      return HtmlService.createHtmlOutput(htmlResponse);
    }
    
    // Regular JSON response for API calls
    var output = ContentService.createTextOutput(JSON.stringify(result));
    output.setMimeType(ContentService.MimeType.JSON);
    output.setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600'
    });
    
    return output;
    
  } catch (error) {
    var errorResult = {
      status: "error",
      message: error.toString(),
      stack: error.stack || 'no stack'
    };
    
    var output = ContentService.createTextOutput(JSON.stringify(errorResult));
    output.setMimeType(ContentService.MimeType.JSON);
    output.setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',  
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    return output;
  }
}

function doOptions(e) {
  var output = ContentService.createTextOutput('');
  output.setMimeType(ContentService.MimeType.TEXT);
  output.setHeaders({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '3600'
  });
  return output;
}

function addRecord(data) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(RECORDS_SHEET);
    
    if (!sheet) {
      sheet = ss.insertSheet(RECORDS_SHEET);
      // Exact column headers: Timestamp, Name, Position, Department, Date, Event, Points
      sheet.appendRow(['Timestamp', 'Name', 'Position', 'Department', 'Date', 'Event', 'Points']);
    }
    
    // Check for duplicate records (Name + Date + Event combination)
    var existingData = sheet.getDataRange().getValues();
    console.log('Checking for duplicates. Total rows:', existingData.length);
    
    if (existingData.length > 1) { // Skip header row
      var headers = existingData[0];
      var nameIndex = headers.indexOf('Name');
      var dateIndex = headers.indexOf('Date');
      var eventIndex = headers.indexOf('Event');
      
      console.log('Column indices - Name:', nameIndex, 'Date:', dateIndex, 'Event:', eventIndex);
      
      // Check each existing record (skip header row)
      for (var i = 1; i < existingData.length; i++) {
        var existingRow = existingData[i];
        var existingName = String(existingRow[nameIndex] || '').trim();
        var existingDate = existingRow[dateIndex];
        var existingEvent = String(existingRow[eventIndex] || '').trim();
        
        // Convert date to string for comparison
        if (existingDate instanceof Date) {
          existingDate = Utilities.formatDate(existingDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          existingDate = String(existingDate || '').trim();
        }
        
        // Compare with new record data
        var newName = String(data.name || '').trim();
        var newDate = String(data.date || '').trim();
        var newEvent = String(data.event || '').trim();
        
        console.log('Comparing:', {
          existing: { name: existingName, date: existingDate, event: existingEvent },
          new: { name: newName, date: newDate, event: newEvent }
        });
        
        if (existingName === newName && existingDate === newDate && existingEvent === newEvent) {
          console.log('Duplicate found:', {
            name: newName,
            date: newDate,
            event: newEvent
          });
          
          return {
            status: "error",
            message: "ข้อมูลซ้ำ: " + newName + " ได้บันทึกการเข้าร่วม " + newEvent + " ในวันที่ " + newDate + " แล้ว",
            isDuplicate: true
          };
        }
      }
    }
    
    var timestamp = new Date();
    console.log('Adding new record:', {
      name: data.name,
      date: data.date,
      event: data.event
    });
    
    // Match exact column order: Timestamp, Name, Position, Department, Date, Event, Points
    sheet.appendRow([
      timestamp,
      data.name || '',
      data.position || '',
      data.department || '',
      data.date || '',
      data.event || '',
      parseInt(data.points) || 0
    ]);
    
    return {
      status: "success",
      message: "บันทึกข้อมูลเรียบร้อยแล้ว",
      timestamp: timestamp
    };
    
  } catch (error) {
    return {
      status: "error",
      message: "เกิดข้อผิดพลาดในการบันทึก: " + error.toString()
    };
  }
}

function addEvent(eventData) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(EVENTS_SHEET);
    
    if (!sheet) {
      sheet = ss.insertSheet(EVENTS_SHEET);
      // Exact column headers: ID, Name, Catagory, Point, Date, Organizer, Status, Description, Updated At
      sheet.appendRow(['ID', 'Name', 'Catagory', 'Point', 'Date', 'Organizer', 'Status', 'Description', 'Updated At']);
    }
    
    var timestamp = new Date();
    var eventId = timestamp.getTime();
    
    // Match exact column order: ID, Name, Catagory, Point, Date, Organizer, Status, Description, Updated At
    sheet.appendRow([
      eventId,
      eventData.name || '',
      eventData.category || eventData.catagory || '',  // Handle both spellings
      parseInt(eventData.points) || parseInt(eventData.point) || 0,  // Handle both field names
      eventData.date || '',
      eventData.organizer || '',
      eventData.status || 'active',
      eventData.description || '',
      timestamp
    ]);
    
    return {
      status: "success",
      message: "เพิ่มกิจกรรมเรียบร้อยแล้ว",
      id: eventId,
      timestamp: timestamp
    };
    
  } catch (error) {
    return {
      status: "error",
      message: "เกิดข้อผิดพลาดในการเพิ่มกิจกรรม: " + error.toString()
    };
  }
}

/**
 * Get all users from the user sheet
 */
function getUsers() {
  try {
    console.log('getUsers called');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(USERS_SHEET);
    
    if (!sheet) {
      sheet = ss.insertSheet(USERS_SHEET);
      // Exact column headers: PS Code, ID 13 หลัก, ชื่อ-นามสกุล, กลุ่ม, ระดับ, หน่วยงาน, รหัสผ่าน, status
      sheet.appendRow(['PS Code', 'ID 13 หลัก', 'ชื่อ-นามสกุล', 'กลุ่ม', 'ระดับ', 'หน่วยงาน', 'รหัสผ่าน', 'status']);
      
      // Add sample users data
      var sampleUsers = [
        ['PS001', '1234567890123', 'นาย ทดสอบ ระบบ', 'กลุ่ม A', 'เภสัชกร', 'เภสัชกรรม', 'pass123', 'active'],
        ['PS002', '1234567890124', 'นาง ทดสอบ สอง', 'กลุ่ม B', 'เภสัชกรชำนาญการ', 'เภสัชกรรม', 'pass456', 'active'],
        ['PS003', '1234567890125', 'นส. ทดสอบ สาม', 'กลุ่ม A', 'เภสัชกรเชี่ยวชาญ', 'เภสัชกรรมคลินิก', 'pass789', 'active'],
        ['PS004', '1234567890126', 'นาย ทดสอบ สี่', 'กลุ่ม C', 'หน.เภสัชกร', 'เภสัชกรรม', 'pass000', 'active']
      ];
      
      sampleUsers.forEach(function(userRow) {
        sheet.appendRow(userRow);
      });
      
      return sampleUsers.map(function(row) {
        return {
          'PS Code': row[0],
          'ID 13 หลัก': row[1],
          'ชื่อ-นามสกุล': row[2],
          'กลุ่ม': row[3],
          'ระดับ': row[4],
          'หน่วยงาน': row[5],
          'รหัสผ่าน': row[6],
          'status': row[7]
        };
      });
    }
    
    var data = sheet.getDataRange().getValues();
    console.log('Users data retrieved, rows:', data.length);
    
    if (data.length <= 1) {
      console.log('No users found (only headers or empty)');
      return [];
    }
    
    var headers = data.shift();
    console.log('Users headers:', headers);
    
    var users = data.map(function(row) {
      var user = {};
      headers.forEach(function(header, i) {
        user[header] = row[i];
      });
      return user;
    });
    
    console.log('Processed users:', users.length);
    return users;
  } catch (error) {
    console.error('getUsers error:', error);
    throw new Error("getUsers error: " + error.toString());
  }
}

/**
 * Add a new user to the user sheet
 */
function addUser(userData) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(USERS_SHEET);
    
    if (!sheet) {
      sheet = ss.insertSheet(USERS_SHEET);
      // Exact column headers: PS Code, ID 13 หลัก, ชื่อ-นามสกุล, กลุ่ม, ระดับ, หน่วยงาน, รหัสผ่าน, status
      sheet.appendRow(['PS Code', 'ID 13 หลัก', 'ชื่อ-นามสกุล', 'กลุ่ม', 'ระดับ', 'หน่วยงาน', 'รหัสผ่าน', 'status']);
    }
    
    // Match exact column order: PS Code, ID 13 หลัก, ชื่อ-นามสกุล, กลุ่ม, ระดับ, หน่วยงาน, รหัสผ่าน, status
    sheet.appendRow([
      userData.psCode || userData.ps_code || '',
      userData.id13 || userData.nationalId || '',
      userData.fullName || userData.name || '',
      userData.group || userData.team || '',
      userData.level || userData.position || '',
      userData.department || userData.unit || '',
      userData.password || '',
      userData.status || 'active'
    ]);
    
    return {
      status: "success",
      message: "เพิ่มผู้ใช้เรียบร้อยแล้ว"
    };
    
  } catch (error) {
    return {
      status: "error",
      message: "เกิดข้อผิดพลาดในการเพิ่มผู้ใช้: " + error.toString()
    };
  }
}

function updateEvent(eventData) {
  try {
    console.log('updateEvent called with data:', eventData);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(EVENTS_SHEET);
    
    if (!sheet) {
      return {
        success: false,
        error: "Events sheet not found"
      };
    }
    
    var eventId = eventData.id;
    if (!eventId) {
      return {
        success: false,
        error: "Event ID is required"
      };
    }
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    console.log('Headers (raw):', headers);
    
    // Clean headers by trimming whitespace
    var cleanHeaders = headers.map(function(header) {
      return String(header || '').trim();
    });
    console.log('Headers (cleaned):', cleanHeaders);
    
    var idIndex = cleanHeaders.indexOf('ID');
    
    if (idIndex === -1) {
      return {
        success: false,
        error: "ID column not found. Available columns: " + cleanHeaders.join(', ')
      };
    }
    
    // Find the row to update
    var rowToUpdate = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] == eventId) {
        rowToUpdate = i + 1; // Convert to 1-based row number
        break;
      }
    }
    
    if (rowToUpdate === -1) {
      return {
        success: false,
        error: "Event not found"
      };
    }
    
    // Update the row using clean headers
    var nameIndex = cleanHeaders.indexOf('Name');
    var categoryIndex = cleanHeaders.indexOf('Catagory');
    var pointIndex = cleanHeaders.indexOf('Point');
    var dateIndex = cleanHeaders.indexOf('Date');
    var organizerIndex = cleanHeaders.indexOf('Organizer');
    var statusIndex = cleanHeaders.indexOf('Status');
    var descriptionIndex = cleanHeaders.indexOf('Description');
    var updatedAtIndex = cleanHeaders.indexOf('Updated At');
    
    if (nameIndex !== -1 && eventData.name) {
      sheet.getRange(rowToUpdate, nameIndex + 1).setValue(eventData.name);
    }
    if (categoryIndex !== -1 && eventData.category) {
      sheet.getRange(rowToUpdate, categoryIndex + 1).setValue(eventData.category);
    }
    if (pointIndex !== -1 && eventData.point !== undefined) {
      sheet.getRange(rowToUpdate, pointIndex + 1).setValue(parseFloat(eventData.point) || 0);
    }
    if (dateIndex !== -1 && eventData.date) {
      sheet.getRange(rowToUpdate, dateIndex + 1).setValue(eventData.date);
    }
    if (organizerIndex !== -1 && eventData.organizer) {
      sheet.getRange(rowToUpdate, organizerIndex + 1).setValue(eventData.organizer);
    }
    if (statusIndex !== -1 && eventData.status) {
      sheet.getRange(rowToUpdate, statusIndex + 1).setValue(eventData.status);
    }
    if (descriptionIndex !== -1 && eventData.description !== undefined) {
      sheet.getRange(rowToUpdate, descriptionIndex + 1).setValue(eventData.description || '');
    }
    if (updatedAtIndex !== -1) {
      sheet.getRange(rowToUpdate, updatedAtIndex + 1).setValue(new Date());
    }
    
    console.log('Event updated successfully, ID:', eventId);
    
    return {
      success: true,
      message: "อัปเดตกิจกรรมเรียบร้อยแล้ว"
    };
    
  } catch (error) {
    console.error('updateEvent error:', error);
    return {
      success: false,
      error: "เกิดข้อผิดพลาดในการอัปเดตกิจกรรม: " + error.toString()
    };
  }
}

// Remove duplicate records function
function removeDuplicates(e) {
  try {
    var action = e.parameter.action;
    
    if (action === 'removeDuplicates') {
      var password = e.parameter.password;
      
      // Simple password protection
      if (password !== 'cleanup2024') {
        return {
          success: false,
          error: "รหัสผ่านไม่ถูกต้อง"
        };
      }
      
      var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
      var recordsSheet = spreadsheet.getSheetByName(RECORDS_SHEET);
      
      if (!recordsSheet) {
        return {
          success: false,
          error: "ไม่พบชีต record"
        };
      }
      
      var data = recordsSheet.getDataRange().getValues();
      if (data.length <= 1) {
        return {
          success: true,
          message: "ไม่มีข้อมูลซ้ำที่จะลบ",
          removedCount: 0
        };
      }
      
      var headers = data[0];
      var nameIndex = headers.indexOf('Name');
      var dateIndex = headers.indexOf('Date');
      var eventIndex = headers.indexOf('Event');
      
      // Find duplicates (keep first occurrence, mark others for deletion)
      var seen = {};
      var rowsToDelete = [];
      
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var name = String(row[nameIndex] || '').trim();
        var date = row[dateIndex];
        var event = String(row[eventIndex] || '').trim();
        
        // Convert date to string for comparison
        if (date instanceof Date) {
          date = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          date = String(date || '').trim();
        }
        
        var key = name + '|' + date + '|' + event;
        
        if (seen[key]) {
          rowsToDelete.push(i + 1); // +1 because sheet rows are 1-indexed
        } else {
          seen[key] = true;
        }
      }
      
      // Delete duplicate rows in reverse order (to maintain row indices)
      rowsToDelete.reverse();
      for (var j = 0; j < rowsToDelete.length; j++) {
        recordsSheet.deleteRow(rowsToDelete[j]);
      }
      
      console.log('Duplicates removed:', rowsToDelete.length);
      
      return {
        success: true,
        message: "ลบข้อมูลซ้ำเรียบร้อยแล้ว",
        removedCount: rowsToDelete.length
      };
    }
    
    return {
      success: false,
      error: "ไม่พบ action removeDuplicates"
    };
    
  } catch (error) {
    console.error('removeDuplicates error:', error);
    return {
      success: false,
      error: "เกิดข้อผิดพลาดในการลบข้อมูลซ้ำ: " + error.toString()
    };
  }
}

// Test data cleanup function
function cleanTestData(e) {
  try {
    var action = e.parameter.action;
    
    if (action === 'cleanTestData') {
      var password = e.parameter.password;
      
      // Simple password protection - change this to a secure password
      if (password !== 'cleanup2024') {
        return {
          success: false,
          error: "รหัสผ่านไม่ถูกต้อง"
        };
      }
      
      var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
      var recordsSheet = spreadsheet.getSheetByName(RECORDS_SHEET);
      
      // Clear all data except headers (row 1)
      var lastRow = recordsSheet.getLastRow();
      if (lastRow > 1) {
        recordsSheet.deleteRows(2, lastRow - 1);
      }
      
      console.log('Test data cleaned successfully');
      
      return {
        success: true,
        message: "ลบข้อมูลทดสอบเรียบร้อยแล้ว",
        deletedRows: lastRow - 1
      };
    }
    
    return {
      success: false,
      error: "ไม่พบ action cleanTestData"
    };
    
  } catch (error) {
    console.error('cleanTestData error:', error);
    return {
      success: false,
      error: "เกิดข้อผิดพลาดในการลบข้อมูลทดสอบ: " + error.toString()
    };
  }
}
