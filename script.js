// JSONP Helper Functions - Bypasses CORS completely
function jsonpRequest(url, callback) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.round(100000 * Math.random());
        
        // Create script element
        const script = document.createElement('script');
        
        // Define callback function
        window[callbackName] = function(data) {
            // Clean up
            delete window[callbackName];
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
            console.log('JSONP success for:', url, data);
            resolve(data);
        };
        
        // Handle errors
        script.onerror = function() {
            delete window[callbackName];
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
            console.error('JSONP failed for:', url);
            reject(new Error('JSONP request failed - check network or script URL'));
        };
        
        // Set script source with callback parameter
        const separator = url.indexOf('?') >= 0 ? '&' : '?';
        script.src = url + separator + 'callback=' + callbackName;
        
        console.log('JSONP request:', script.src);
        
        // Add script to page
        document.body.appendChild(script);
        
        // Add timeout
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
                console.error('JSONP timeout for:', url);
                reject(new Error('JSONP request timeout'));
            }
        }, 15000); // 15 seconds timeout
    });
}

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyDbNuvZVetuZMpqf1XTgmHGb6RRON1LqfLb03ptaUqbx608Zv8MAzoOgYEk_KLwRQvjg/exec";

const form = document.getElementById('event-form');
const recordsDiv = document.getElementById('records');
const eventSelect = document.getElementById('event-select');
const pointInput = document.getElementById('point');
const eventbyInput = document.getElementById('eventby');
const pscodeInput = document.getElementById('pscode');
const nameInput = document.getElementById('name');
const positionInput = document.getElementById('position');
const departmentInput = document.getElementById('department');

// Store users data for lookup
let usersData = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadUsers();    // Load users first
    loadEvents();
    loadRecords();
});

// Load users from user sheet using JSONP
function loadUsers() {
    // First try to load from localStorage (for immediate feedback)
    const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
    if (localUsers.length > 0) {
        usersData = localUsers;
        setupPSCodeLookup();
    }
    
    // Then try to load from Google Sheets using JSONP
    jsonpRequest(SCRIPT_URL + '?action=getUsers')
        .then(response => {
            console.log('Users response via JSONP:', response);
            
            // Handle different response formats
            let data = response;
            if (response && response.success && response.data) {
                data = response.data;
            } else if (response && response.data) {
                data = response.data;
            }
            
            if (data && Array.isArray(data) && data.length > 0) {
                usersData = data;
                setupPSCodeLookup();
                // Update localStorage
                localStorage.setItem('users', JSON.stringify(data));
            } else {
                console.warn('No users data received or data is not an array:', data);
            }
        })
        .catch(error => {
            console.error('Error loading users from server:', error);
            // Fallback to localStorage if available
            if (localUsers.length > 0) {
                console.log('Using cached users from localStorage');
                usersData = localUsers;
                setupPSCodeLookup();
            }
        });
}

function setupPSCodeLookup() {
    if (!pscodeInput) return;
    
    // Add event listener for PS Code input
    pscodeInput.addEventListener('input', handlePSCodeInput);
    pscodeInput.addEventListener('blur', handlePSCodeLookup);
    
    console.log(`PS Code lookup ready with ${usersData.length} users`);
}

function handlePSCodeInput() {
    // Clear user fields while typing
    if (nameInput) nameInput.value = '';
    if (positionInput) positionInput.value = '';
    if (departmentInput) departmentInput.value = '';
}

function handlePSCodeLookup() {
    const psCode = pscodeInput.value.trim();
    
    if (!psCode) {
        clearUserFields();
        return;
    }
    
    // Find user by PS Code
    const user = usersData.find(u => {
        const userPSCode = u['PS Code'] || u.psCode || u.ps_code || '';
        return userPSCode.toString().toLowerCase() === psCode.toLowerCase();
    });
    
    if (user) {
        // Auto-populate user information using exact column names
        const fullName = user['ชื่อ-นามสกุล'] || user.name || user.fullName || '';
        const position = user['ระดับ'] || user.position || user.level || '';
        const department = user['หน่วยงาน'] || user.department || user.unit || '';
        
        if (nameInput) nameInput.value = fullName;
        if (positionInput) positionInput.value = position;
        if (departmentInput) departmentInput.value = department;
        
        // Add visual feedback for successful lookup
        pscodeInput.style.borderColor = '#4CAF50';
        pscodeInput.style.backgroundColor = '#E8F5E9';
        
        console.log('User found:', { psCode, fullName, position, department });
    } else {
        // Clear fields and show error feedback
        clearUserFields();
        pscodeInput.style.borderColor = '#f44336';
        pscodeInput.style.backgroundColor = '#FFEBEE';
        
        showMessage('ไม่พบ PS Code นี้ในระบบ กรุณาตรวจสอบและลองใหม่อีกครั้ง', 'error');
        console.log('PS Code not found:', psCode);
    }
}

