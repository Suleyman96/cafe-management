import { MenuScreen } from '@/components/menu/menu-screen';

interface PageProps {
  params: {
    tableId: string;
  };
}

export default function MenuPage({ params }: PageProps) {
  return <MenuScreen tableId={params.tableId} />;
}
