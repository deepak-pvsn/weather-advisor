import { NextResponse } from 'next/server';
import { sessionMemory } from '../weather/route';

// Simple in-memory store for memory - this should match the one in weather route
const memoryStore = new Map();

// Function to clear memory
function clearMemory(sessionId) {
  sessionMemory.delete(sessionId);
  return true;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId } = body;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }
    
    clearMemory(sessionId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing memory:", error);
    return NextResponse.json({ 
      error: 'Failed to clear conversation memory',
      details: error.message 
    }, { status: 500 });
  }
} 