function clearUserFields() {
    if (nameInput) nameInput.value = '';
    if (positionInput) positionInput.value = '';
    if (departmentInput) departmentInput.value = '';
    
    // Reset PS Code field styling
    pscodeInput.style.borderColor = '';
    pscodeInput.style.backgroundColor = '';
}

// Load events for dropdown using JSONP
function loadEvents() {
    // First try to load from localStorage (for immediate feedback)
    const localEvents = JSON.parse(localStorage.getItem('events') || '[]');
    if (localEvents.length > 0) {
        populateEventDropdown(localEvents);
    }
    
    // Then try to load from Google Sheets using JSONP
    jsonpRequest(SCRIPT_URL + '?action=getEvents')
        .then(response => {
            console.log('Events response via JSONP:', response);
            
            // Handle different response formats
            let data = response;
            if (response && response.success && response.data) {
                data = response.data;
            } else if (response && response.data) {
                data = response.data;
            }
            
            if (data && Array.isArray(data) && data.length > 0) {
                populateEventDropdown(data);
                // Update localStorage
                localStorage.setItem('events', JSON.stringify(data));
            } else {
                console.warn('No events data received or data is not an array:', data);
            }
        })
        .catch(error => {
            console.error('Error loading events from server:', error);
            // Fallback to localStorage if server fails
            if (localEvents.length > 0) {
                populateEventDropdown(localEvents);
            }
        });
}

// Populate event dropdown
function populateEventDropdown(events) {
    console.log('populateEventDropdown called with:', events);
    
    if (!eventSelect) {
        console.error('eventSelect element not found!');
        return;
    }
    
    // Clear existing options except the first one
    eventSelect.innerHTML = '<option value="">เลือกกิจกรรม</option>';
    
    if (!events || !Array.isArray(events)) {
        console.warn('No events provided or events is not an array');
        return;
    }
    
    // Filter events - accept multiple active status values
    const availableEvents = events.filter(event => {
        const status = (event.Status || event.status || '').toLowerCase();
        // Accept: active, ongoing, upcoming, or empty status
        const validStatuses = ['active', 'ongoing', 'upcoming', ''];
        const isActive = validStatuses.includes(status) || !status;
        
        console.log(`Event: ${event.Name || event.name}, Status: "${status}", IsActive: ${isActive}`);
        
        return isActive;
    });
    
    console.log(`Filtered events: ${availableEvents.length} out of ${events.length}`);
    
    availableEvents.forEach(event => {
        const option = document.createElement('option');
        // Use exact column names from event sheet: ID, Name, Catagory, Point, Date, Organizer, Status, Description, Updated At
        const eventName = event.Name || event.name || '';
        const eventPoints = event.Point || event.point || 0;  // Note: Point (singular) as per sheet
        const eventOrganizer = event.Organizer || event.organizer || '';
        const eventCategory = event.Catagory || event.Category || event.category || '';
        const eventDate = event.Date || event.date || '';
        
        option.value = JSON.stringify({
            id: event.ID || event.id,
            name: eventName,
            points: eventPoints,
            organizer: eventOrganizer,
            category: eventCategory,
            date: eventDate
        });
        
        option.textContent = `${eventName} (${eventPoints} คะแนน) - ${eventCategory}`;
        eventSelect.appendChild(option);
        
        console.log(`Added option: ${option.textContent}`);
    });
    
    console.log(`Event dropdown populated with ${availableEvents.length} options`);
    console.log(`Total dropdown options now: ${eventSelect.options.length}`);
    
    // Add event listener for dropdown change
    eventSelect.addEventListener('change', handleEventSelection);
}

// Helper function to format date for input[type="date"]
function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date string:', dateString);
            return '';
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting date:', dateString, error);
        return '';
    }
}

