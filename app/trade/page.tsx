import AppLayout from '../../components/AppLayout';
import TradePage from '../../views/TradePage';

export const metadata = {
  title: 'Trade | TopCryptoDex',
};

export default function Page() {
  return (
    <AppLayout showFooter={false}>
      <TradePage />
    </AppLayout>
  );
}
