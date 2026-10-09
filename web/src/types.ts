export interface EventItem {
  id: string;
  name: string;
  category: string;
  points: number;
  date: string; // yyyy-MM-dd
  organizer: string;
  status: string;
  description: string;
  round: string; // evaluation round, e.g. "1/2570"; empty on older events
  updatedAt: string;
}

export interface RecordItem {
  timestamp: string;
  name: string;
  position: string;
  department: string;
  date: string;
  event: string;
  eventId: string;
  points: number;
}

export interface RecordsPage {
  total: number;
  items: RecordItem[];
}

export interface UserInfo {
  psCode: string;
  name: string;
  position: string;
  department: string;
}

export interface EventInput {
  id?: string;
  name: string;
  category: string;
  points: number;
  date: string;
  organizer: string;
  status: string;
  description: string;
  round: string;
}

export interface VolunteerItem {
  id: string;
  timestamp: string;
  name: string;
  position: string;
  department: string;
  date: string;
  activity: string;
  detail: string;
  round: string;
}

export interface VolunteersPage {
  total: number;
  items: VolunteerItem[];
}

/** Admin view of a user. National ID and password never leave the server. */
export interface AdminUser {
  psCode: string;
  name: string;
  group: string;
  level: string;
  unit: string;
  status: 'active' | 'inactive';
}

export interface AdminUserInput {
  originalPsCode?: string; // set when editing; the PS Code itself cannot change
  psCode: string;
  name: string;
  group: string;
  level: string;
  unit: string;
  status: 'active' | 'inactive';
}

export interface VolunteerActivity {
  id: string;
  name: string;
  date: string; // yyyy-MM-dd
  round: string;
  status: string;
  description: string;
}

export interface VolunteerActivityInput {
  id?: string;
  name: string;
  date: string;
  round: string;
  status: string;
  description: string;
}
