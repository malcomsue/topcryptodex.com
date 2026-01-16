import AppLayout from '../../components/AppLayout';
import TransferPage from '../../views/TransferPage';

export const metadata = {
  title: 'Transfer | TopCryptoDex',
};

export default function Page() {
  return (
    <AppLayout showFooter={false}>
      <TransferPage />
    </AppLayout>
  );
}
