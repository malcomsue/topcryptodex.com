import AppLayout from '../../components/AppLayout';
import DepositPage from '../../views/DepositPage';

export const metadata = {
  title: 'Deposit | TopCryptoDex',
};

export default function Page() {
  return (
    <AppLayout showFooter={false}>
      <DepositPage />
    </AppLayout>
  );
}
