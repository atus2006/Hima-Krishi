import React from 'react';
import { supabaseServer } from '../../../lib/supabaseServer';
import Link from 'next/link';

type Farmer = {
  id: string;
  name: string;
  village: string;
  district?: string;
  crop: string;
  quantity_kg: number;
  ready_date: string | null;
  phone?: string | null;
  certification_status?: string;
  created_at?: string;
};

function formatReady(dateStr?: string | null) {
  if (!dateStr) return 'Ready: TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function FarmPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const { data, error } = await supabaseServer.from('farmers').select('*').eq('id', id).single();
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">Not found</div>
    );
  }

  const farmer: Farmer = data as Farmer;
  const qrUrl = `${process.env.SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/public/qrcodes/${encodeURIComponent(String(farmer.id))}.png`;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="max-w-4xl mx-auto py-8 px-4">
        <Link href="/" className="text-2xl font-bold text-[#2C7A4B]">Hima Krishi</Link>
        <p className="text-sm text-gray-600">Sikkim's Certified Organic Marketplace</p>
      </header>

      <main className="max-w-4xl mx-auto p-4 grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h1 className="text-2xl font-extrabold text-[#1A3C2E]">{farmer.name}</h1>
          <div className="text-sm text-gray-600">{farmer.village}, {farmer.district || 'Sikkim'}</div>
          <div className="mt-2">
            <div className="text-sm text-gray-500">Crop</div>
            <div className="text-lg font-medium">{farmer.crop}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Quantity</div>
            <div className="text-lg font-medium">{farmer.quantity_kg} kg</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{formatReady(farmer.ready_date)}</div>
          </div>

          <div className="mt-4">
            <span className="inline-block bg-[#2C7A4B] text-white px-3 py-1 rounded">{farmer.certification_status || 'Sikkim Organic Mission Certified'}</span>
          </div>

          <div className="mt-6">
            {farmer.phone ? (
              <a href={`https://wa.me/${farmer.phone.replace(/[^0-9]/g, '')}`} className="inline-block bg-[#2C7A4B] text-white px-4 py-2 rounded">Contact on WhatsApp</a>
            ) : (
              <button disabled className="inline-block bg-gray-300 text-gray-600 px-4 py-2 rounded">No contact available</button>
            )}
          </div>
        </section>

        <section>
          <div className="border rounded-lg p-4 flex flex-col items-center">
            <img src={qrUrl} alt="QR code" className="w-64 h-64 object-contain" />
            <div className="mt-3 text-sm text-gray-600">Scan to view listing</div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold">Certification Details</h3>
            <p className="text-sm text-gray-600">{farmer.certification_status || 'Sikkim Organic Mission Certified'}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
