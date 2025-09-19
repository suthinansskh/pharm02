// Events page JavaScript functionality
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyDbNuvZVetuZMpqf1XTgmHGb6RRON1LqfLb03ptaUqbx608Zv8MAzoOgYEk_KLwRQvjg/exec";

// JSONP Helper Function - เหมือนกับ script.js
function jsonpRequest(url) {
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

// DOM Elements
const eventForm = document.getElementById('event-creation-form');
const eventsGrid = document.getElementById('events-list');
const statusFilter = document.getElementById('status-filter');
const categoryFilter = document.getElementById('category-filter');
const searchFilter = document.getElementById('search-filter');
const clearFiltersBtn = document.getElementById('clear-filters');

// Stats elements
const totalEventsEl = document.getElementById('total-events');
const upcomingEventsEl = document.getElementById('upcoming-events');
const ongoingEventsEl = document.getElementById('ongoing-events');
const completedEventsEl = document.getElementById('completed-events');

// Global variables
let allEvents = [];
let filteredEvents = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadEvents();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    eventForm.addEventListener('submit', handleEventSubmission);
    statusFilter.addEventListener('change', applyFilters);
    categoryFilter.addEventListener('change', applyFilters);
    searchFilter.addEventListener('input', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);
}

// Handle event form submission (both create and update)
function handleEventSubmission(e) {
    e.preventDefault();
    
    const submitButton = eventForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    
    const eventData = {
        name: document.getElementById('event-name').value,
        category: document.getElementById('event-category').value,
        points: parseInt(document.getElementById('event-points').value),
        date: document.getElementById('event-date').value,
        organizer: document.getElementById('event-organizer').value,
        status: document.getElementById('event-status').value,
        description: document.getElementById('event-description').value
    };
    
    // Check if we're in edit mode
    if (eventForm.dataset.editingId) {
        // Update existing event
        submitButton.textContent = 'กำลังอัปเดต...';
        const eventId = eventForm.dataset.editingId;
        
        console.log('Updating event with ID:', eventId, 'Data:', eventData);
        updateEvent(eventId, eventData)
            .then((response) => {
                console.log('Update successful:', response);
                showMessage('อัปเดตกิจกรรมเรียบร้อยแล้ว!', 'success');
                eventForm.reset();
                delete eventForm.dataset.editingId;
                submitButton.textContent = 'สร้างกิจกรรม';
                
                // Remove cancel button
                const cancelButton = document.getElementById('cancel-edit-btn');
                if (cancelButton) {
                    cancelButton.remove();
                }
                
                loadEvents();
            })
            .catch(error => {
                console.error('Error updating event:', error);
                showMessage('เกิดข้อผิดพลาดในการอัปเดตกิจกรรม กรุณาลองใหม่อีกครั้ง', 'error');
            })
            .finally(() => {
                submitButton.disabled = false;
                if (!eventForm.dataset.editingId) {
                    submitButton.textContent = 'สร้างกิจกรรม';
                } else {
                    submitButton.textContent = 'อัปเดตกิจกรรม';
                }
            });
    } else {
        // Create new event
        submitButton.textContent = 'กำลังสร้าง...';
        eventData.type = 'event';
        eventData.createdAt = new Date().toISOString();
        
        createEvent(eventData)
            .then(() => {
                showMessage('สร้างกิจกรรมเรียบร้อยแล้ว!', 'success');
                eventForm.reset();
                loadEvents();
            })
            .catch(error => {
                console.error('Error creating event:', error);
                showMessage('เกิดข้อผิดพลาดในการสร้างกิจกรรม กรุณาลองใหม่อีกครั้ง', 'error');
            })
            .finally(() => {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            });
    }
}

