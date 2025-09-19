// summary.js - ระบบจัดการข้อมูลสรุปการเข้าร่วมประชุม

// Configuration
const CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyDbNuvZVetuZMpqf1XTgmHGb6RRON1LqfLb03ptaUqbx608Zv8MAzoOgYEk_KLwRQvjg/exec',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    DEBUG: false
};

// Global data storage
let recordsData = [];
let eventsData = [];
let usersData = [];
let filteredData = [];

// Debug logging
function debugLog(message, data = null) {
    if (CONFIG.DEBUG) {
        console.log(`[Summary Debug] ${message}`, data || '');
    }
}

// Initialize data arrays
function initializeData() {
    if (!Array.isArray(recordsData)) {
        console.warn('recordsData is not an array, initializing as empty array');
        recordsData = [];
    }
    if (!Array.isArray(eventsData)) {
        console.warn('eventsData is not an array, initializing as empty array');
        eventsData = [];
    }
    if (!Array.isArray(usersData)) {
        console.warn('usersData is not an array, initializing as empty array');
        usersData = [];
    }
}

// JSONP Helper Functions
function jsonpRequest(url, callback) {
    const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
    const script = document.createElement('script');
    let timeoutId;
    
    // Cleanup function
    const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (script.parentNode) {
            script.parentNode.removeChild(script);
        }
        if (window[callbackName]) {
            delete window[callbackName];
        }
    };
    
    // Success callback
    window[callbackName] = function(data) {
        debugLog('JSONP Response received', data);
        cleanup();
        callback(data);
    };
    
    // Error handling
    script.onerror = function() {
        debugLog('JSONP Request failed - Script error');
        cleanup();
        callback({ success: false, error: 'Network error - Failed to load script' });
    };
    
    // Timeout handling (30 seconds)
    timeoutId = setTimeout(() => {
        debugLog('JSONP Request timeout');
        cleanup();
        callback({ success: false, error: 'Network error - Request timeout' });
    }, 30000);
    
    // Set script source and add to DOM
    const separator = url.indexOf('?') >= 0 ? '&' : '?';
    script.src = url + separator + 'callback=' + callbackName;
    
    debugLog('Making JSONP request to:', script.src);
    document.head.appendChild(script);
}

// UI Helper Functions
function showLoading() {
    const loadingDiv = document.getElementById('loading-overlay');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
    }
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading-overlay');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}

