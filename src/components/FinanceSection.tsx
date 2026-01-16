import { TrendingUp, ArrowRight } from 'lucide-react';

export default function FinanceSection() {
  return (
    <section id="finance" className="py-16 bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">Finance</h2>

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  The Highest Annualized Returns
                </h3>
                <p className="text-gray-600 text-sm">Maximize your earnings with our top APR rates</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="text-green-600" size={20} />
                  <span className="text-sm text-gray-600">7 Days APR</span>
                </div>
                <div className="text-3xl font-bold text-green-600">18.9%</div>
              </div>

              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="text-green-600" size={20} />
                  <span className="text-sm text-gray-600">30 Days APR</span>
                </div>
                <div className="text-3xl font-bold text-green-600">19.8%</div>
              </div>
            </div>

            <button className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition font-medium flex items-center justify-center space-x-2">
              <span>Explore</span>
              <ArrowRight size={20} />
            </button>
          </div>

          <div className="relative bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-2xl p-8 overflow-hidden shadow-lg">
            <div className="relative z-10">
              <div className="inline-block bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-sm font-bold mb-4">
                NEW
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Mysterious Investment</h3>
              <p className="text-white/90 mb-6">
                Discover exclusive investment opportunities with high returns
              </p>

              <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/80 text-sm">Estimated Return</span>
                  <span className="text-white font-bold">$2.5-10,000.00</span>
                </div>
              </div>

              <button className="w-full py-3 bg-white text-blue-600 rounded-full hover:bg-gray-100 transition font-medium">
                Invest Now
              </button>
            </div>

            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
