
import { Timestamp } from "firebase/firestore";

export interface Employee {
  id?: string;
  employeeId: string;
  name: string;
  password: string;
  basicInfo?: string;
  disabled?: boolean;
  isAdmin?: boolean;
}

export interface EmployeeStatus {
  status: string;
  stateStartTime: Timestamp | null;
  employeeId?: string;
  clockInTime?: Timestamp;
}

export interface AttendanceRecord {
  id?: string;
  employeeId: string;
  eventType: string;
  timestamp: Timestamp;
}

export interface Message {
  id?: string;
  sender: string;
  message: string;
  timestamp: Timestamp;
}

export interface AttendanceSummary {
  date: string;
  clockIn?: string;
  clockOut?: string;
  totalHours?: string;
}