function showError(message) {
    hideLoading();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <h3>เกิดข้อผิดพลาด</h3>
            <p>${message}</p>
            <button onclick="retryLoadData()">ลองใหม่</button>
            <button onclick="hideErrorMessage()">ปิด</button>
        </div>
    `;
    
    // Remove existing error message
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    document.body.appendChild(errorDiv);
}

function hideError() {
    const errorDiv = document.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.remove();
    }
}

// Hide error message
function hideErrorMessage() {
    const errorDiv = document.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.remove();
    }
}

// Retry loading data
function retryLoadData() {
    hideErrorMessage();
    loadAllData();
}

// Load all data from Google Sheets
async function loadAllData() {
    showLoading();
    debugLog('Starting to load all data...');
    
    try {
        // Load records data with better error handling
        await new Promise((resolve, reject) => {
            const recordsUrl = CONFIG.SCRIPT_URL + '?action=getRecords';
            debugLog('Loading records from:', recordsUrl);
            
            jsonpRequest(recordsUrl, (response) => {
                debugLog('Records response:', response);
                
                // Handle response with fallback to empty array
                if (response && response.success && response.data) {
                    if (Array.isArray(response.data)) {
                        recordsData = response.data;
                        debugLog(`Records loaded successfully: ${recordsData.length} records`);
                        resolve();
                    } else {
                        console.warn('Records data is not an array, using empty array:', typeof response.data, response.data);
                        recordsData = [];
                        debugLog('Records data was not array, using empty array');
                        resolve();
                    }
                } else {
                    console.warn('Failed to load records, using empty array:', response);
                    recordsData = [];
                    debugLog('Records loading failed, using empty array');
                    resolve();
                }
            });
        });

        // Load events data
        await new Promise((resolve, reject) => {
            const eventsUrl = CONFIG.SCRIPT_URL + '?action=getEvents';
            debugLog('Loading events from:', eventsUrl);
            
            jsonpRequest(eventsUrl, (response) => {
                debugLog('Events response:', response);
                if (response && response.success && response.data) {
                    if (Array.isArray(response.data)) {
                        eventsData = response.data;
                        debugLog('Events loaded:', eventsData.length + ' events');
                        resolve();
                    } else {
                        console.warn('Events data is not an array, using empty array');
                        eventsData = [];
                        resolve();
                    }
                } else {
                    console.warn('Failed to load events, using empty array');
                    eventsData = [];
                    resolve();
                }
            });
        });

        // Load users data
        await new Promise((resolve, reject) => {
            const usersUrl = CONFIG.SCRIPT_URL + '?action=getUsers';
            debugLog('Loading users from:', usersUrl);
            
            jsonpRequest(usersUrl, (response) => {
                if (response && response.success && response.data) {
                    if (Array.isArray(response.data)) {
                        usersData = response.data;
                        debugLog('Users loaded:', usersData.length + ' users');
                        resolve();
                    } else {
                        console.warn('Users data is not an array, using empty array');
                        usersData = [];
                        resolve();
                    }
                } else {
                    console.warn('Failed to load users, using empty array');
                    usersData = [];
                    resolve();
                }
            });
        });

        // Initialize data arrays and process
        initializeData();
        processDataWithLimit();
        populateFilters();
        
        hideLoading();
        hideError();
        
    } catch (error) {
        console.error('Error loading data:', error);
        hideLoading();
        showError('ไม่สามารถโหลดข้อมูลได้: ' + error.message);
    }
}

// Process raw data into summary format
function processData() {
    debugLog('Processing data...');
    
    // Safety check
    if (!Array.isArray(recordsData)) {
        console.error('recordsData is not an array in processData:', recordsData);
        recordsData = [];
    }
    if (!Array.isArray(eventsData)) {
        console.error('eventsData is not an array in processData:', eventsData);
        eventsData = [];
    }
    
    const participantSummary = {};
    
    recordsData.forEach(record => {
        if (!record.Name || !record.Event) return;
        
        const key = record.Name;
        if (!participantSummary[key]) {
            participantSummary[key] = {
                name: record.Name,
                position: record.Position || '',
                department: record.Department || '',
                attendanceCount: 0,
                totalPoints: 0,
                events: [],
                lastAttendance: null
            };
        }
        
        // Find event details
        const eventDetails = eventsData.find(e => e.Name === record.Event);
        const points = eventDetails ? (parseFloat(eventDetails.Point) || 0) : 0;
        
        // Use event date from events sheet if available, otherwise use record date
        const eventDate = eventDetails ? eventDetails.Date : record.Date;
        
        participantSummary[key].attendanceCount++;
        participantSummary[key].totalPoints += points;
        
        const eventEntry = {
            eventName: record.Event,
            date: eventDate,
            points: points,
            timestamp: record.Timestamp
        };
        
        participantSummary[key].events.push(eventEntry);
        
        // Update last attendance
        if (!participantSummary[key].lastAttendance || 
            new Date(eventDate) > new Date(participantSummary[key].lastAttendance)) {
            participantSummary[key].lastAttendance = eventDate;
        }
    });
    
    // Convert to array and sort by total points (descending)
    filteredData = Object.values(participantSummary)
        .sort((a, b) => b.totalPoints - a.totalPoints);
    
    displaySummaryStatistics(filteredData);
    displayParticipantTableOptimized(filteredData);
    displayDetailedRecords();
}

// Apply filters
function applyFilters() {
    debugLog('Applying filters...');
    
    // Safety check
    if (!Array.isArray(recordsData)) {
        console.error('recordsData is not an array in applyFilters:', recordsData);
        recordsData = [];
    }
    if (!Array.isArray(eventsData)) {
        console.error('eventsData is not an array in applyFilters:', eventsData);
        eventsData = [];
    }
    
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const eventFilter = document.getElementById('event-filter').value;
    const departmentFilter = document.getElementById('department-filter').value;
    
    // Re-process data with filters
    const participantSummary = {};
    
    recordsData.forEach(record => {
        if (!record.Name || !record.Event) return;
        
        // Find event details for date filtering
        const eventDetails = eventsData.find(e => e.Name === record.Event);
        const eventDate = eventDetails ? eventDetails.Date : record.Date;
        
        // Apply date filters
        if (dateFrom && eventDate < dateFrom) return;
        if (dateTo && eventDate > dateTo) return;
        
        // Apply event filter
        if (eventFilter && record.Event !== eventFilter) return;
        
        // Apply department filter
        if (departmentFilter && record.Department !== departmentFilter) return;
        
        const key = record.Name;
        if (!participantSummary[key]) {
            participantSummary[key] = {
                name: record.Name,
                position: record.Position || '',
                department: record.Department || '',
                attendanceCount: 0,
                totalPoints: 0,
                events: [],
                lastAttendance: null
            };
        }
        
        const points = eventDetails ? (parseFloat(eventDetails.Point) || 0) : 0;
        
        participantSummary[key].attendanceCount++;
        participantSummary[key].totalPoints += points;
        
        const eventEntry = {
            eventName: record.Event,
            date: eventDate,
            points: points,
            timestamp: record.Timestamp
        };
        
        participantSummary[key].events.push(eventEntry);
        
        if (!participantSummary[key].lastAttendance || 
            new Date(eventDate) > new Date(participantSummary[key].lastAttendance)) {
            participantSummary[key].lastAttendance = eventDate;
        }
    });
    
    filteredData = Object.values(participantSummary)
        .sort((a, b) => b.totalPoints - a.totalPoints);
    
    displaySummaryStatistics(filteredData);
    displayParticipantTable(filteredData);
    displayDetailedRecords();
}

// Display summary statistics
function displaySummaryStatistics(data) {
    const totalParticipants = data.length;
    const totalEvents = eventsData.length;
    const totalAttendanceRecords = recordsData.length;
    const averagePoints = totalParticipants > 0 
        ? (data.reduce((sum, p) => sum + p.totalPoints, 0) / totalParticipants).toFixed(1)
        : 0;
    
    document.getElementById('total-participants').textContent = totalParticipants;
    document.getElementById('total-meetings').textContent = totalEvents;
    document.getElementById('total-points').textContent = totalAttendanceRecords;
    document.getElementById('avg-attendance').textContent = averagePoints + ' คะแนน';
}

// Display participant summary table
function displayParticipantTable(data) {
    const tbody = document.getElementById('summary-tbody');
    if (!tbody) {
        console.error('summary-tbody element not found');
        return;
    }
    tbody.innerHTML = '';
    
    data.forEach((participant, index) => {
        const row = tbody.insertRow();
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${participant.name}</td>
            <td>${participant.position}</td>
            <td>${participant.department}</td>
            <td>${participant.attendanceCount}</td>
            <td class="points">${participant.totalPoints}</td>
            <td>${formatDate(participant.lastAttendance)}</td>
            <td><button class="btn-detail" onclick="showParticipantDetail('${participant.name}')">รายละเอียด</button></td>
        `;
    });
}

