# ระบบบันทึกการประชุมกลุ่มงานเภสัชกรรม (v2)

- `web/` — หน้าเว็บ Vite + React + TypeScript (deploy ขึ้น GitHub Pages)
- `backend/Code.gs` — API บน Google Apps Script ใช้ Google Sheet เดิม (`record`, `event`, `user`)
- ไฟล์ HTML/JS/`code.gs` ที่ root คือระบบเก่า ลบได้หลังสลับใช้ระบบใหม่เรียบร้อย

## ติดตั้ง backend ใหม่ (ทำก่อน deploy หน้าเว็บ)

1. เปิด Apps Script API ที่ https://script.google.com/home/usersettings แล้วรัน (ใน `backend/`):
   `npm install` → `npx clasp login` → `npm run create` → `npm run push`
   (ถ้ามีโปรเจกต์อยู่แล้ว ใช้ `npx clasp clone <scriptId>` แทน `create`)
2. `npm run open` เปิดโปรเจกต์ → Project Settings → Script properties → เพิ่ม `ADMIN_PASSWORD` (ตั้งรหัสใหม่ อย่าใช้รหัสเก่า)
3. `npm run deploy` (หรือ Deploy → New deployment → Web app ในหน้าเว็บ) → คัดลอก URL `/exec`
   ครั้งต่อไปที่แก้โค้ด ให้ใช้ `npx clasp deploy -i <deploymentId>` เพื่อคง URL เดิม
4. ใส่ URL ข้างต้นใน `web/.env.production` (`VITE_API_URL=...`)
5. Push ขึ้น `main` เพื่อ deploy หน้าเว็บ
6. ตรวจว่าใช้งานได้ครบ แล้วปิด deployment ของสคริปต์เก่า (Deploy → Manage deployments → Archive) เพื่อหยุดการเปิดเผยข้อมูลผู้ใช้

โค้ดใหม่จะเพิ่มคอลัมน์ `PSCode` และ `EventID` ท้ายชีต `record` อัตโนมัติเมื่อมีการบันทึกครั้งแรก ไม่แก้หรือลบข้อมูลเดิม

## พัฒนาในเครื่อง

```
cd web
cp .env.example .env.local   # ใส่ VITE_API_URL
npm install
npm run dev
```

## สิ่งที่เปลี่ยนจากระบบเก่า

| ด้าน | เดิม | ใหม่ |
|---|---|---|
| ข้อมูลผู้ใช้ | `getUsers` ส่งเลขบัตร/รหัสผ่านให้ทุกคน | `lookup` ส่งเฉพาะชื่อ/ตำแหน่ง/หน่วยงาน |
| การบันทึก | client ส่งชื่อ/นาทีประชุม/วันที่เอง | ส่งแค่ PS Code + eventId, server ดึงข้อมูลจากชีต |
| สร้าง/แก้/ลบกิจกรรม, ลบข้อมูลซ้ำ | เปิดสาธารณะ / รหัสในโค้ด | ต้องล็อกอินผู้ดูแล (token 6 ชม., ล็อก 5 นาทีหลังผิด 5 ครั้ง) |
| การเรียก API | JSONP ผ่าน GET | `fetch` + JSON, error จริงแสดงให้ผู้ใช้เห็น |
| ความเร็ว | อ่านทั้งชีตทุกครั้ง | แคชฝั่ง server 2 นาที, หา user ด้วย TextFinder, แคชฝั่ง client (stale-while-revalidate), แยก chunk ต่อหน้า |
| การเขียนพร้อมกัน | ไม่มี lock | `LockService` |