// Create event using JSONP to Google Apps Script
function createEvent(eventData) {
    return new Promise((resolve, reject) => {
        // Convert to URL parameters for JSONP submission
        const params = new URLSearchParams();
        params.append('action', 'addEvent');
        params.append('name', eventData.name || '');
        params.append('category', eventData.category || eventData.catagory || ''); // Handle both spellings
        params.append('points', eventData.points || '0');
        params.append('date', eventData.date || '');
        params.append('organizer', eventData.organizer || '');
        params.append('status', eventData.status || 'active');
        params.append('description', eventData.description || '');
        
        const url = SCRIPT_URL + '?' + params.toString();
        
        console.log('Creating event with params:', eventData);
        
        // Use JSONP to submit event
        jsonpRequest(url)
            .then(response => {
                console.log('Event creation response:', response);
                if (response.status === 'success') {
                    // Also store in localStorage for immediate feedback
                    try {
                        let events = JSON.parse(localStorage.getItem('events') || '[]');
                        eventData.id = response.id || Date.now().toString();
                        events.push(eventData);
                        localStorage.setItem('events', JSON.stringify(events));
                    } catch (localError) {
                        console.warn('Failed to store in localStorage:', localError);
                    }
                    resolve(response);
                } else {
                    reject(new Error(response.message || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Event creation failed:', error);
                reject(error);
            });
    });
}

// Load and display events from Google Sheets
function loadEvents() {
    // First try to load from localStorage (for immediate feedback)
    const localEvents = JSON.parse(localStorage.getItem('events') || '[]');
    if (localEvents.length > 0) {
        allEvents = localEvents;
        updateCategoryFilter();
        applyFilters();
        updateStats();
    }
    
    // Then try to load from Google Sheets using JSONP
    jsonpRequest(SCRIPT_URL + '?action=getEvents')
        .then(response => {
            console.log('Raw response:', response);
            console.log('Response type:', typeof response);
            
            // Handle different response formats
            let data = response;
            if (response && response.success && response.data) {
                data = response.data;
                console.log('Extracted data from response.data:', data);
            } else if (response && response.data) {
                data = response.data;
                console.log('Extracted data from response.data (no success flag):', data);
            }
            
            console.log('Final data:', data);
            console.log('Data type:', typeof data);
            console.log('Is array:', Array.isArray(data));
            
            if (data && data.length > 0) {
                console.log('First event sample:', data[0]);
                console.log('First event keys:', Object.keys(data[0] || {}));
            }
            
            if (data && Array.isArray(data) && data.length > 0) {
                // Convert Google Sheets data to match our format
                allEvents = data.map((event, index) => {
                    console.log('Processing event:', event); // Debug log
                    console.log('Event keys:', Object.keys(event)); // Debug available keys
                    
                    // Handle field names with spaces (trim all keys)
                    const cleanEvent = {};
                    Object.keys(event).forEach(key => {
                        const cleanKey = key.trim();
                        cleanEvent[cleanKey] = event[key];
                    });
                    
                    console.log('Cleaned event:', cleanEvent); // Debug cleaned event
                    
                    // Ensure we have a valid ID (try multiple variations)
                    let eventId = cleanEvent.ID || cleanEvent.id || event.ID || event['ID '] || event.id;
                    if (!eventId || eventId === null || eventId === undefined || eventId === '') {
                        eventId = Date.now().toString() + '_' + index;
                        console.warn('Generated new ID for event:', eventId);
                    } else {
                        console.log('Found existing ID:', eventId);
                    }
                    
                    const processedEvent = {
                        id: String(eventId), // Ensure ID is always a string
                        name: String(cleanEvent.Name || cleanEvent.name || event.Name || event.name || 'ไม่ระบุชื่อ'),
                        category: String(cleanEvent.Catagory || cleanEvent.Category || cleanEvent.category || event.Catagory || event.Category || event.category || 'ไม่ระบุประเภท'), // Handle spelling variations
                        points: parseInt(cleanEvent.Point || cleanEvent.Points || cleanEvent.points || event.Point || event.Points || event.points) || 0,
                        date: String(cleanEvent.Date || cleanEvent.date || event.Date || event.date || ''),
                        organizer: String(cleanEvent.Organizer || cleanEvent.organizer || event.Organizer || event.organizer || 'ไม่ระบุผู้จัด'),
                        status: String(cleanEvent.Status || cleanEvent.status || event.Status || event.status || 'active'),
                        description: String(cleanEvent.Description || cleanEvent.description || event.Description || event.description || ''),
                        createdAt: cleanEvent['Updated At'] || cleanEvent.updatedAt || cleanEvent.createdAt || event['Updated At'] || event.updatedAt || event.createdAt || new Date().toISOString()
                    };
                    
                    console.log('Processed event:', processedEvent); // Debug log
                    return processedEvent;
                });
                
                // Update localStorage with server data
                localStorage.setItem('events', JSON.stringify(allEvents));
                
                updateCategoryFilter();
                applyFilters();
                updateStats();
                
                console.log('Events updated from server:', allEvents.length, 'events');
            } else if (localEvents.length === 0) {
                // No events from server and no local events
                allEvents = [];
                updateCategoryFilter();
                applyFilters();
                updateStats();
                console.log('No events found');
            }
        })
        .catch(error => {
            console.error('Error loading events from server:', error);
            // Fallback to localStorage if available
            if (localEvents.length > 0) {
                console.log('Using cached events from localStorage');
                allEvents = localEvents;
                updateCategoryFilter();
                applyFilters();
                updateStats();
            } else {
                showMessage('ไม่สามารถโหลดกิจกรรมได้ กรุณาลองใหม่อีกครั้ง', 'error');
            }
        });
}

// Update category filter options
function updateCategoryFilter() {
    const categories = [...new Set(allEvents.map(event => event.category))];
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// Apply filters
function applyFilters() {
    const statusFilterValue = statusFilter.value;
    const categoryFilterValue = categoryFilter.value;
    const searchValue = searchFilter.value.toLowerCase();
    
    filteredEvents = allEvents.filter(event => {
        const matchesStatus = !statusFilterValue || event.status === statusFilterValue;
        const matchesCategory = !categoryFilterValue || event.category === categoryFilterValue;
        const matchesSearch = !searchValue || 
            event.name.toLowerCase().includes(searchValue) ||
            event.description.toLowerCase().includes(searchValue) ||
            event.organizer.toLowerCase().includes(searchValue);
        
        return matchesStatus && matchesCategory && matchesSearch;
    });
    
    displayEvents(filteredEvents);
}

// Clear all filters
function clearFilters() {
    statusFilter.value = '';
    categoryFilter.value = '';
    searchFilter.value = '';
    applyFilters();
}

// Display events in the grid
function displayEvents(events) {
    if (events.length === 0) {
        eventsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <h3>ไม่พบกิจกรรม</h3>
                <p>ไม่มีกิจกรรมที่ตรงกับตัวกรองที่เลือก หรือยังไม่มีการสร้างกิจกรรม</p>
            </div>
        `;
        return;
    }
    
    eventsGrid.innerHTML = events.map(event => createEventCard(event)).join('');
}

// Create event card HTML
function createEventCard(event) {
    // Ensure event has required properties with safe defaults
    const safeEvent = {
        id: event.id || 'unknown',
        name: event.name || 'ไม่ระบุชื่อ',
        category: event.category || 'ไม่ระบุประเภท',
        points: event.points || 0,
        date: event.date || '',
        organizer: event.organizer || 'ไม่ระบุผู้จัด',
        status: event.status || 'active',
        description: event.description || '',
        createdAt: event.createdAt || new Date().toISOString()
    };
    
    // Safe date formatting
    let eventDate = 'ไม่ระบุ';
    let createdDate = 'ไม่ระบุ';
    
    try {
        if (safeEvent.date) {
            eventDate = new Date(safeEvent.date).toLocaleDateString('th-TH');
            if (eventDate === 'Invalid Date') {
                eventDate = safeEvent.date; // Use original string if can't parse
            }
        }
    } catch (e) {
        eventDate = safeEvent.date || 'ไม่ระบุ';
    }
    
    try {
        if (safeEvent.createdAt) {
            createdDate = new Date(safeEvent.createdAt).toLocaleDateString('th-TH');
            if (createdDate === 'Invalid Date') {
                createdDate = safeEvent.createdAt; // Use original string if can't parse
            }
        }
    } catch (e) {
        createdDate = safeEvent.createdAt || 'ไม่ระบุ';
    }
    
    // Thai status mapping
    const statusMapping = {
        'upcoming': 'กำลังจะมาถึง',
        'ongoing': 'กำลังดำเนินการ',
        'completed': 'เสร็จสิ้นแล้ว',
        'cancelled': 'ยกเลิก'
    };
    
    return `
        <div class="event-card" data-event-id="${safeEvent.id}">
            <div class="event-header">
                <h3 class="event-title">${safeEvent.name}</h3>
                <span class="event-status status-${safeEvent.status}">${statusMapping[safeEvent.status] || safeEvent.status}</span>
            </div>
            
            <div class="event-details">
                <div class="event-detail">
                    <strong>ประเภท:</strong>
                    <span>${safeEvent.category}</span>
                </div>
                <div class="event-detail">
                    <strong>คะแนน:</strong>
                    <span class="event-points">${safeEvent.points} คะแนน</span>
                </div>
                <div class="event-detail">
                    <strong>วันที่:</strong>
                    <span>${eventDate}</span>
                </div>
                <div class="event-detail">
                    <strong>ผู้จัด:</strong>
                    <span>${safeEvent.organizer}</span>
                </div>
                <div class="event-detail">
                    <strong>สร้างเมื่อ:</strong>
                    <span>${createdDate}</span>
                </div>
            </div>
            
            ${safeEvent.description ? `
                <div class="event-description">
                    ${safeEvent.description}
                </div>
            ` : ''}
            
            <div class="event-actions">
                <button class="event-action-btn edit-btn" onclick="editEvent('${safeEvent.id}')">
                    แก้ไข
                </button>
                <button class="event-action-btn delete-btn" onclick="deleteEvent('${safeEvent.id}')">
                    ลบ
                </button>
            </div>
        </div>
    `;
}

// Update statistics
function updateStats() {
    const stats = allEvents.reduce((acc, event) => {
        acc.total++;
        acc[event.status] = (acc[event.status] || 0) + 1;
        return acc;
    }, { total: 0, upcoming: 0, ongoing: 0, completed: 0, cancelled: 0 });
    
    totalEventsEl.textContent = stats.total;
    upcomingEventsEl.textContent = stats.upcoming;
    ongoingEventsEl.textContent = stats.ongoing;
    completedEventsEl.textContent = stats.completed;
}

// Edit event
function editEvent(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) return;
    
    // Populate form with event data
    document.getElementById('event-name').value = event.name;
    document.getElementById('event-category').value = event.category;
    document.getElementById('event-points').value = event.points;
    document.getElementById('event-date').value = event.date;
    document.getElementById('event-organizer').value = event.organizer;
    document.getElementById('event-status').value = event.status;
    document.getElementById('event-description').value = event.description || '';
    
    // Change form to edit mode
    const submitButton = eventForm.querySelector('button[type="submit"]');
    submitButton.textContent = 'อัปเดตกิจกรรม';
    eventForm.dataset.editingId = eventId;
    
    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    
    showMessage('โหลดข้อมูลกิจกรรมสำหรับแก้ไขแล้ว กรุณาแก้ไขข้อมูลและคลิก "อัปเดตกิจกรรม"', 'info');
    
    // Add cancel button if not exists
    addCancelEditButton();
}

// Add cancel edit button
function addCancelEditButton() {
    // Check if cancel button already exists
    if (document.getElementById('cancel-edit-btn')) return;
    
    const submitButton = eventForm.querySelector('button[type="submit"]');
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.id = 'cancel-edit-btn';
    cancelButton.className = 'cancel-btn';
    cancelButton.textContent = 'ยกเลิกการแก้ไข';
    cancelButton.style.marginLeft = '10px';
    cancelButton.style.background = '#666';
    cancelButton.style.color = 'white';
    cancelButton.style.border = 'none';
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.borderRadius = '5px';
    cancelButton.style.cursor = 'pointer';
    
    cancelButton.addEventListener('click', cancelEdit);
    submitButton.parentNode.insertBefore(cancelButton, submitButton.nextSibling);
}

// Cancel edit mode
function cancelEdit() {
    eventForm.reset();
    delete eventForm.dataset.editingId;
    const submitButton = eventForm.querySelector('button[type="submit"]');
    submitButton.textContent = 'สร้างกิจกรรม';
    
    // Remove cancel button
    const cancelButton = document.getElementById('cancel-edit-btn');
    if (cancelButton) {
        cancelButton.remove();
    }
    
    showMessage('ยกเลิกการแก้ไขแล้ว', 'info');
}

// Delete event
function deleteEvent(eventId) {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบกิจกรรมนี้? การกระทำนี้ไม่สามารถยกเลิกได้')) {
        return;
    }
    
    try {
        allEvents = allEvents.filter(event => event.id !== eventId);
        localStorage.setItem('events', JSON.stringify(allEvents));
        
        showMessage('ลบกิจกรรมเรียบร้อยแล้ว', 'success');
        loadEvents();
    } catch (error) {
        console.error('Error deleting event:', error);
        showMessage('เกิดข้อผิดพลาดในการลบกิจกรรม', 'error');
    }
}

// Update existing event
function updateEvent(eventId, eventData) {
    return new Promise((resolve, reject) => {
        const updateData = {
            id: eventId,
            name: eventData.name,
            category: eventData.category,
            point: eventData.points, // Backend expects 'point' not 'points'
            points: eventData.points, // Send both to be safe
            date: eventData.date,
            organizer: eventData.organizer,
            status: eventData.status,
            description: eventData.description
        };
        
        const updateUrl = SCRIPT_URL + '?' + Object.keys(updateData).map(key => 
            `${encodeURIComponent(key)}=${encodeURIComponent(updateData[key] || '')}`
        ).join('&') + '&action=updateEvent';
        
        console.log('Updating event via URL:', updateUrl);
        
        jsonpRequest(updateUrl)
            .then(response => {
                console.log('Update event response:', response);
                if (response && response.success) {
                    // Update local data
                    const eventIndex = allEvents.findIndex(e => e.id === eventId);
                    if (eventIndex !== -1) {
                        allEvents[eventIndex] = { 
                            ...allEvents[eventIndex], 
                            ...eventData,
                            points: eventData.points // Make sure points field is correct
                        };
                    }
                    resolve(response);
                } else {
                    reject(new Error(response?.error || 'Failed to update event'));
                }
            })
            .catch(error => {
                console.error('JSONP request failed:', error);
                reject(error);
            });
    });
}

// Show message function (reused from main app)
function showMessage(message, type = 'info') {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
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
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        max-width: 400px;
        ${type === 'success' ? 'background: #E8F5E9; color: #2E7D32; border: 1px solid #4CAF50;' : ''}
        ${type === 'error' ? 'background: #FFEBEE; color: #D32F2F; border: 1px solid #F44336;' : ''}
        ${type === 'info' ? 'background: #E3F2FD; color: #1976D2; border: 1px solid #2196F3;' : ''}
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv && messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => messageDiv.remove(), 300);
        }
    }, 3000);
}

// Form editing vs creating is now handled in the main handleEventSubmission function

// Sample data for demonstration (can be removed in production)
function addSampleEvents() {
    const sampleEvents = [
        {
            id: '1',
            type: 'event',
            name: 'การอบรมเภสัชกรรมคลินิก',
            category: 'อบรม',
            points: 50,
            date: '2025-09-25',
            organizer: 'กลุ่มงานเภสัชกรรม',
            status: 'upcoming',
            description: 'การอบรมเรื่องเภสัชกรรมคลินิกสำหรับเภสัชกรโรงพยาบาล',
            createdAt: new Date().toISOString()
        },
        {
            id: '2',
            type: 'event',
            name: 'การประชุมประจำเดือน',
            category: 'ประชุม',
            points: 30,
            date: '2025-09-20',
            organizer: 'หัวหน้างานเภสัชกรรม',
            status: 'ongoing',
            description: 'การประชุมประจำเดือนของกลุ่มงานเภสัชกรรม',
            createdAt: new Date().toISOString()
        }
    ];
    
    // Only add if no events exist
    if (allEvents.length === 0) {
        localStorage.setItem('events', JSON.stringify(sampleEvents));
        loadEvents();
    }
}

// Add sample events on first load
if (!localStorage.getItem('events')) {
    addSampleEvents();
}