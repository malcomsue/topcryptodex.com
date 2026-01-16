import AppLayout from '../../components/AppLayout';
import HistoryPage from '../../views/HistoryPage';

export const metadata = {
  title: 'History | TopCryptoDex',
};

export default function Page() {
  return (
    <AppLayout showFooter={false}>
      <HistoryPage />
    </AppLayout>
  );
}
