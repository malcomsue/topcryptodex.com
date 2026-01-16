import AppLayout from '../../components/AppLayout';
import MarketPage from '../../views/MarketPage';

export const metadata = {
  title: 'Markets | TopCryptoDex',
};

export default function Page() {
  return (
    <AppLayout>
      <MarketPage />
    </AppLayout>
  );
}
