import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  collection, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  Timestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, EmployeeStatus, AttendanceRecord, Message } from "@/types/employee";

const EmployeePanel = () => {
  // Retrieve current employee from localStorage.
  const storedEmployee = localStorage.getItem("currentEmployee");
  const initialEmployee = storedEmployee ? JSON.parse(storedEmployee) : null;
  const [isLoggedIn] = useState(initialEmployee ? true : false);
  const [currentEmployee] = useState<{employeeId: string; name: string; isAdmin: boolean} | null>(initialEmployee);
  
  // Employee status and timer state.
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus>({ status: "Clocked Out", stateStartTime: null });
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [clockInTimer, setClockInTimer] = useState("00:00:00");
  const [breakTimer, setBreakTimer] = useState("00:00:00");
  // Accumulated break time (in ms) is added to the Break Timer; it is not reset on ending a break.
  const [accumulatedBreakMs, setAccumulatedBreakMs] = useState(0);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // New state for attendance summaries (stored on clock out).
  const [attendanceSummaries, setAttendanceSummaries] = useState<any[]>([]);
  
  // List of employees on Pee Break (both Pee Break 1 and Pee Break 2).
  const [breakEmployees, setBreakEmployees] = useState<any[]>([]);
  // For idle detection.
  const [lastMouseMove, setLastMouseMove] = useState(new Date());

  const navigate = useNavigate();

  // On component mount, fetch the employee's current status.
  useEffect(() => {
    const fetchEmployeeStatus = async () => {
      if (currentEmployee) {
        const statusDoc = await getDoc(doc(db, "status", currentEmployee.employeeId));
        if (statusDoc.exists()) {
          const statusData = statusDoc.data();
          setEmployeeStatus({
            status: statusData.status || "Clocked Out",
            stateStartTime: statusData.stateStartTime || null,
            employeeId: statusData.employeeId,
            clockInTime: statusData.clockInTime
          });
          if (statusData.clockInTime) {
            setClockInTime(statusData.clockInTime.toDate());
          }
        }
      }
    };
    fetchEmployeeStatus();
  }, [currentEmployee]);

  // Timer effect: update Clock Timer and Break Timer every second.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (clockInTime) {
        const diffOverall = now.getTime() - clockInTime.getTime();
        setClockInTimer(formatTime(diffOverall));
      }
      if (
        employeeStatus.status !== "Working" &&
        employeeStatus.status !== "Clocked Out" &&
        employeeStatus.stateStartTime
      ) {
        const currentBreak = now.getTime() - employeeStatus.stateStartTime.toDate().getTime();
        setBreakTimer(formatTime(accumulatedBreakMs + currentBreak));
      } else {
        setBreakTimer("00:00:00");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [clockInTime, employeeStatus, accumulatedBreakMs]);

  const formatTime = (diff: number) => {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return (hours < 10 ? "0" + hours : hours) + ":" +
           (minutes < 10 ? "0" + minutes : minutes) + ":" +
           (seconds < 10 ? "0" + seconds : seconds);
  };

  // Global mouse move listener.
  useEffect(() => {
    const handleMouseMove = () => {
      setLastMouseMove(new Date());
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Idle detection: if no movement for 10 sec while "Working", update status to "Working Idle".
  useEffect(() => {
    let idleTimeout: NodeJS.Timeout;
    if (isLoggedIn && currentEmployee && employeeStatus.status === "Working") {
      idleTimeout = setTimeout(async () => {
        const now = new Date();
        if (now.getTime() - lastMouseMove.getTime() >= 10000) {
          const newStatus = { 
            status: "Working Idle", 
            stateStartTime: Timestamp.now(),
            employeeId: currentEmployee.employeeId,
            clockInTime: employeeStatus.clockInTime
          };
          await setDoc(doc(db, "status", currentEmployee.employeeId), newStatus);
          setEmployeeStatus(newStatus);
        }
      }, 10000);
    }
    return () => clearTimeout(idleTimeout);
  }, [lastMouseMove, isLoggedIn, employeeStatus, currentEmployee]);

  // Realtime update: fetch list of employees on Pee Break (Pee Break 1 or 2) every second.
  useEffect(() => {
    const fetchPeeBreakEmployeesInterval = setInterval(() => {
      const fetchPeeBreakEmployees = async () => {
        const q = query(collection(db, "status"), where("status", "in", ["Pee Break 1", "Pee Break 2"]));
        const querySnapshot = await getDocs(q);
        const peeBreakEmps: any[] = [];
        querySnapshot.forEach(doc => {
          peeBreakEmps.push({ id: doc.id, ...doc.data() });
        });
        setBreakEmployees(peeBreakEmps);
      };
      fetchPeeBreakEmployees();
    }, 1000);
    return () => clearInterval(fetchPeeBreakEmployeesInterval);
  }, []);

  // Push Notification & Buzz: every 3 sec when on break or Working Idle.
  useEffect(() => {
    let notifInterval: NodeJS.Timeout;
    if (
      isLoggedIn &&
      (employeeStatus.status === "Pee Break 1" ||
       employeeStatus.status === "Pee Break 2" ||
       employeeStatus.status === "Lunch" ||
       employeeStatus.status === "Small Break" ||
       employeeStatus.status === "Working Idle")
    ) {
      notifInterval = setInterval(() => {
        notifyBreak();
      }, 3000);
    }
    return () => {
      if (notifInterval) clearInterval(notifInterval);
    };
  }, [employeeStatus.status, isLoggedIn]);

  const notifyBreak = () => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
    if (Notification.permission === "granted") {
      new Notification("Break Alert", {
        body: `Status: ${employeeStatus.status}`,
      });
    }
    const buzz = new Audio("/buzz.mp3");
    buzz.play().catch((err) => console.error("Error playing sound:", err));
  };

  const clockIn = async () => {
    const now = Timestamp.now();
    setClockInTime(now.toDate());
    try {
      await addDoc(collection(db, "attendance"), {
        employeeId: currentEmployee.employeeId,
        eventType: "clockIn",
        timestamp: now
      });
      const newStatus = { 
        status: "Working", 
        stateStartTime: now,
        employeeId: currentEmployee.employeeId,
        clockInTime: now
      };
      await setDoc(doc(db, "status", currentEmployee.employeeId), newStatus);
      setEmployeeStatus(newStatus);
    } catch (error) {
      console.error("Clock in error:", error);
    }
  };

  const clockOut = async () => {
    const now = Timestamp.now();
    try {
      await addDoc(collection(db, "attendance"), {
        employeeId: currentEmployee.employeeId,
        eventType: "clockOut",
        timestamp: now
      });
      // Calculate the total clock time in ms.
      const totalClockTime = clockInTime ? Date.now() - clockInTime.getTime() : 0;
      // Store summary data in a separate collection "attendanceSummary"
      await addDoc(collection(db, "attendanceSummary"), {
        employeeId: currentEmployee.employeeId,
        totalClockTime, // in ms
        accumulatedBreak: accumulatedBreakMs, // in ms
        date: now
      });
      setEmployeeStatus({ status: "Clocked Out", stateStartTime: null });
      await deleteDoc(doc(db, "status", currentEmployee.employeeId));
      setClockInTime(null);
      setClockInTimer("00:00:00");
      setBreakTimer("00:00:00");
      // Do not reset accumulatedBreakMs here if you want to keep it (or reset if starting fresh on next clock in).
    } catch (error) {
      console.error("Clock out error:", error);
    }
  };

  const toggleBreak = async (breakType: string) => {
    const now = Timestamp.now();
    if (employeeStatus.status === "Working") {
      setAccumulatedBreakMs(0);
      await addDoc(collection(db, "attendance"), {
        employeeId: currentEmployee.employeeId,
        eventType: "start_" + breakType.replace(/ /g, ""),
        timestamp: now
      });
      const newStatus = { 
        status: breakType, 
        stateStartTime: now,
        employeeId: currentEmployee.employeeId,
        clockInTime: Timestamp.fromDate(clockInTime!)
      };
      await setDoc(doc(db, "status", currentEmployee.employeeId), newStatus);
      setEmployeeStatus(newStatus);
      notifyBreak();
    } else if (employeeStatus.status === breakType) {
      const elapsed = Date.now() - employeeStatus.stateStartTime.toDate().getTime();
      setAccumulatedBreakMs(prev => prev + elapsed);
      await addDoc(collection(db, "attendance"), {
        employeeId: currentEmployee.employeeId,
        eventType: "end_" + breakType.replace(/ /g, ""),
        timestamp: now
      });
      const newStatus = { 
        status: "Working", 
        stateStartTime: now,
        employeeId: currentEmployee.employeeId,
        clockInTime: Timestamp.fromDate(clockInTime!)
      };
      await setDoc(doc(db, "status", currentEmployee.employeeId), newStatus);
      setEmployeeStatus(newStatus);
      // Do not reset accumulatedBreakMs.
    } else if (employeeStatus.status !== "Working" && employeeStatus.status !== breakType) {
      const elapsed = Date.now() - employeeStatus.stateStartTime.toDate().getTime();
      setAccumulatedBreakMs(prev => prev + elapsed);
      await addDoc(collection(db, "attendance"), {
        employeeId: currentEmployee.employeeId,
        eventType: "switchBreak_from_" + employeeStatus.status.replace(/ /g, ""),
        timestamp: now
      });
      await addDoc(collection(db, "attendance"), {
        employeeId: currentEmployee.employeeId,
        eventType: "start_" + breakType.replace(/ /g, ""),
        timestamp: now
      });
      const newStatus = { 
        status: breakType, 
        stateStartTime: now,
        employeeId: currentEmployee.employeeId,
        clockInTime: Timestamp.fromDate(clockInTime!)
      };
      await setDoc(doc(db, "status", currentEmployee.employeeId), newStatus);
      setEmployeeStatus(newStatus);
      notifyBreak();
    }
  };

  const resumeWorking = async () => {
    const now = Timestamp.now();
    await addDoc(collection(db, "attendance"), {
      employeeId: currentEmployee.employeeId,
      eventType: "resumeWorking",
      timestamp: now
    });
    const newStatus = {
      status: "Working",
      stateStartTime: now,
      employeeId: currentEmployee.employeeId,
      clockInTime: employeeStatus.clockInTime
    };
    await setDoc(doc(db, "status", currentEmployee.employeeId), newStatus);
    setEmployeeStatus(newStatus);
  };

  // Fetch attendance history (all events).
  const fetchAttendanceHistory = async () => {
    try {
      const q = query(
        collection(db, "attendance"), 
        where("employeeId", "==", currentEmployee.employeeId)
      );
      const querySnapshot = await getDocs(q);
      const history: AttendanceRecord[] = [];
      querySnapshot.forEach(doc => {
        history.push({
          id: doc.id,
          ...doc.data()
        } as AttendanceRecord);
      });
      history.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
      setAttendanceHistory(history);
    } catch (error) {
      console.error("Fetch attendance history error:", error);
    }
  };

  // Fetch attendance summary records.
  const fetchAttendanceSummaries = async () => {
    try {
      const q = query(
        collection(db, "attendanceSummary"), 
        where("employeeId", "==", currentEmployee.employeeId)
      );
      const querySnapshot = await getDocs(q);
      const summaries: any[] = [];
      querySnapshot.forEach(doc => {
        summaries.push({
          id: doc.id,
          ...doc.data()
        });
      });
      // Optionally, sort by date descending.
      summaries.sort((a, b) => b.date.seconds - a.date.seconds);
      setAttendanceSummaries(summaries);
    } catch (error) {
      console.error("Fetch attendance summaries error:", error);
    }
  };

  // Fetch employee messages.
  const fetchEmployeeMessages = async () => {
    try {
      const q = query(collection(db, "messages"));
      const querySnapshot = await getDocs(q);
      const msgs: Message[] = [];
      querySnapshot.forEach(doc => {
        msgs.push({
          id: doc.id,
          ...doc.data()
        } as Message);
      });
      msgs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setMessages(msgs);
    } catch (error) {
      console.error("Fetch messages error:", error);
    }
  };

  // Updated logout: remove current employee and navigate to index.tsx.
  const handleLogout = () => {
    localStorage.removeItem("currentEmployee");
    navigate("/");
  };

  const getBreakButtonState = (breakType: string) => {
    if (employeeStatus.status === "Clocked Out") {
      return { visible: false, active: false, disabled: true };
    }
    if (employeeStatus.status === "Working") {
      return { visible: true, active: false, disabled: false };
    }
    return { 
      visible: true, 
      active: employeeStatus.status === breakType,
      disabled: employeeStatus.status !== breakType
    };
  };

  // useEffect to fetch attendance summaries every 5 sec (for realtime updates)
  useEffect(() => {
    const summaryInterval = setInterval(() => {
      fetchAttendanceSummaries();
    }, 5000);
    return () => clearInterval(summaryInterval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        {currentEmployee?.isAdmin && (
          <div className="flex justify-end mb-4 gap-4">
            <Link to="/admin">
              <Button variant="outline">Admin Panel</Button>
            </Link>
            <Link to="/">
              <Button variant="outline">Index</Button>
            </Link>
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Employee Panel</h1>
          <div className="flex items-center gap-2">
            <span className="font-medium">Welcome, {currentEmployee.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="dashboard" className="flex-1">Dashboard</TabsTrigger>
            <TabsTrigger value="attendance" className="flex-1">Attendance</TabsTrigger>
            <TabsTrigger value="messages" className="flex-1">Messages</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
          </TabsList>
          {/* Dashboard Tab: Existing controls */}
          <TabsContent value="dashboard">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Status</div>
                      <Badge 
                        variant={employeeStatus.status === "Clocked Out" ? "outline" : 
                                 (employeeStatus.status === "Working" ? "default" : "secondary")}
                        className="text-base py-1 px-3"
                      >
                        {employeeStatus.status}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Clock Timer</div>
                      <div className="font-mono text-lg">{clockInTimer}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Break Timer</div>
                      <div className="font-mono text-lg">{breakTimer}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-sm text-gray-500 mb-1">Accumulated Break</div>
                    <div className="font-mono text-lg">{formatTime(accumulatedBreakMs)}</div>
                  </div>
                  {breakEmployees.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-lg font-medium">Employees on Pee Break:</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {breakEmployees.map(emp => (
                          <div key={emp.id} className="p-2 border rounded">
                            {emp.employeeId}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {employeeStatus.status === "Clocked Out" ? (
                      <Button 
                        onClick={clockIn}
                        className="col-span-2 md:col-span-4 h-12 bg-green-600 hover:bg-green-700"
                      >
                        Clock In
                      </Button>
                    ) : (
                      <>
                        <Button 
                          onClick={clockOut}
                          variant="destructive" 
                          className="col-span-2 md:col-span-4 h-12 mb-2"
                        >
                          Clock Out
                        </Button>
                        {["Lunch", "Pee Break 1", "Pee Break 2", "Small Break"].map(breakType => {
                          const { visible, active, disabled } = getBreakButtonState(breakType);
                          if (!visible) return null;
                          return (
                            <Button
                              key={breakType}
                              onClick={() => toggleBreak(breakType)}
                              variant={active ? "default" : "outline"}
                              disabled={disabled && !active}
                              className="h-10"
                            >
                              {active ? `End ${breakType}` : breakType}
                            </Button>
                          );
                        })}
                        {employeeStatus.status === "Working Idle" && (
                          <Button onClick={resumeWorking} variant="default" className="col-span-2 md:col-span-4 h-12">
                            Resume Working
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Attendance Tab: Summary records stored on Clock Out */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {attendanceSummaries.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No summary records found</p>
                ) : (
                  <div className="space-y-2">
                    {attendanceSummaries.map(summary => (
                      <div key={summary.id} className="border p-2 rounded flex justify-between items-center">
                        <div>
                          <div><strong>Date:</strong> {new Date(summary.date.seconds * 1000).toLocaleString()}</div>
                          <div><strong>Total Clock:</strong> {formatTime(summary.totalClockTime)}</div>
                          <div><strong>Accumulated Break:</strong> {formatTime(summary.accumulatedBreak)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Messages Tab */}
          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No messages found</p>
                ) : (
                  <div className="space-y-4">
                    {messages.map(message => (
                      <div key={message.id} className="border p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">{message.sender || 'Admin'}</span>
                          <span className="text-sm text-gray-500">
                            {message.timestamp ? new Date(message.timestamp.seconds * 1000).toLocaleString() : 'No date'}
                          </span>
                        </div>
                        <p className="mt-2">{message.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Attendance History</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchAttendanceHistory}>
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {attendanceHistory.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No history found</p>
                ) : (
                  <div className="space-y-1">
                    {attendanceHistory.map(record => (
                      <div key={record.id} className="flex justify-between border-b py-2">
                        <span className="capitalize">
                          {record.eventType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-gray-500">
                          {new Date(record.timestamp.seconds * 1000).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EmployeePanel;
