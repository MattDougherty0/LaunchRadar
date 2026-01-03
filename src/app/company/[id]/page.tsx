import { notFound } from 'next/navigation';
import CompanyPage from '@/components/CompanyPage';

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Await params in Next.js 15
  const { id } = await params;
  
  // Pass the company ID to the CompanyPage component
  return <CompanyPage companyId={id} />;
} 