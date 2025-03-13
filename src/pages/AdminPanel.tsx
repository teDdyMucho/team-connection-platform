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
  Timestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, AttendanceRecord, Message } from "@/types/employee";
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

const AdminPanel = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchEmployees();
    fetchAttendanceHistory();
    fetchMessages();
  }, []);

  const fetchEmployees = async () => {
    try {
      const q = query(collection(db, "employees"));
      const querySnapshot = await getDocs(q);
      const emps: Employee[] = [];
      querySnapshot.forEach((doc) => {
        emps.push({ id: doc.id, ...doc.data() } as Employee);
      });
      setEmployees(emps);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target;
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

  const handleDeleteEmployee = async (id: string) => {
    try {
      await deleteDoc(doc(db, "employees", id));
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
    }
  };

  const handleEmployeeInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target;
    setSelectedEmployee(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }) as Employee);
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
                        onInput={handleInputChange}
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
                        onInput={handleInputChange}
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
                              onInput={handleEmployeeInputChange}
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
                              onInput={handleEmployeeInputChange}
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
                          {new Date(record.timestamp.seconds * 1000).toLocaleString()}
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
                  <Input
                    as="textarea"
                    name="message"
                    placeholder="Message"
                    value={newMessage.message}
                    onChange={handleMessageInputChange}
                  />
                  <Button type="submit">Create Message</Button>
                </form>
                <div className="mt-4 divide-y divide-gray-200">
                  {messages.map(message => (
                    <div key={message.id} className="py-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{message.sender}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(message.timestamp.seconds * 1000).toLocaleString()}
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
    </div>
  );
};

export default AdminPanel;
