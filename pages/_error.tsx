import type { NextPageContext } from 'next';

type ErrorProps = {
  statusCode?: number;
};

export default function Error({ statusCode }: ErrorProps) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
      <p style={{ marginTop: 8 }}>
        {statusCode ? `Error ${statusCode}` : 'An unexpected error occurred.'}
      </p>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

