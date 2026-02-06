import { cookies } from 'next/headers';
import AppLayout from '../../components/AppLayout';
import AdminUsersPage from '../../views/AdminUsersPage';

export const metadata = {
  title: 'Admin | TopCryptoDex',
};

const ADMIN_COOKIE = 'admin_auth';

function AdminLoginForm() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form
        method="post"
        action="/api/admin/login"
        className="w-full max-w-sm bg-white border border-gray-100 rounded-2xl p-6 space-y-4"
      >
        <h1 className="text-2xl font-semibold text-gray-900">Admin Login</h1>
        <p className="text-sm text-gray-600">
          Enter the admin password to access the dashboard.
        </p>
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Password</label>
          <input
            type="password"
            name="token"
            placeholder="Admin token"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full py-3 rounded-lg bg-black text-white text-sm font-semibold"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  return (
    <AppLayout>
      {token ? <AdminUsersPage /> : <AdminLoginForm />}
    </AppLayout>
  );
}
