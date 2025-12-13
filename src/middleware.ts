import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// x402 Middleware - handles payment verification for protected routes
export function middleware(request: NextRequest) {
  // Check for x402 payment header
  const paymentProof = request.headers.get('X-Payment-Proof');

  // Protected API routes that require payment
  const protectedRoutes = ['/api/game/start', '/api/game/play'];

  if (protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    if (!paymentProof) {
      // Return 402 Payment Required
      return new NextResponse(
        JSON.stringify({
          error: 'Payment Required',
          message: 'Please pay the entry fee to access this resource',
          paymentEndpoint: '/api/pay-entry',
        }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Required': 'true',
            'X-Payment-Endpoint': '/api/pay-entry',
          },
        }
      );
    }

    // In production, verify the payment proof here
    // For demo, we accept any proof
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
