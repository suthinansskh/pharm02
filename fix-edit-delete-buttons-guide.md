# แก้ไขปัญหาปุ่ม "แก้ไข" และ "ลบ" แสดง "Invalid Date" และ "undefined"

## 🔍 การวิเคราะห์ปัญหา

จากภาพที่แนบมา พบว่าปุ่ม "แก้ไข" และ "ลบ" แสดงเป็น:
- **"Invalid Date"** แทนที่จะเป็น "แก้ไข"  
- **"undefined"** แทนที่จะเป็น "ลบ"

### สาเหตุของปัญหา:
1. **ข้อมูล Event ID เป็น undefined**: การส่งพารามิเตอร์ `event.id` ไปยังฟังก์ชัน onclick ไม่สำเร็จ
2. **การแปลงข้อมูลจาก Google Sheets ไม่สมบูรณ์**: Field mapping ระหว่าง column names และ object properties ไม่ตรงกัน
3. **การจัดการ Date Objects ผิดพลาด**: การแปลงวันที่ที่ไม่ถูกต้องทำให้เกิด "Invalid Date"

## 🛠️ การแก้ไขที่ได้ทำ

### 1. **ปรับปรุงการแปลงข้อมูลจาก Google Sheets** (`events.js`)

**เดิม:**
```javascript
allEvents = data.map(event => ({
    id: event.ID || event.id || Date.now().toString(),
    name: event.Name || event.name || '',
    // ...
}));
```

**แก้ไขใหม่:**
```javascript
allEvents = data.map((event, index) => {
    // Ensure we have a valid ID
    let eventId = event.ID || event.id;
    if (!eventId || eventId === null || eventId === undefined || eventId === '') {
        eventId = Date.now().toString() + '_' + index;
        console.warn('Generated new ID for event:', eventId);
    }
    
    const processedEvent = {
        id: String(eventId), // Ensure ID is always a string
        name: String(event.Name || event.name || 'ไม่ระบุชื่อ'),
        category: String(event.Catagory || event.Category || event.category || 'ไม่ระบุประเภท'),
        points: parseInt(event.Point || event.Points || event.points) || 0,
        date: String(event.Date || event.date || ''),
        organizer: String(event.Organizer || event.organizer || 'ไม่ระบุผู้จัด'),
        status: String(event.Status || event.status || 'active'),
        description: String(event.Description || event.description || ''),
        createdAt: event['Updated At'] || event.updatedAt || event.createdAt || new Date().toISOString()
    };
    
    console.log('Processed event:', processedEvent);
    return processedEvent;
});
```

### 2. **เพิ่มการป้องกันในฟังก์ชัน `createEventCard`**

**เดิม:**
```javascript
function createEventCard(event) {
    const eventDate = new Date(event.date).toLocaleDateString('th-TH');
    const createdDate = new Date(event.createdAt).toLocaleDateString('th-TH');
    // ...
}
```

**แก้ไขใหม่:**
```javascript
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
    
    // Use safeEvent in HTML generation
    return `
        <div class="event-card" data-event-id="${safeEvent.id}">
            <!-- ... -->
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
```

### 3. **ปรับปรุงการจัดการ Response Format**

**แก้ไขใหม่:**
```javascript
.then(response => {
    console.log('Raw response:', response);
    
    // Handle different response formats
    let data = response;
    if (response && response.success && response.data) {
        data = response.data;
    } else if (response && response.data) {
        data = response.data;
    }
    
    console.log('Final data:', data);
    // ...
});
```

### 4. **เพิ่มการ Debug และ Logging**

เพิ่ม console.log เพื่อติดตามการทำงานของระบบ:
- แสดงข้อมูลดิบที่ได้รับจาก API
- แสดงการแปลงข้อมูลแต่ละขั้นตอน
- แจ้งเตือนเมื่อต้องสร้าง ID ใหม่
- ตรวจสอบ field names และ data types

## 🎯 ผลลัพธ์ที่คาดหวัง

หลังจากการแก้ไข:
- ปุ่ม **"แก้ไข"** จะแสดงข้อความ "แก้ไข" ที่ถูกต้อง
- ปุ่ม **"ลบ"** จะแสดงข้อความ "ลบ" ที่ถูกต้อง  
- ฟังก์ชัน `editEvent(id)` และ `deleteEvent(id)` จะได้รับ ID ที่ถูกต้อง
- วันที่จะแสดงในรูปแบบที่อานง่าย แทนที่จะเป็น "Invalid Date"

## 🔍 การตรวจสอบ

สามารถตรวจสอบการทำงานได้โดย:
1. เปิด Developer Tools (F12)
2. ดูใน Console tab เพื่อดู debug messages
3. ตรวจสอบว่าปุ่มแสดงข้อความที่ถูกต้อง
4. ทดสอบการคลิกปุ่มแก้ไขและลบ
5. ดูใน Network tab เพื่อตรวจสอบ API calls

## 📝 หมายเหตุ

- การแก้ไขนี้รองรับทั้งข้อมูลเก่าและใหม่
- มี fallback values สำหรับข้อมูลที่ไม่สมบูรณ์
- เพิ่มการจัดการ edge cases ต่างๆ
- รองรับการสะกดผิดของ column name (เช่น "Catagory" แทน "Category")