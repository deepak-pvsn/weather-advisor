import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    apiKeyConfigured: !!process.env.OPENROUTER_API_KEY,
    appUrl: process.env.APP_URL || 'Not configured',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
} 