import { useState, useEffect } from "react";
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
import { doc, getDoc, setDoc, addDoc, collection, deleteDoc, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, EmployeeStatus, AttendanceRecord, Message } from "@/types/employee";
import { Link } from "react-router-dom";

const EmployeePanel = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Include isAdmin flag in current employee.
  const [currentEmployee, setCurrentEmployee] = useState<{employeeId: string; name: string; isAdmin: boolean} | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus>({ status: "Clocked Out", stateStartTime: null });
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [clockInTimer, setClockInTimer] = useState("00:00:00");
  const [breakTimer, setBreakTimer] = useState("00:00:00");
  const [accumulatedBreakMs, setAccumulatedBreakMs] = useState(0);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loginError, setLoginError] = useState("");

  // New state for listing employees on the same break (for Pee Break 1 & 2)
  const [breakEmployees, setBreakEmployees] = useState<any[]>([]);
  // State to track last mouse movement time (for idle detection)
  const [lastMouseMove, setLastMouseMove] = useState(new Date());

  // Timer effect: update overall clock and break timers every second.
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLoggedIn) {
      interval = setInterval(() => {
        const now = new Date();
        // Overall clock timer (if clockInTime exists)
        if (clockInTime) {
          const diffOverall = now.getTime() - clockInTime.getTime();
          setClockInTimer(formatTime(diffOverall));
        }
        // Break timer: if employee is not working or clocked out and stateStartTime exists,
        // display accumulated break time + current segment.
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
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoggedIn, clockInTime, employeeStatus, accumulatedBreakMs]);

  // Helper: format milliseconds to hh:mm:ss.
  const formatTime = (diff: number) => {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return (hours < 10 ? "0" + hours : hours) + ":" +
           (minutes < 10 ? "0" + minutes : minutes) + ":" +
           (seconds < 10 ? "0" + seconds : seconds);
  };

  // Global mouse move listener for idle detection.
  useEffect(() => {
    const handleMouseMove = () => {
      setLastMouseMove(new Date());
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Idle detection: if no mouse movement for 10 sec while "Working", update status to "Working Idle".
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
            clockInTime: employeeStatus.clockInTime // retain clock-in time
          };
          await setDoc(doc(db, "status", currentEmployee.employeeId), newStatus);
          setEmployeeStatus(newStatus);
        }
      }, 10000);
    }
    return () => clearTimeout(idleTimeout);
  }, [lastMouseMove, isLoggedIn, employeeStatus, currentEmployee]);

  // Fetch employees on the same break (for Pee Break 1 or Pee Break 2).
  useEffect(() => {
    const fetchBreakEmployees = async () => {
      if (employeeStatus.status === "Pee Break 1" || employeeStatus.status === "Pee Break 2") {
        const q = query(collection(db, "status"), where("status", "==", employeeStatus.status));
        const querySnapshot = await getDocs(q);
        const breakEmps: any[] = [];
        querySnapshot.forEach(doc => {
          breakEmps.push({ id: doc.id, ...doc.data() });
        });
        setBreakEmployees(breakEmps);
      } else {
        setBreakEmployees([]);
      }
    };
    fetchBreakEmployees();
  }, [employeeStatus]);

  // Push Notification & Buzz: every 3 seconds when on break or Working Idle.
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

  // Function: Notify (push notification & buzz sound).
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

  // Employee login handler.
  const handleLogin = async () => {
    if (!employeeId || !password) {
      setLoginError("Please enter both Employee ID and Password");
      return;
    }
    try {
      const empDoc = await getDoc(doc(db, "employees", employeeId));
      if (!empDoc.exists()) {
        setLoginError("Employee not found");
        return;
      }
      const empData = empDoc.data();
      if (empData.password !== password) {
        setLoginError("Incorrect password");
        return;
      }
      if (empData.disabled) {
        setLoginError("Your account is disabled");
        return;
      }
      setCurrentEmployee({ 
        employeeId, 
        name: empData.name,
        isAdmin: empData.isAdmin || false
      });
      setIsLoggedIn(true);
      setLoginError("");
      // Load existing status if available.
      const statusDoc = await getDoc(doc(db, "status", employeeId));
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
      // Load messages and attendance history.
      fetchEmployeeMessages();
      fetchAttendanceHistory();
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("An error occurred during login");
    }
  };

  // Clock In function.
  const clockIn = async () => {
    if (!currentEmployee) return;
    const now = Timestamp.now();
    const nowDate = now.toDate();
    setClockInTime(nowDate);
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

  // Clock Out function.
  const clockOut = async () => {
    if (!currentEmployee) return;
    const now = Timestamp.now();
    try {
      await addDoc(collection(db, "attendance"), {
        employeeId: currentEmployee.employeeId,
        eventType: "clockOut",
        timestamp: now
      });
      setEmployeeStatus({ status: "Clocked Out", stateStartTime: null });
      await deleteDoc(doc(db, "status", currentEmployee.employeeId));
      setClockInTime(null);
      setClockInTimer("00:00:00");
      setBreakTimer("00:00:00");
      setAccumulatedBreakMs(0);
    } catch (error) {
      console.error("Clock out error:", error);
    }
  };

  // Toggle Break function.
  const toggleBreak = async (breakType: string) => {
    if (!currentEmployee) return;
    const now = Timestamp.now();
    // If currently Working, start a break.
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
    } 
    // If already on this break, then ending it to resume working.
    else if (employeeStatus.status === breakType) {
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
      setAccumulatedBreakMs(0);
    } 
    // Switching from one break to a different break.
    else if (employeeStatus.status !== "Working" && employeeStatus.status !== breakType) {
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

  // Resume Working from a Working Idle state.
  const resumeWorking = async () => {
    if (!currentEmployee) return;
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

  // Fetch attendance history.
  const fetchAttendanceHistory = async () => {
    if (!currentEmployee) return;
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

  // Logout function.
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentEmployee(null);
    setEmployeeId("");
    setPassword("");
    setEmployeeStatus({ status: "Clocked Out", stateStartTime: null });
    setClockInTime(null);
    setClockInTimer("00:00:00");
    setBreakTimer("00:00:00");
    setAccumulatedBreakMs(0);
  };

  // Determine break button state.
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

  // If not logged in, show the login form.
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Employee Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              <div className="space-y-2">
                <Input
                  id="employeeId"
                  placeholder="Employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {loginError && (
                <div className="text-red-500 text-sm">{loginError}</div>
              )}
              <Button type="submit" className="w-full">Login</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Employee Panel (logged in)
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

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="attendance" className="flex-1">Attendance</TabsTrigger>
            <TabsTrigger value="messages" className="flex-1">Messages</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
          </TabsList>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
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
                  {/* If on Pee Break 1 or Pee Break 2, display grid of employees on that break */}
                  {(employeeStatus.status === "Pee Break 1" || employeeStatus.status === "Pee Break 2") && breakEmployees.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-lg font-medium">Employees on {employeeStatus.status}:</h3>
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
                        {/* If employee is Working Idle, show a Resume Working button */}
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
