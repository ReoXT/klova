// Temporary page — proves the Next.js → Express → Supabase chain works.
// Delete this page and the connection_test table once confirmed.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Row {
  id: number;
  message: string;
  created_at: string;
}

interface DbTestResponse {
  ok: boolean;
  rows: Row[];
}

async function fetchDbTest(): Promise<DbTestResponse> {
  const res = await fetch(`${API_URL}/db-test`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

export default async function DbTestPage() {
  let data: DbTestResponse | null = null;
  let error: string | null = null;

  try {
    data = await fetchDbTest();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '640px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
        🔗 Next.js → Express → Supabase round-trip test
      </h1>

      <p style={{ marginBottom: '0.5rem', color: '#666' }}>
        API: <code>{API_URL}/db-test</code>
      </p>

      {error ? (
        <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: '0.5rem', color: '#991b1b' }}>
          <strong>Error:</strong> {error}
        </div>
      ) : (
        <div style={{ background: '#dcfce7', padding: '1rem', borderRadius: '0.5rem', color: '#166534' }}>
          <strong>✓ Connected</strong>
          <pre style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}
