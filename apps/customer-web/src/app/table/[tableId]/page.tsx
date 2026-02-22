import { Suspense } from 'react';
import { TableLanding } from '@/components/table/table-landing';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface PageProps {
  params: {
    tableId: string;
  };
  searchParams: {
    token?: string;
  };
}

export default function TablePage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TableLanding tableId={params.tableId} token={searchParams.token} />
    </Suspense>
  );
}