// Display detailed records
function displayDetailedRecords() {
    const detailedContent = document.getElementById('detailed-content');
    if (!detailedContent) {
        console.warn('detailed-content element not found, skipping detailed records display');
        return;
    }
    
    // Apply current filters to records
    const dateFrom = document.getElementById('date-from')?.value || '';
    const dateTo = document.getElementById('date-to')?.value || '';
    const eventFilter = document.getElementById('event-filter')?.value || '';
    const departmentFilter = document.getElementById('department-filter')?.value || '';
    
    const filteredRecords = recordsData.filter(record => {
        const eventDetails = eventsData.find(e => e.Name === record.Event);
        const eventDate = eventDetails ? eventDetails.Date : record.Date;
        
        if (dateFrom && eventDate < dateFrom) return false;
        if (dateTo && eventDate > dateTo) return false;
        if (eventFilter && record.Event !== eventFilter) return false;
        if (departmentFilter && record.Department !== departmentFilter) return false;
        
        return true;
    });
    
    // Create a table for detailed records
    let tableHTML = `
        <table class="detailed-table">
            <thead>
                <tr>
                    <th>วันที่บันทึก</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>ตำแหน่ง</th>
                    <th>หน่วยงาน</th>
                    <th>กิจกรรม</th>
                    <th>วันที่จัด</th>
                    <th>คะแนน</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    const sortedRecords = filteredRecords.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    
    if (sortedRecords.length === 0) {
        tableHTML += `
                <tr>
                    <td colspan="7" style="text-align: center; color: #999;">ไม่มีข้อมูลบันทึกการเข้าร่วม</td>
                </tr>
        `;
    } else {
        sortedRecords.forEach(record => {
            const eventDetails = eventsData.find(e => e.Name === record.Event);
            const points = eventDetails ? (parseFloat(eventDetails.Point) || 0) : 0;
            const eventDate = eventDetails ? eventDetails.Date : record.Date;
            
            tableHTML += `
                <tr>
                    <td>${formatDateTime(record.Timestamp)}</td>
                    <td>${record.Name || ''}</td>
                    <td>${record.Position || ''}</td>
                    <td>${record.Department || ''}</td>
                    <td>${record.Event || ''}</td>
                    <td>${formatDate(eventDate)}</td>
                    <td class="points">${points}</td>
                </tr>
            `;
        });
    }
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    detailedContent.innerHTML = tableHTML;
}

// Search functionality
function searchParticipants() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    if (!searchTerm) {
        displayParticipantTable(filteredData);
        return;
    }
    
    const searchResults = filteredData.filter(participant => 
        participant.name.toLowerCase().includes(searchTerm) ||
        participant.position.toLowerCase().includes(searchTerm) ||
        participant.department.toLowerCase().includes(searchTerm)
    );
    
    displayParticipantTable(searchResults);
}

// Clear all filters
function clearFilters() {
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const eventFilter = document.getElementById('event-filter');
    const departmentFilter = document.getElementById('department-filter');
    const searchInput = document.getElementById('search-input');
    
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    if (eventFilter) eventFilter.value = '';
    if (departmentFilter) departmentFilter.value = '';
    if (searchInput) searchInput.value = '';
    
    processDataWithLimit(); // Reload original data
}

// Populate filter options
function populateFilters() {
    const eventSelect = document.getElementById('event-filter');
    const departmentSelect = document.getElementById('department-filter');
    
    // Clear existing options (keep first empty option)
    eventSelect.innerHTML = '<option value="">ทุกกิจกรรม</option>';
    departmentSelect.innerHTML = '<option value="">ทุกแผนก</option>';
    
    // Populate event options
    const uniqueEvents = [...new Set(eventsData.map(event => event.Name))];
    uniqueEvents.forEach(eventName => {
        const option = document.createElement('option');
        option.value = eventName;
        option.textContent = eventName;
        eventSelect.appendChild(option);
    });
    
    // Populate department options
    const uniqueDepartments = [...new Set(recordsData.map(record => record.Department).filter(dept => dept))];
    uniqueDepartments.forEach(department => {
        const option = document.createElement('option');
        option.value = department;
        option.textContent = department;
        departmentSelect.appendChild(option);
    });
}

// Show participant detail modal
function showParticipantDetail(participantName) {
    const participant = filteredData.find(p => p.name === participantName);
    if (!participant) {
        console.warn('Participant not found:', participantName);
        return;
    }
    
    const modal = document.getElementById('participant-modal');
    const nameSpan = document.getElementById('modal-participant-name');
    const tbody = document.getElementById('modal-events-body');
    
    // Check if all required elements exist
    if (!modal) {
        console.error('Modal element not found: participant-modal');
        return;
    }
    if (!nameSpan) {
        console.error('Name span element not found: modal-participant-name');
        return;
    }
    if (!tbody) {
        console.error('Table body element not found: modal-events-body');
        return;
    }
    
    nameSpan.textContent = participantName;
    tbody.innerHTML = '';
    
    // Check if participant has events
    if (!participant.events || participant.events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666; padding: 20px;">ไม่มีข้อมูลการเข้าร่วมกิจกรรม</td></tr>';
        modal.style.display = 'block';
        return;
    }
    
    // Sort events by date (newest first)
    const sortedEvents = participant.events.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedEvents.forEach(event => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${event.eventName || 'ไม่ระบุ'}</td>
            <td>${formatDate(event.date)}</td>
            <td class="points">${event.points || 0}</td>
            <td>${formatDateTime(event.timestamp)}</td>
        `;
    });
    
    modal.style.display = 'block';
}

