import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const Index = () => {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const currentEmployee = { 
        employeeId, 
        name: empData.name,
        isAdmin: empData.isAdmin || false
      };
      // Save current employee info in localStorage
      localStorage.setItem("currentEmployee", JSON.stringify(currentEmployee));
      navigate("/employee");
    } catch (error: any) {
      console.error("Login error:", error);
      setLoginError("An error occurred during login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <form onSubmit={handleLogin} className="max-w-md w-full space-y-4">
        <h1 className="text-3xl font-bold text-center">Employee Login</h1>
        <input 
          type="text" 
          placeholder="Employee ID" 
          value={employeeId} 
          onChange={(e) => setEmployeeId(e.target.value)} 
          className="w-full p-2 border rounded"
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          className="w-full p-2 border rounded"
        />
        {loginError && <p className="text-red-500 text-center">{loginError}</p>}
        <button type="submit" className="w-full p-2 bg-blue-600 text-white rounded">
          Login
        </button>
      </form>
    </div>
  );
};

export default Index;
