
import { useEffect, useState } from "react";
import { app, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const Index = () => {
  const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);

  useEffect(() => {
    if (app) {
      setIsFirebaseInitialized(true);
      console.log("Firebase initialized successfully");
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-8">Company Employee System</h1>
      
      <div className="grid gap-4 w-full max-w-md">
        <Link to="/employee" className="w-full">
          <Button className="w-full h-16 text-lg" variant="default">
            Employee Panel
          </Button>
        </Link>
        
        <Link to="/admin" className="w-full">
          <Button className="w-full h-16 text-lg" variant="outline">
            Admin Panel
          </Button>
        </Link>
      </div>
      
      <Card className="w-full max-w-md mt-8">
        <CardHeader>
          <CardTitle>Firebase Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${isFirebaseInitialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <p>Firebase: {isFirebaseInitialized ? 'Connected' : 'Disconnected'}</p>
            </div>
            <Button className="w-full" onClick={() => console.log("Firebase app:", app)}>
              Test Firebase Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