// Close participant detail modal
function closeParticipantModal() {
    document.getElementById('participant-modal').style.display = 'none';
}

// Export to CSV
function exportToCSV() {
    const headers = ['ลำดับ', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'แผนก', 'จำนวนครั้ง', 'คะแนนรวม', 'เข้าร่วมครั้งล่าสุด'];
    const csvContent = [
        headers.join(','),
        ...filteredData.map((participant, index) => [
            index + 1,
            `"${participant.name}"`,
            `"${participant.position}"`,
            `"${participant.department}"`,
            participant.attendanceCount,
            participant.totalPoints,
            `"${formatDate(participant.lastAttendance)}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_summary_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Generate charts
function generateCharts() {
    generateAttendanceChart();
    generateDepartmentChart();
}

// Generate attendance trend chart
function generateAttendanceChart() {
    const canvas = document.getElementById('attendance-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Sample chart - you can implement actual chart library here
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(50, 50, 200, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText('Attendance Chart', 100, 130);
    ctx.fillText('(Implement with Chart.js)', 70, 150);
}

// Generate department distribution chart
function generateDepartmentChart() {
    const canvas = document.getElementById('department-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Sample chart
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(50, 50, 200, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText('Department Chart', 90, 130);
    ctx.fillText('(Implement with Chart.js)', 70, 150);
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('th-TH');
}

// Global variable for records per person limit
let recordsPerPersonLimit = 25;

// Update records limit function
function updateRecordsLimit() {
    const selectElement = document.getElementById('records-per-person');
    recordsPerPersonLimit = selectElement.value === 'all' ? null : parseInt(selectElement.value);
    
    // Reprocess data with new limit
    processDataWithLimit();
}

// Process data with record limit per person for better performance
function processDataWithLimit() {
    debugLog('Processing data with limit:', recordsPerPersonLimit);
    
    // Safety check
    if (!Array.isArray(recordsData)) {
        console.error('recordsData is not an array in processDataWithLimit:', recordsData);
        recordsData = [];
    }
    if (!Array.isArray(eventsData)) {
        console.error('eventsData is not an array in processDataWithLimit:', eventsData);
        eventsData = [];
    }
    
    const participantSummary = {};
    
    // Sort records by timestamp (newest first) for each person
    const sortedRecords = [...recordsData].sort((a, b) => {
        const timestampA = new Date(a.Timestamp || 0);
        const timestampB = new Date(b.Timestamp || 0);
        return timestampB - timestampA;
    });
    
    sortedRecords.forEach(record => {
        if (!record.Name || !record.Event) return;
        
        const key = record.Name;
        if (!participantSummary[key]) {
            participantSummary[key] = {
                name: record.Name,
                position: record.Position || '',
                department: record.Department || '',
                attendanceCount: 0,
                totalPoints: 0,
                events: [],
                lastAttendance: null
            };
        }
        
        // Apply limit per person
        if (recordsPerPersonLimit && participantSummary[key].events.length >= recordsPerPersonLimit) {
            return; // Skip this record if limit reached
        }
        
        // Find event details
        const eventDetails = eventsData.find(e => e.Name === record.Event);
        const points = eventDetails ? (parseFloat(eventDetails.Point) || 0) : 0;
        
        // Use event date from events sheet if available, otherwise use record date
        const eventDate = eventDetails ? eventDetails.Date : record.Date;
        
        participantSummary[key].attendanceCount++;
        participantSummary[key].totalPoints += points;
        
        const eventEntry = {
            eventName: record.Event,
            date: eventDate,
            points: points,
            timestamp: record.Timestamp
        };
        
        participantSummary[key].events.push(eventEntry);
        
        // Update last attendance
        if (!participantSummary[key].lastAttendance || 
            new Date(eventDate) > new Date(participantSummary[key].lastAttendance)) {
            participantSummary[key].lastAttendance = eventDate;
        }
    });
    
    // Convert to array and sort by total points (descending)
    filteredData = Object.values(participantSummary)
        .sort((a, b) => b.totalPoints - a.totalPoints);
    
    displaySummaryStatistics(filteredData);
    displayParticipantTableOptimized(filteredData);
    displayDetailedRecords();
}

// Optimized table display with virtual scrolling concept
function displayParticipantTableOptimized(data) {
    const tbody = document.getElementById('summary-tbody');
    if (!tbody) {
        console.error('summary-tbody element not found');
        return;
    }
    
    // Clear existing content
    tbody.innerHTML = '';
    
    // Create document fragment for batch DOM operations
    const fragment = document.createDocumentFragment();
    
    data.forEach((participant, index) => {
        const row = document.createElement('tr');
        
        // Calculate average points per attendance
        const avgPoints = participant.attendanceCount > 0 ? 
            (participant.totalPoints / participant.attendanceCount).toFixed(1) : '0.0';
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${participant.name}</td>
            <td>${participant.position}</td>
            <td>${participant.department}</td>
            <td>${participant.attendanceCount}</td>
            <td class="points">${participant.totalPoints}</td>
            <td>${avgPoints}</td>
            <td>${formatDate(participant.lastAttendance)}</td>
            <td><button class="btn-detail" onclick="showParticipantDetail('${participant.name}')">รายละเอียด</button></td>
        `;
        
        fragment.appendChild(row);
    });
    
    // Batch append to DOM
    tbody.appendChild(fragment);
    
    // Update status message
    const statusMessage = recordsPerPersonLimit ? 
        `แสดงข้อมูล ${data.length} คน (จำกัด ${recordsPerPersonLimit} รายการต่อคน)` :
        `แสดงข้อมูล ${data.length} คน (ทั้งหมด)`;
    
    // Add or update status message
    let statusDiv = document.getElementById('table-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'table-status';
        statusDiv.className = 'table-status';
        document.querySelector('.table-container').insertBefore(statusDiv, document.querySelector('.summary-table'));
    }
    statusDiv.innerHTML = `
        <p style="text-align: center; color: #2E7D32; font-weight: 500; margin: 10px 0; padding: 8px; background: #F1F8E9; border-radius: 6px;">
            📊 ${statusMessage}
        </p>
    `;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Remove any existing debug elements
    const debugDiv = document.getElementById('debug-info');
    if (debugDiv) {
        debugDiv.remove();
    }
    
    debugLog('Summary page loaded, starting data loading...');
    loadAllData();
    
    // Filter event listeners
    document.getElementById('date-from')?.addEventListener('change', applyFilters);
    document.getElementById('date-to')?.addEventListener('change', applyFilters);
    document.getElementById('event-filter')?.addEventListener('change', applyFilters);
    document.getElementById('department-filter')?.addEventListener('change', applyFilters);
    document.getElementById('search-input')?.addEventListener('input', searchParticipants);
    
    // Modal event listeners
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('participant-modal');
        if (event.target === modal) {
            closeParticipantModal();
        }
    });
    
    // Generate charts after data loads
    setTimeout(generateCharts, 2000);
});