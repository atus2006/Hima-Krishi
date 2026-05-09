import React from 'react';
import Link from 'next/link';
import { supabaseServer } from '../lib/supabaseServer';

type Farmer = {
  id: string;
  name: string;
  village: string;
  crop: string;
  quantity_kg: number;
  ready_date: string | null;
  certification_status?: string;
};

function formatReady(dateStr?: string | null) {
  if (!dateStr) return 'Ready: TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, ' ');
}

export default async function Page() {
  const { data, error } = await supabaseServer
    .from('farmers')
    .select('id, name, village, crop, quantity_kg, ready_date, certification_status')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const farmers: Farmer[] = Array.isArray(data) ? data : [];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-[#2C7A4B]">Hima Krishi</h1>
            <p className="text-sm text-[#1A3C2E]">Sikkim's Certified Organic Marketplace</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-12">
        {farmers.length === 0 ? (
          <div className="text-center py-16 text-gray-600">No listings yet. Check back soon.</div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {farmers.map((f) => (
              <article key={f.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1A3C2E]">{f.name}</h2>
                    <p className="text-sm text-gray-600">{f.village}, Sikkim</p>
                  </div>
                  <span className="inline-flex items-center bg-[#2C7A4B] text-white text-xs px-2 py-1 rounded">{f.certification_status || 'Sikkim Organic Mission Certified'}</span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C12 2 16 6 12 12C8 18 12 22 12 22C12 22 20 14 12 2Z" fill="#2C7A4B" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium">{f.crop}</div>
                      <div className="text-xs text-gray-500">{f.quantity_kg ?? 0} kg available</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">{formatReady(f.ready_date)}</div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <Link href={`/farm/${f.id}`} className="inline-block bg-[#C8991A] text-white px-3 py-2 rounded text-sm">View Trace</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
