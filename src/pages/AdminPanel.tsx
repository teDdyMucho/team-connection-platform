
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  Timestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, AttendanceRecord, Message, EmployeeStatus } from "@/types/employee";
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
import { formatTime } from "@/utils/formatTime";
import EmployeeAttendanceDialog from "@/components/EmployeeAttendanceDialog";
import { format } from "date-fns";
import { Activity, Clock, User } from "lucide-react";

const AdminPanel = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<EmployeeStatus[]>([]);
  const [newEmployee, setNewEmployee] = useState<Omit<Employee, 'id'>>({
    name: "",
    employeeId: "",
    password: "",
    isAdmin: false,
    disabled: false,
  });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<Omit<Message, 'id'>>({
    sender: "Admin",
    message: "",
    timestamp: Timestamp.now(),
  });
  const [selectedAttendanceEmployee, setSelectedAttendanceEmployee] = useState<Employee | null>(null);
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEmployees();
    fetchAttendanceHistory();
    fetchMessages();
    subscribeToActiveEmployees();
  }, []);

  const subscribeToActiveEmployees = () => {
    const q = query(collection(db, "employee_status"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const statuses: EmployeeStatus[] = [];
      querySnapshot.forEach((doc) => {
        statuses.push(doc.data() as EmployeeStatus);
      });
      setActiveEmployees(statuses);
    });
    
    return unsubscribe;
  };

  const fetchEmployees = async () => {
    try {
      const q = query(collection(db, "employees"));
      const querySnapshot = await getDocs(q);
      const emps: Employee[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        emps.push({ 
          id: doc.id, 
          employeeId: data.employeeId || '',
          name: data.name || '',
          password: data.password || '',
          isAdmin: data.isAdmin || false,
          disabled: data.disabled || false,
          basicInfo: data.basicInfo
        });
      });
      setEmployees(emps);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setNewEmployee(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "employees"), newEmployee);
      fetchEmployees();
      setNewEmployee({ name: "", employeeId: "", password: "", isAdmin: false, disabled: false }); // Reset form
    } catch (error) {
      console.error("Error creating employee:", error);
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsEditing(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee?.id) return;
    try {
      const employeeDoc = doc(db, "employees", selectedEmployee.id);
      await updateDoc(employeeDoc, {
        name: selectedEmployee.name,
        employeeId: selectedEmployee.employeeId,
        password: selectedEmployee.password,
        isAdmin: selectedEmployee.isAdmin,
        disabled: selectedEmployee.disabled,
      });
      fetchEmployees();
      setIsEditing(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error("Error updating employee:", error);
    }
  };

  const handleDeleteEmployee = async (id: string | undefined) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, "employees", id));
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
    }
  };

  const handleEmployeeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setSelectedEmployee(prev => ({
      ...prev!,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const fetchAttendanceHistory = async () => {
    try {
      const q = query(collection(db, "attendance"));
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

  const fetchMessages = async () => {
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

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewMessage(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "messages"), newMessage);
      fetchMessages();
      setNewMessage({ sender: "Admin", message: "", timestamp: Timestamp.now() });
    } catch (error) {
      console.error("Error creating message:", error);
    }
  };

  const handleViewEmployeeAttendance = (employee: Employee) => {
    setSelectedAttendanceEmployee(employee);
    setIsAttendanceDialogOpen(true);
  };

  const getActiveTime = (status: EmployeeStatus) => {
    if (!status.stateStartTime) return "N/A";
    const now = new Date().getTime();
    const startTime = status.stateStartTime.toDate().getTime();
    return formatTime(now - startTime);
  };

  const getEmployeeName = (employeeId: string | undefined) => {
    if (!employeeId) return "Unknown";
    const employee = employees.find(emp => emp.employeeId === employeeId);
    return employee ? employee.name : employeeId;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-end mb-4 gap-4">
          <Link to="/employee">
            <Button variant="outline">Employee Panel</Button>
          </Link>
          <Link to="/">
            <Button variant="outline">Index</Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
        <Tabs defaultValue="employees" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="employees" className="flex-1">Employees</TabsTrigger>
            <TabsTrigger value="active" className="flex-1">Active Employees</TabsTrigger>
            <TabsTrigger value="attendance" className="flex-1">Attendance</TabsTrigger>
            <TabsTrigger value="messages" className="flex-1">Messages</TabsTrigger>
          </TabsList>

          {/* Employees Tab */}
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle>Manage Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {/* Create Employee Form */}
                  <form onSubmit={handleCreateEmployee} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input 
                      type="text" 
                      name="name" 
                      placeholder="Name" 
                      value={newEmployee.name} 
                      onChange={handleInputChange} 
                    />
                    <Input 
                      type="text" 
                      name="employeeId" 
                      placeholder="Employee ID" 
                      value={newEmployee.employeeId} 
                      onChange={handleInputChange} 
                    />
                    <Input 
                      type="password" 
                      name="password" 
                      placeholder="Password" 
                      value={newEmployee.password} 
                      onChange={handleInputChange} 
                    />
                    <div className="flex items-center space-x-2">
                      <label htmlFor="isAdmin" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                        Is Admin
                      </label>
                      <Input
                        type="checkbox"
                        id="isAdmin"
                        name="isAdmin"
                        checked={newEmployee.isAdmin}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label htmlFor="disabled" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                        Disabled
                      </label>
                      <Input
                        type="checkbox"
                        id="disabled"
                        name="disabled"
                        checked={newEmployee.disabled}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                      />
                    </div>
                    <Button type="submit" className="w-full md:col-span-2">Create Employee</Button>
                  </form>

                  {/* Employee List */}
                  <div className="divide-y divide-gray-200">
                    {employees.map(employee => (
                      <div key={employee.id} className="py-2 flex justify-between items-center">
                        <div>
                          {employee.name} ({employee.employeeId})
                        </div>
                        <div className="space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditEmployee(employee)}>
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteEmployee(employee.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Edit Employee Form */}
                  {isEditing && selectedEmployee && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <form onSubmit={handleUpdateEmployee} className="grid gap-4">
                          <Input
                            type="text"
                            name="name"
                            placeholder="Name"
                            value={selectedEmployee.name}
                            onChange={handleEmployeeInputChange}
                          />
                          <Input
                            type="text"
                            name="employeeId"
                            placeholder="Employee ID"
                            value={selectedEmployee.employeeId}
                            onChange={handleEmployeeInputChange}
                          />
                          <Input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={selectedEmployee.password}
                            onChange={handleEmployeeInputChange}
                          />
                          <div className="flex items-center space-x-2">
                            <label htmlFor="isAdminEdit" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                              Is Admin
                            </label>
                            <Input
                              type="checkbox"
                              id="isAdminEdit"
                              name="isAdmin"
                              checked={selectedEmployee.isAdmin}
                              onChange={handleEmployeeInputChange}
                              className="w-4 h-4"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <label htmlFor="disabledEdit" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                              Disabled
                            </label>
                            <Input
                              type="checkbox"
                              id="disabledEdit"
                              name="disabled"
                              checked={selectedEmployee.disabled}
                              onChange={handleEmployeeInputChange}
                              className="w-4 h-4"
                            />
                          </div>
                          <Button type="submit">Update Employee</Button>
                          <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Employees Monitoring Tab */}
          <TabsContent value="active">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Active Employees Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeEmployees.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No active employees</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeEmployees.map((status, index) => (
                      <Card key={index} className="overflow-hidden">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2">
                          <User className="h-4 w-4" />
                          <CardTitle className="text-base">{getEmployeeName(status.employeeId)}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <div className="flex justify-between items-center">
                            <Badge variant={status.status === "online" ? "default" : "secondary"}>
                              {status.status}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Clock className="h-3 w-3" />
                              {getActiveTime(status)}
                            </div>
                          </div>
                          {status.clockInTime && (
                            <div className="mt-2 text-xs text-gray-500">
                              Clocked in at: {format(status.clockInTime.toDate(), 'h:mm a, MMM dd')}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Attendance History</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchAttendanceHistory}>
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2">Employee Attendance Records</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map(employee => (
                      <Card key={employee.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" 
                        onClick={() => handleViewEmployeeAttendance(employee)}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <User className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium">{employee.name}</p>
                            <p className="text-sm text-gray-500">{employee.employeeId}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                <h3 className="text-lg font-medium mb-2">Recent Activity</h3>
                {attendanceHistory.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No history found</p>
                ) : (
                  <div className="space-y-1">
                    {attendanceHistory.map(record => (
                      <div key={record.id} className="flex justify-between border-b py-2">
                        <span className="capitalize">
                          {record.employeeId} - {record.eventType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-gray-500">
                          {record.timestamp.toDate().toLocaleString()}
                        </span>
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
                <CardTitle>Manage Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateMessage} className="grid gap-4">
                  <Input
                    type="text"
                    name="sender"
                    placeholder="Sender"
                    value={newMessage.sender}
                    onChange={handleMessageInputChange}
                  />
                  <textarea
                    name="message"
                    placeholder="Message"
                    value={newMessage.message}
                    onChange={handleMessageInputChange}
                    className="flex h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                  <Button type="submit">Create Message</Button>
                </form>
                <div className="mt-4 divide-y divide-gray-200">
                  {messages.map(message => (
                    <div key={message.id} className="py-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{message.sender}</span>
                        <span className="text-sm text-gray-500">
                          {message.timestamp.toDate().toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1">{message.message}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Employee Attendance Dialog */}
      {selectedAttendanceEmployee && (
        <EmployeeAttendanceDialog 
          isOpen={isAttendanceDialogOpen}
          onClose={() => setIsAttendanceDialogOpen(false)}
          employee={selectedAttendanceEmployee}
        />
      )}
    </div>
  );
};

export default AdminPanel;
