# แก้ไขปัญหา "ID column not found" ในฟังก์ชัน updateEvent

## 🚨 ปัญหาที่พบ

```javascript
events.js:603  Error updating event: Error: ID column not found
    at events.js:525:28
```

## 🔍 การวิเคราะห์ปัญหา

หลังจากที่แก้ไขฟังก์ชัน `getEvents` ให้ทำความสะอาด headers (trim whitespace) แล้ว แต่ฟังก์ชัน `updateEvent` ยังคงใช้ headers แบบเดิมที่ไม่ได้ทำความสะอาด ทำให้:

1. **getEvents** ส่งข้อมูลที่มี field `"ID"` (ไม่มีช่องว่าง)
2. **updateEvent** มองหา column `"ID "` (มีช่องว่าง) ใน Google Sheets
3. ไม่เจอ column → ส่ง error "ID column not found"

## 🛠️ การแก้ไขใน code.gs

### ก่อนแก้ไข:
```javascript
function updateEvent(eventData) {
  // ...
  var data = sheet.getDataRange().getValues();
  var headers = data[0];  // ใช้ headers ดิบที่มีช่องว่าง
  var idIndex = headers.indexOf('ID');  // หาไม่เจอเพราะใน sheet เป็น "ID "
  
  if (idIndex === -1) {
    return {
      success: false,
      error: "ID column not found"
    };
  }
  
  // ใช้ headers ที่มีช่องว่างในการหา column อื่นๆ
  var nameIndex = headers.indexOf('Name');
  var categoryIndex = headers.indexOf('Catagory');
  // ...
}
```

### หลังแก้ไข:
```javascript
function updateEvent(eventData) {
  // ...
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  console.log('Headers (raw):', headers);
  
  // Clean headers by trimming whitespace
  var cleanHeaders = headers.map(function(header) {
    return String(header || '').trim();
  });
  console.log('Headers (cleaned):', cleanHeaders);
  
  var idIndex = cleanHeaders.indexOf('ID');  // ใช้ clean headers
  
  if (idIndex === -1) {
    return {
      success: false,
      error: "ID column not found. Available columns: " + cleanHeaders.join(', ')
    };
  }
  
  // ใช้ cleanHeaders ในการหา column อื่นๆ
  var nameIndex = cleanHeaders.indexOf('Name');
  var categoryIndex = cleanHeaders.indexOf('Catagory');
  var pointIndex = cleanHeaders.indexOf('Point');
  var dateIndex = cleanHeaders.indexOf('Date');
  var organizerIndex = cleanHeaders.indexOf('Organizer');
  var statusIndex = cleanHeaders.indexOf('Status');
  var descriptionIndex = cleanHeaders.indexOf('Description');
  var updatedAtIndex = cleanHeaders.indexOf('Updated At');
  // ...
}
```

## 🎯 สิ่งที่เปลี่ยนแปลง

### 1. **Header Cleaning:**
- เพิ่มการทำความสะอาด headers ด้วย `.trim()`
- ใช้ `cleanHeaders` แทน `headers` ในการหา column indices

### 2. **Better Error Messages:**
- เพิ่มการแสดง available columns เมื่อไม่เจอ ID column
- เพิ่ม console.log เพื่อ debug headers

### 3. **Consistency:**
- ทำให้ `updateEvent` ใช้วิธีเดียวกันกับ `getEvents`
- รับประกันว่า header names ที่ใช้จะสอดคล้องกัน

## 🔍 วิธีตรวจสอบการแก้ไข

1. **เปิด events.html และทดสอบแก้ไข event:**
   ```
   http://localhost:8000/events.html
   ```

2. **ดู Console Logs:**
   ```javascript
   Headers (raw): ["ID ", "Name", "Catagory ", ...]
   Headers (cleaned): ["ID", "Name", "Catagory", ...]
   ```

3. **ทดสอบการอัปเดต:**
   - คลิกปุ่ม "แก้ไข" บน event card
   - แก้ไขข้อมูล
   - คลิก "อัปเดตกิจกรรม"
   - ควรได้ข้อความ "อัปเดตกิจกรรมเรียบร้อยแล้ว"

## 🚀 ผลลัพธ์ที่คาดหวัง

- ✅ ไม่มี error "ID column not found"
- ✅ การแก้ไข events ทำงานได้ปกติ
- ✅ ข้อมูลที่อัปเดตจะถูกบันทึกใน Google Sheets
- ✅ หน้าเว็บจะโหลดข้อมูลใหม่ที่อัปเดตแล้ว

## 📚 บทเรียนที่ได้

1. **ความสอดคล้องใน Data Processing:** เมื่อทำความสะอาดข้อมูลที่ส่วนหนึ่ง ต้องทำให้ส่วนอื่นๆ สอดคล้องด้วย
2. **การ Debug ที่ดี:** เพิ่ม console.log และ error messages ที่มีประโยชน์
3. **Data Validation:** ตรวจสอบข้อมูลทุกขั้นตอนก่อนใช้งาน