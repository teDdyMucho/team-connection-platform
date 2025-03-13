
import { useEffect, useState } from "react";
import { app, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);

  useEffect(() => {
    if (app) {
      setIsFirebaseInitialized(true);
      console.log("Firebase initialized successfully");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-[350px]">
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
