import { NextRequest, NextResponse } from 'next/server';
import { getCardById, cardOps, updateCardPayment } from '@/lib/db';
import { checkWin, WinPattern } from '@/lib/bingo';

// GET - Get card by ID and optionally verify bingo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const calledNumbersParam = searchParams.get('calledNumbers');
    const pattern = (searchParams.get('pattern') || 'line') as WinPattern;

    const card = getCardById(id);

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const numbers = JSON.parse(card.numbers);

    // If calledNumbers provided, verify bingo
    if (calledNumbersParam) {
      const calledNumbers = JSON.parse(calledNumbersParam) as number[];

      // Create marked array based on called numbers
      const marked = numbers.map((row: (number | null)[]) =>
        row.map((num: number | null) => num === null || calledNumbers.includes(num as number))
      );

      const hasBingo = checkWin({ id: card.id, numbers, marked }, pattern);

      // Find which numbers have been called
      const markedNumbers: number[] = [];
      for (const row of numbers) {
        for (const num of row) {
          if (num !== null && calledNumbers.includes(num)) {
            markedNumbers.push(num);
          }
        }
      }

      return NextResponse.json({
        card: {
          ...card,
          numbers,
        },
        verification: {
          hasBingo,
          pattern,
          markedNumbers,
          totalNumbers: numbers.flat().filter((n: number | null) => n !== null).length,
          calledCount: markedNumbers.length,
        }
      });
    }

    return NextResponse.json({
      card: {
        ...card,
        numbers,
      }
    });
  } catch (error) {
    console.error('Error fetching card:', error);
    return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 });
  }
}

// PATCH - Update card payment status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { paymentStatus, txHash } = body;

    const card = getCardById(id);
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    updateCardPayment(id, paymentStatus, txHash);

    return NextResponse.json({
      success: true,
      message: 'Card updated'
    });
  } catch (error) {
    console.error('Error updating card:', error);
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
  }
}

// DELETE - Delete a specific card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const card = getCardById(id);
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    cardOps.delete.run(id);

    return NextResponse.json({
      success: true,
      message: 'Card deleted'
    });
  } catch (error) {
    console.error('Error deleting card:', error);
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
  }
}
