export default async (request: Request) => {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Allow: 'GET',
      },
    });
  }

  const apiKey = Netlify.env.get('NOODLES_API_KEY');
  const apiUrl = Netlify.env.get('NOODLES_API_URL');

  if (!apiKey || !apiUrl) {
    return new Response(
      JSON.stringify({ error: 'Market data is not configured' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }

  try {
    const upstream = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey,
        'x-chain': 'sui',
      },
    });

    const body = await upstream.text();
    const contentType =
      upstream.headers.get('content-type') ||
      'application/json; charset=utf-8';

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': upstream.ok
          ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
          : 'no-store',
      },
    });
  } catch (error) {
    console.error('TREE market-data proxy failed', error);
    return new Response(JSON.stringify({ error: 'Market data unavailable' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
};

export const config = {
  path: '/api/tree-market',
};
