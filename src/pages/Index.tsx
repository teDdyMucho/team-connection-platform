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
import { doc, getDoc, setDoc, addDoc, collection, deleteDoc, query, where, getDocs, Timestamp, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, EmployeeStatus, AttendanceRecord, Message } from "@/types/employee";

const EmployeePanel = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [currentEmployee, setCurrentEmployee] = useState<{employeeId: string; name: string} | null>(null);
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus>({ status: "Clocked Out", stateStartTime: null });
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [clockInTimer, setClockInTimer] = useState("00:00:00");
  const [breakTimer, setBreakTimer] = useState("00:00:00");
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loginError, setLoginError] = useState("");

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isLoggedIn) {
      interval = setInterval(() => {
        const now = new Date();
        
        // Update overall clock timer
        if (clockInTime) {
          const diffOverall = now.getTime() - clockInTime.getTime();
          setClockInTimer(formatTime(diffOverall));
        }
        
        // Update break timer
        if (employeeStatus.status !== "Working" && 
            employeeStatus.status !== "Clocked Out" && 
            employeeStatus.stateStartTime) {
          const diffBreak = now.getTime() - employeeStatus.stateStartTime.toDate().getTime();
          setBreakTimer(formatTime(diffBreak));
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoggedIn, clockInTime, employeeStatus]);

  // Helper function to format time
  const formatTime = (diff: number) => {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return (hours < 10 ? "0" + hours : hours) + ":" +
           (minutes < 10 ? "0" + minutes : minutes) + ":" +
           (seconds < 10 ? "0" + seconds : seconds);
  };

  // Employee login
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
      
      setCurrentEmployee({ employeeId, name: empData.name });
      setIsLoggedIn(true);
      setLoginError("");
      
      // Load existing status if available
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
      
      // Load messages and attendance history
      fetchEmployeeMessages();
      fetchAttendanceHistory();
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("An error occurred during login");
    }
  };

  // Clock In function
  const clockIn = async () => {
    if (!currentEmployee) return;
    
    const now = Timestamp.now();
    const nowDate = now.toDate();
    setClockInTime(nowDate);
    
    try {
      // Add attendance record
      await addDoc(collection(db, "attendance"), {
        employeeId: currentEmployee.employeeId,
        eventType: "clockIn",
        timestamp: now
      });
      
      // Update status
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

  // Clock Out function
  const clockOut = async () => {
    if (!currentEmployee) return;
    
    const now = Timestamp.now();
    
    try {
      // Add attendance record
      await addDoc(collection(db, "attendance"), {
        employeeId: currentEmployee.employeeId,
        eventType: "clockOut",
        timestamp: now
      });
      
      // Update status
      setEmployeeStatus({ status: "Clocked Out", stateStartTime: null });
      
      // Delete from status collection
      await deleteDoc(doc(db, "status", currentEmployee.employeeId));
      
      // Reset timers
      setClockInTime(null);
      setClockInTimer("00:00:00");
      setBreakTimer("00:00:00");
    } catch (error) {
      console.error("Clock out error:", error);
    }
  };

  // Toggle Break function
  const toggleBreak = async (breakType) => {
    if (!currentEmployee) return;
    
    const now = Timestamp.now();
    
    try {
      if (employeeStatus.status === "Working") {
        // Start break
        await addDoc(collection(db, "attendance"), {
          employeeId: currentEmployee.employeeId,
          eventType: "start_" + breakType.replace(/ /g, ""),
          timestamp: now
        });
        
        const newStatus = { 
          status: breakType, 
          stateStartTime: now,
          employeeId: currentEmployee.employeeId,
          clockInTime: Timestamp.fromDate(clockInTime)
        };
        
        await setDoc(doc(db, "status", currentEmployee.employeeId), newStatus);
        setEmployeeStatus(newStatus);
      } else if (employeeStatus.status === breakType) {
        // End break
        await addDoc(collection(db, "attendance"), {
          employeeId: currentEmployee.employeeId,
          eventType: "end_" + breakType.replace(/ /g, ""),
          timestamp: now
        });
        
        const newStatus = { 
          status: "Working", 
          stateStartTime: now,
          employeeId: currentEmployee.employeeId,
          clockInTime: Timestamp.fromDate(clockInTime)
        };
        
        await setDoc(doc(db, "status", currentEmployee.employeeId), newStatus);
        setEmployeeStatus(newStatus);
      }
    } catch (error) {
      console.error("Toggle break error:", error);
    }
  };

  // Fetch attendance history
  const fetchAttendanceHistory = async () => {
    if (!currentEmployee) return;
    
    try {
      const q = query(
        collection(db, "attendance"), 
        where("employeeId", "==", currentEmployee.employeeId)
      );
      
      const querySnapshot = await getDocs(q);
      const history = [];
      
      querySnapshot.forEach(doc => {
        history.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort by timestamp (newest first)
      history.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
      
      setAttendanceHistory(history);
    } catch (error) {
      console.error("Fetch attendance history error:", error);
    }
  };

  // Fetch employee messages
  const fetchEmployeeMessages = async () => {
    try {
      const q = query(collection(db, "messages"));
      const querySnapshot = await getDocs(q);
      const msgs = [];
      
      querySnapshot.forEach(doc => {
        msgs.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort by timestamp (newest first)
      msgs.sort((a, b) => 
        b.timestamp?.seconds - a.timestamp?.seconds || 0
      );
      
      setMessages(msgs);
    } catch (error) {
      console.error("Fetch messages error:", error);
    }
  };

  // Logout function
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentEmployee(null);
    setEmployeeId("");
    setPassword("");
    setEmployeeStatus({ status: "Clocked Out", stateStartTime: null });
    setClockInTime(null);
    setClockInTimer("00:00:00");
    setBreakTimer("00:00:00");
  };

  // Determine which break buttons to show and their state
  const getBreakButtonState = (breakType) => {
    if (employeeStatus.status === "Clocked Out") {
      return { visible: false, active: false, disabled: true };
    }
    
    if (employeeStatus.status === "Working") {
      return { visible: true, active: false, disabled: false };
    }
    
    // On a break
    return { 
      visible: true, 
      active: employeeStatus.status === breakType,
      disabled: employeeStatus.status !== breakType
    };
  };

  // Login Form
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
                        
                        {/* Break buttons */}
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
