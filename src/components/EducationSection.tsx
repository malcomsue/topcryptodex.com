'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { supabase, EducationalContent } from '../lib/supabase';

export default function EducationSection() {
  const [content, setContent] = useState<EducationalContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEducationalContent();
  }, []);

  const loadEducationalContent = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('educational_content')
      .select('*')
      .limit(4);

    if (!error && data) {
      setContent(data);
    }
    setLoading(false);
  };

  return (
    <>
      <section className="py-16 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 text-center">
            Everyone can use digital currency
          </h2>
          <p className="text-gray-600 text-center mb-12 w-full">
            Cryptocurrency is accessible to everyone. From beginners to experts, our platform
            provides the tools and knowledge you need to succeed.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-cyan-100 to-blue-100 rounded-2xl p-8 h-80 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🏄‍♂️</div>
                <p className="text-gray-700 font-medium">
                  Navigate the crypto waves with confidence
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-8 h-80 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📱</div>
                <p className="text-gray-700 font-medium">Trade anytime, anywhere with our mobile app</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="learn" className="py-16 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-12 text-center">
            Learn about cryptocurrency
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {content.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition group cursor-pointer"
                >
                  <div className="h-48 bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <BookOpen className="text-white" size={64} />
                  </div>
                  <div className="p-6">
                    <div className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold mb-3">
                      {item.category}
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <button className="text-blue-600 hover:text-blue-700 font-medium">View More</button>
          </div>
        </div>
      </section>
    </>
  );
}
