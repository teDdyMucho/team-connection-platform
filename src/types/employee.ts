
import { Timestamp } from "firebase/firestore";

export interface Employee {
  employeeId: string;
  name: string;
  password: string;
  basicInfo?: string;
  disabled?: boolean;
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
