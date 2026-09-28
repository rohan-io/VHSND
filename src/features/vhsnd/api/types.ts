export interface ApiSession {
  id: string;
  village: string;
  block: string | null;
  date: string;
  anm_id: string | null;
  anm_name: string | null;
  expected_beneficiary_ids: string[];
}

export interface ApiAttendance {
  id: number;
  session_id: string;
  anm_id: string | null;
  anm_name: string | null;
  status: 'Present' | 'Absent' | 'Not Recorded';
  check_in_time: string | null;
}
