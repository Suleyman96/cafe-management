'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { FAQ_ITEMS } from '@/lib/constants';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg text-gray-600">Everything you need to know about Gustri.</p>
        </div>

        <div className="mt-12 divide-y divide-gray-200">
          {FAQ_ITEMS.map((item, i) => (
            <div key={item.question} className="py-5">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-base font-medium text-gray-900">{item.question}</span>
                <ChevronDown
                  className={`h-5 w-5 text-gray-400 shrink-0 ml-4 transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === i && (
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.answer}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
