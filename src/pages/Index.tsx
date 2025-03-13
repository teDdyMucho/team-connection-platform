import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const Login = () => {
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
      // On successful login, navigate to the EmployeePanel page.
      navigate("/employee");
    } catch (error: any) {
      console.error("Login error:", error);
      setLoginError("An error occurred during login");
    }
  };

  return (
    <form onSubmit={handleLogin} style={{ maxWidth: "400px", margin: "0 auto" }}>
      <h2>Employee Login</h2>
      <input
        type="text"
        placeholder="Employee ID"
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: "1rem", padding: "8px" }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: "1rem", padding: "8px" }}
      />
      {loginError && <div style={{ color: "red", marginBottom: "1rem" }}>{loginError}</div>}
      <button type="submit" style={{ padding: "10px 20px" }}>Login</button>
    </form>
  );
};

export default Login;
