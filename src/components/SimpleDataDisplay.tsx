'use client';

import { useEffect, useState } from 'react';

export default function SimpleDataDisplay() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Force client-side rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    console.log('SimpleDataDisplay: Starting API fetch...');
    
    fetch('/api/data')
      .then(res => res.json())
      .then(result => {
        console.log('SimpleDataDisplay: API result:', result);
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('SimpleDataDisplay: Error:', err);
        setLoading(false);
      });
  }, [mounted]);

  if (!mounted) {
    return <div>Mounting...</div>;
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">LaunchRadar - Simple Test</h1>
        <p>Loading data...</p>
      </div>
    );
  }

  const totalUpdates = data?.data?.reduce((total: number, company: any) => 
    total + (company.updates?.length || 0), 0) || 0;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">LaunchRadar - Working!</h1>
      <div className="bg-green-100 p-4 rounded mb-4">
        <p className="text-green-800">✅ Successfully loaded {totalUpdates} updates!</p>
      </div>
      
      <div className="space-y-4">
        {data?.data?.map((company: any, index: number) => (
          <div key={index} className="border p-4 rounded">
            <h3 className="font-bold">{company.competitor}</h3>
            <p className="text-sm text-gray-600">{company.updates?.length || 0} updates</p>
            {company.updates?.slice(0, 3).map((update: any, updateIndex: number) => (
              <div key={updateIndex} className="ml-4 mt-2 text-sm">
                • {update.title}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
} 