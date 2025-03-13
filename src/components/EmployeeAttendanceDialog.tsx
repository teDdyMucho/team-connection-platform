
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, AttendanceRecord, AttendanceSummary } from "@/types/employee";
import { formatTime } from "@/utils/formatTime";
import { format } from "date-fns";

interface EmployeeAttendanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
}

const EmployeeAttendanceDialog = ({ isOpen, onClose, employee }: EmployeeAttendanceDialogProps) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);

  useEffect(() => {
    if (isOpen && employee?.employeeId) {
      fetchAttendanceRecords();
    }
  }, [isOpen, employee]);

  const fetchAttendanceRecords = async () => {
    try {
      const q = query(
        collection(db, "attendance"),
        where("employeeId", "==", employee.employeeId),
        orderBy("timestamp", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const records: AttendanceRecord[] = [];
      
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
      });
      
      setAttendanceRecords(records);
      generateAttendanceSummary(records);
    } catch (error) {
      console.error("Error fetching attendance records:", error);
    }
  };

  const generateAttendanceSummary = (records: AttendanceRecord[]) => {
    // Group records by date
    const recordsByDate = records.reduce((acc, record) => {
      const date = format(record.timestamp.toDate(), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(record);
      return acc;
    }, {} as Record<string, AttendanceRecord[]>);

    // Generate summary for each date
    const summary: AttendanceSummary[] = Object.entries(recordsByDate).map(([date, dayRecords]) => {
      // Sort by timestamp (oldest first for accurate pairing)
      dayRecords.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
      
      let clockIn: string | undefined;
      let clockOut: string | undefined;
      let totalHours: string | undefined;

      // Find clock in and clock out events
      const clockInRecord = dayRecords.find(r => r.eventType === 'clock_in');
      const clockOutRecord = dayRecords.find(r => r.eventType === 'clock_out');

      if (clockInRecord) {
        clockIn = format(clockInRecord.timestamp.toDate(), 'HH:mm:ss');
      }

      if (clockOutRecord) {
        clockOut = format(clockOutRecord.timestamp.toDate(), 'HH:mm:ss');
      }

      // Calculate total hours if both clock in and out exist
      if (clockInRecord && clockOutRecord) {
        const diffMs = clockOutRecord.timestamp.toDate().getTime() - clockInRecord.timestamp.toDate().getTime();
        totalHours = formatTime(diffMs);
      }

      return {
        date: format(new Date(date), 'MMMM dd, yyyy'),
        clockIn,
        clockOut,
        totalHours
      };
    });

    setAttendanceSummary(summary);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{employee?.name} Attendance Records</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Attendance Summary</TabsTrigger>
            <TabsTrigger value="records">Detailed Records</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceSummary.length > 0 ? (
                  attendanceSummary.map((summary, index) => (
                    <TableRow key={index}>
                      <TableCell>{summary.date}</TableCell>
                      <TableCell>{summary.clockIn || 'N/A'}</TableCell>
                      <TableCell>{summary.clockOut || 'N/A'}</TableCell>
                      <TableCell>{summary.totalHours || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">No attendance records found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
          
          <TabsContent value="records" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.length > 0 ? (
                  attendanceRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="capitalize">{record.eventType.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{format(record.timestamp.toDate(), 'MMMM dd, yyyy HH:mm:ss')}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4">No attendance records found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeAttendanceDialog;