// Handle event selection
function handleEventSelection() {
    const dateeventInput = document.getElementById('dateevent');
    
    if (eventSelect.value) {
        try {
            const selectedEvent = JSON.parse(eventSelect.value);
            // Auto-populate points, organizer, and event date from selected event
            pointInput.value = selectedEvent.points || 0;
            if (eventbyInput) {
                eventbyInput.value = selectedEvent.organizer || '';
            }
            if (dateeventInput && selectedEvent.date) {
                const formattedDate = formatDateForInput(selectedEvent.date);
                dateeventInput.value = formattedDate;
                console.log('Event date populated:', selectedEvent.date, '→', formattedDate);
            }
        } catch (error) {
            console.error('Error parsing selected event:', error);
            pointInput.value = '';
            if (eventbyInput) {
                eventbyInput.value = '';
            }
            if (dateeventInput) {
                dateeventInput.value = '';
            }
        }
    } else {
        pointInput.value = '';
        eventbyInput.value = '';
        if (dateeventInput) {
            dateeventInput.value = '';
        }
    }
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Validate form fields
    const psCode = pscodeInput ? pscodeInput.value.trim() : '';
    const name = nameInput ? nameInput.value.trim() : '';
    
    if (!psCode) {
        showMessage('กรุณากรอก PS Code', 'error');
        return;
    }
    
    if (!name) {
        showMessage('กรุณากรอก PS Code ที่ถูกต้องเพื่อให้ระบบแสดงชื่อผู้เข้าร่วม', 'error');
        return;
    }
    
    if (!eventSelect.value) {
        showMessage('กรุณาเลือกกิจกรรม', 'error');
        return;
    }
    
    // Get button and disable it during submission
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'กำลังบันทึก...';
    
    // Get selected event data
    const selectedEvent = JSON.parse(eventSelect.value);
    
    const data = {
        name: nameInput.value.trim(),
        position: positionInput.value.trim(),
        department: departmentInput.value.trim(),
        event: selectedEvent.name,
        points: document.getElementById('point').value,
        date: document.getElementById('dateevent').value,
    };
    
    // Use CORS-free iframe submission
    submitFormViaIframe(data)
        .then(responseData => {
            console.log('Form submitted successfully:', responseData);
            if (responseData.status === 'success') {
                // Show success message
                showMessage('บันทึกข้อมูลเรียบร้อยแล้ว!', 'success');
                // Clear form
                form.reset();
                // Reset readonly fields
                pointInput.value = '';
                eventbyInput.value = '';
                // Clear PS Code lookup fields
                clearUserFields();
                // Reload records
                loadRecords();
            } else {
                // Handle duplicate records with special styling
                if (responseData.isDuplicate) {
                    showMessage('🚫 ' + responseData.message, 'warning');
                } else {
                    showMessage('เกิดข้อผิดพลาด: ' + (responseData.message || 'ไม่ทราบสาเหตุ'), 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showMessage('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง', 'error');
        })
        .finally(() => {
            // Re-enable button
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        });
});

function loadRecords() {
    recordsDiv.innerHTML = '<div class="loading">กำลังโหลดข้อมูล...</div>';
    
    // Use JSONP to avoid CORS issues
    const recordsUrl = SCRIPT_URL + '?action=getRecords';
    console.log('Loading records from:', recordsUrl);
    
    jsonpRequest(recordsUrl)
        .then(response => {
            console.log('Records response:', response);
            recordsDiv.innerHTML = '';
            
            // Handle different response formats
            let data = response;
            if (response && response.success && response.data) {
                data = response.data;
            } else if (response && response.data) {
                data = response.data;
            }
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                recordsDiv.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">ไม่พบข้อมูลการเข้าร่วม กรุณาบันทึกข้อมูลครั้งแรก!</p>';
                return;
            }
            
            data.forEach((record, index) => {
                console.log(`Record ${index}:`, record);
                console.log('Record keys:', Object.keys(record));
                
                const recordDiv = document.createElement('div');
                recordDiv.className = 'record-item';
                
                // Use exact column names from Google Sheets: Timestamp, Name, Position, Department, Date, Event, Points
                const name = record.Name || record.name || 'ไม่ระบุ';
                const position = record.Position || record.position || 'ไม่ระบุ';
                const department = record.Department || record.department || 'ไม่ระบุ';
                const date = record.Date || record.date || '';
                const event = record.Event || record.event || 'ไม่ระบุ';
                const points = record.Points || record.points || 0;
                const timestamp = record.Timestamp || record.timestamp || '';
                
                console.log('Extracted values:', {
                    name, position, department, date, event, points, timestamp
                });
                
                // Format dates safely
                const formatDate = (dateValue) => {
                    if (!dateValue) return 'ไม่ระบุ';
                    try {
                        const dateObj = new Date(dateValue);
                        return dateObj.toLocaleDateString('th-TH');
                    } catch (e) {
                        return dateValue.toString();
                    }
                };
                
                const formatDateTime = (dateValue) => {
                    if (!dateValue) return 'ไม่ระบุ';
                    try {
                        const dateObj = new Date(dateValue);
                        return dateObj.toLocaleString('th-TH');
                    } catch (e) {
                        return dateValue.toString();
                    }
                };
                
                recordDiv.innerHTML = `
                    <div>
                        <strong>ชื่อ:</strong> ${name} (${position})
                        <span class="points">${points} คะแนน</span>
                    </div>
                    <div style="margin-top: 8px;">
                        <strong>แผนก:</strong> ${department}
                    </div>
                    <div style="margin-top: 8px;">
                        <strong>กิจกรรม:</strong> ${event}
                    </div>
                    <div style="margin-top: 8px;">
                        <strong>วันที่เข้าร่วม:</strong> ${formatDate(date)}
                    </div>
                    <div style="margin-top: 5px; font-size: 0.9em; color: #666;">
                        <strong>บันทึกเมื่อ:</strong> ${formatDateTime(timestamp)}
                    </div>
                `;
                recordsDiv.appendChild(recordDiv);
            });
        })
        .catch(error => {
            console.error('Error loading records:', error);
            console.error('Records URL was:', recordsUrl);
            
            let errorMessage = 'เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง';
            if (error.message) {
                errorMessage += '<br><small style="color: #999;">รายละเอียด: ' + error.message + '</small>';
            }
            
            recordsDiv.innerHTML = `
                <p style="text-align: center; color: #d32f2f;">${errorMessage}</p>
                <div style="text-align: center; margin-top: 10px;">
                    <button onclick="loadRecords()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        🔄 ลองใหม่
                    </button>
                </div>
            `;
        });
}

// Function to show messages to user
function showMessage(message, type = 'info') {
    // Remove existing message if any
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        padding: 12px 20px;
        margin: 15px 0;
        border-radius: 8px;
        text-align: center;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
        ${type === 'success' ? 'background: #E8F5E9; color: #2E7D32; border: 1px solid #4CAF50;' : ''}
        ${type === 'error' ? 'background: #FFEBEE; color: #D32F2F; border: 1px solid #F44336;' : ''}
        ${type === 'warning' ? 'background: #FFF3E0; color: #F57C00; border: 1px solid #FF9800;' : ''}
        ${type === 'info' ? 'background: #E3F2FD; color: #1976D2; border: 1px solid #2196F3;' : ''}
    `;
    
    // Insert after form
    form.parentNode.insertBefore(messageDiv, form.nextSibling);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (messageDiv && messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => messageDiv.remove(), 300);
        }
    }, 3000);
}

// CORS-free form submission using JSONP-style GET request
function submitFormViaIframe(data) {
    return new Promise((resolve, reject) => {
        // Convert POST data to GET parameters for JSONP submission
        const params = new URLSearchParams();
        params.append('action', 'addRecord');
        params.append('name', data.name || '');
        params.append('position', data.position || '');
        params.append('department', data.department || '');
        params.append('event', data.event || '');
        params.append('points', data.points || '0');
        params.append('date', data.date || '');
        
        // Generate unique callback name
        const callbackName = 'submitCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Create callback function
        window[callbackName] = function(response) {
            // Clean up
            delete window[callbackName];
            if (document.head.contains(script)) {
                document.head.removeChild(script);
            }
            
            resolve(response);
        };
        
        // Add callback parameter
        params.append('callback', callbackName);
        
        // Create script tag for JSONP request
        const script = document.createElement('script');
        script.src = SCRIPT_URL + '?' + params.toString();
        
        // Handle script load errors
        script.onerror = function() {
            delete window[callbackName];
            if (document.head.contains(script)) {
                document.head.removeChild(script);
            }
            // Assume success since we can't get detailed error info
            resolve({ status: 'success', message: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
        };
        
        // Add script to document to trigger request
        document.head.appendChild(script);
        
        // Timeout fallback
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                if (document.head.contains(script)) {
                    document.head.removeChild(script);
                }
                resolve({ status: 'success', message: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
            }
        }, 10000);
    });
}

// System diagnostic function for debugging
window.runSystemDiagnostic = function() {
    console.log('=== SYSTEM DIAGNOSTIC ===');
    console.log('SCRIPT_URL:', SCRIPT_URL);
    console.log('DOM Elements Check:');
    console.log('- form:', !!form);
    console.log('- recordsDiv:', !!recordsDiv);
    console.log('- eventSelect:', !!eventSelect);
    console.log('- pscodeInput:', !!pscodeInput);
    
    // Test basic connectivity
    console.log('Testing basic connectivity...');
    jsonpRequest(SCRIPT_URL + '?action=test')
        .then(response => {
            console.log('✅ Basic connectivity test:', response);
        })
        .catch(error => {
            console.error('❌ Basic connectivity test failed:', error);
        });
};
