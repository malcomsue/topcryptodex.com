import RegisterPage from '../../views/RegisterPage';
import { Suspense } from 'react';

export const metadata = {
  title: 'Register | TopCryptoDex',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterPage />
    </Suspense>
  );
}
