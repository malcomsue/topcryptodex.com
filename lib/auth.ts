import { PrivyClient } from '@privy-io/node';

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;

let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    if (!privyAppId || !privyAppSecret) {
      throw new Error('Missing PRIVY_APP_ID or PRIVY_APP_SECRET environment variables');
    }
    privyClient = new PrivyClient({
      appId: privyAppId,
      appSecret: privyAppSecret,
    });
  }
  return privyClient;
}

export interface AuthResult {
  userId: string;
}

/**
 * Verify Privy JWT and extract user_id from the Authorization header
 * @param request - The incoming request with Authorization header
 * @returns AuthResult with userId
 * @throws Error if token is missing, invalid, or expired
 */
export async function verifyAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    const client = getPrivyClient();
    const verifiedClaims = await client.utils().auth().verifyAccessToken(token);

    return {
      userId: verifiedClaims.user_id,
    };
  } catch (error: any) {
    throw new Error(error?.message || 'Invalid or expired token');
  }
}

/**
 * Helper to create a 401 Unauthorized JSON response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
