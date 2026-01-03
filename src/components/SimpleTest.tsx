'use client';

import React, { useState, useEffect } from 'react';

const SimpleTest: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    console.log('SimpleTest mounted!');
    setMounted(true);
    
    // Load data from API
    fetch('/api/data')
      .then(response => response.json())
      .then(result => {
        console.log('API result:', result);
        setData(result);
      })
      .catch(error => {
        console.error('API error:', error);
      });
  }, []);

  if (!mounted) {
    return <div>Loading test component...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Simple Test Component</h1>
      <p>Component mounted: {mounted ? 'Yes' : 'No'}</p>
      <p>Data loaded: {data ? 'Yes' : 'No'}</p>
      {data && (
        <div className="mt-4">
          <p>API Success: {data.success ? 'Yes' : 'No'}</p>
          <p>Companies: {data.data?.length || 0}</p>
          <p>Total Updates: {data.data?.reduce((sum: number, c: any) => sum + (c.updates?.length || 0), 0) || 0}</p>
        </div>
      )}
    </div>
  );
};

export default SimpleTest; 