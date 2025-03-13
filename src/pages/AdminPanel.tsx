import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  onSnapshot, 
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, EmployeeStatus } from "@/types/employee";

const AdminPanel = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeEmployees, setActiveEmployees] = useState<(EmployeeStatus & {id: string})[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [newEmployee, setNewEmployee] = useState<Omit<Employee, 'disabled'>>({
    name: "",
    employeeId: "",
    password: "",
    basicInfo: ""
  });
  const [messageInput, setMessageInput] = useState("");

  // Load all employees on mount
  useEffect(() => {
    loadEmployees();
    
    // Set up real-time listener for active employees
    const statusCol = collection(db, "status");
    const unsubscribe = onSnapshot(statusCol, (snapshot) => {
      const activeEmps = [];
      snapshot.forEach(doc => {
        activeEmps.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setActiveEmployees(activeEmps);
    });
    
    return () => unsubscribe();
  }, []);

  // Load all employees from Firestore
  const loadEmployees = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "employees"));
      const emps = [];
      
      querySnapshot.forEach(doc => {
        emps.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setEmployees(emps);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  // Show employee attendance records
  const showEmployeeRecord = async (empId) => {
    try {
      const q = query(
        collection(db, "attendance"), 
        where("employeeId", "==", empId)
      );
      
      const querySnapshot = await getDocs(q);
      const records = [];
      
      querySnapshot.forEach(doc => {
        records.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort by timestamp (newest first)
      records.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
      
      setAttendanceRecords(records);
      
      // Find and set the selected employee
      const emp = employees.find(e => e.employeeId === empId);
      setSelectedEmployee(emp);
    } catch (error) {
      console.error("Error fetching records:", error);
    }
  };

  // Add new employee
  const addEmployee = async () => {
    const { name, employeeId, password, basicInfo } = newEmployee;
    
    if (!name || !employeeId || !password) {
      alert("Please fill in all required fields (Name, Employee ID, Password)");
      return;
    }
    
    try {
      await setDoc(doc(db, "employees", employeeId), {
        employeeId,
        name,
        password,
        basicInfo,
        disabled: false
      });
      
      alert("Employee added successfully");
      
      // Reset form and reload employees
      setNewEmployee({
        name: "",
        employeeId: "",
        password: "",
        basicInfo: ""
      });
      
      loadEmployees();
    } catch (error) {
      console.error("Error adding employee:", error);
      alert("Error adding employee: " + error.message);
    }
  };

  // Update employee details
  const updateEmployee = async (emp: Employee) => {
    try {
      await updateDoc(doc(db, "employees", emp.employeeId), {
        name: emp.name,
        password: emp.password,
        basicInfo: emp.basicInfo
      });
      
      alert("Employee updated successfully");
      loadEmployees();
    } catch (error) {
      console.error("Error updating employee:", error);
      alert("Error updating employee: " + error.message);
    }
  };

  // Toggle employee disabled status
  const toggleEmployeeStatus = async (emp: Employee) => {
    try {
      await updateDoc(doc(db, "employees", emp.employeeId), {
        disabled: !emp.disabled
      });
      
      alert(`Employee ${emp.name} is now ${emp.disabled ? "enabled" : "disabled"}`);
      loadEmployees();
    } catch (error) {
      console.error("Error toggling employee status:", error);
      alert("Error toggling employee status: " + error.message);
    }
  };

  // Send a message to all employees
  const sendMessage = async () => {
    if (!messageInput.trim()) {
      alert("Please enter a message");
      return;
    }
    
    try {
      await addDoc(collection(db, "messages"), {
        sender: "Admin",
        message: messageInput,
        timestamp: Timestamp.now()
      });
      
      alert("Message sent successfully");
      setMessageInput("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Error sending message: " + error.message);
    }
  };

  // Format time duration from timestamp
  const formatDuration = (timestamp: Timestamp | null | undefined) => {
    if (!timestamp) return "N/A";
    
    const now = new Date();
    const start = timestamp.toDate();
    const diffMs = now.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle input change for employee form
  const handleEmployeeInputChange = (e) => {
    const { name, value } = e.target;
    setNewEmployee(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle input change for existing employee
  const handleExistingEmployeeChange = (index, field, value) => {
    const updatedEmployees = [...employees];
    updatedEmployees[index][field] = value;
    setEmployees(updatedEmployees);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Index button at top right */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <Link to="/">
            <Button variant="outline" size="sm">Index</Button>
          </Link>
        </div>

        <Tabs defaultValue="monitoring" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="monitoring" className="flex-1">Monitoring</TabsTrigger>
            <TabsTrigger value="records" className="flex-1">Employee Records</TabsTrigger>
            <TabsTrigger value="management" className="flex-1">Employee Management</TabsTrigger>
            <TabsTrigger value="messages" className="flex-1">Messages</TabsTrigger>
          </TabsList>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring">
            <Card>
              <CardHeader>
                <CardTitle>Active Employees Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                {activeEmployees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No active employees</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {activeEmployees.map(emp => (
                      <Card key={emp.id} className="overflow-hidden">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg">
                            Employee ID: {emp.employeeId || emp.id}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Status:</span>
                              <Badge variant={emp.status === "Working" ? "default" : "secondary"}>
                                {emp.status}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Duration:</span>
                              <span className="font-mono">
                                {formatDuration(emp.stateStartTime)}
                              </span>
                            </div>
                            {emp.clockInTime && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Clocked in:</span>
                                <span className="font-mono">
                                  {formatDuration(emp.clockInTime)}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employee Records Tab */}
          <TabsContent value="records">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle>Employee List</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {employees.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">No employees found</div>
                    ) : (
                      employees.map(emp => (
                        <Button
                          key={emp.employeeId}
                          variant={selectedEmployee?.employeeId === emp.employeeId ? "default" : "outline"}
                          className="w-full justify-start"
                          onClick={() => showEmployeeRecord(emp.employeeId)}
                        >
                          {emp.name} (ID: {emp.employeeId})
                          {emp.disabled && (
                            <Badge variant="outline" className="ml-2">Disabled</Badge>
                          )}
                        </Button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>
                    {selectedEmployee ? `Attendance Records: ${selectedEmployee.name}` : "Select an employee"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedEmployee ? (
                    <div className="text-center py-12 text-gray-500">
                      Select an employee to view their attendance records
                    </div>
                  ) : attendanceRecords.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No attendance records found for this employee
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event Type</TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceRecords.map(record => (
                          <TableRow key={record.id}>
                            <TableCell className="capitalize">
                              {record.eventType.replace(/_/g, ' ')}
                            </TableCell>
                            <TableCell>
                              {new Date(record.timestamp.seconds * 1000).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Employee Management Tab */}
          <TabsContent value="management">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Employee</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        name="name"
                        placeholder="Employee Name"
                        value={newEmployee.name}
                        onChange={handleEmployeeInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Employee ID</label>
                      <Input
                        name="employeeId"
                        placeholder="Employee ID"
                        value={newEmployee.employeeId}
                        onChange={handleEmployeeInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Password</label>
                      <Input
                        name="password"
                        type="password"
                        placeholder="Password"
                        value={newEmployee.password}
                        onChange={handleEmployeeInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Basic Info</label>
                      <Input
                        name="basicInfo"
                        placeholder="Basic Info"
                        value={newEmployee.basicInfo}
                        onChange={handleEmployeeInputChange}
                      />
                    </div>
                  </div>
                  <Button onClick={addEmployee} className="mt-4">
                    Add Employee
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Manage Employees</CardTitle>
                </CardHeader>
                <CardContent>
                  {employees.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No employees found</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Password</TableHead>
                          <TableHead>Basic Info</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.map((emp, index) => (
                          <TableRow key={emp.employeeId}>
                            <TableCell>{emp.employeeId}</TableCell>
                            <TableCell>
                              <Input
                                value={emp.name}
                                onChange={(e) => handleExistingEmployeeChange(index, 'name', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={emp.password}
                                type="password"
                                onChange={(e) => handleExistingEmployeeChange(index, 'password', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={emp.basicInfo || ''}
                                onChange={(e) => handleExistingEmployeeChange(index, 'basicInfo', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant={emp.disabled ? "destructive" : "default"}>
                                {emp.disabled ? "Disabled" : "Enabled"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => updateEmployee(emp)}
                                >
                                  Save
                                </Button>
                                <Button 
                                  variant={emp.disabled ? "default" : "destructive"} 
                                  size="sm"
                                  onClick={() => toggleEmployeeStatus(emp)}
                                >
                                  {emp.disabled ? "Enable" : "Disable"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Send Message to All Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    placeholder="Type your message here..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button onClick={sendMessage}>Send Message</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
