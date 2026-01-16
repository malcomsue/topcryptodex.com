import AppLayout from '../../components/AppLayout';
import WithdrawPage from '../../views/WithdrawPage';

export const metadata = {
  title: 'Withdraw | TopCryptoDex',
};

export default function Page() {
  return (
    <AppLayout showFooter={false}>
      <WithdrawPage />
    </AppLayout>
  );
}
