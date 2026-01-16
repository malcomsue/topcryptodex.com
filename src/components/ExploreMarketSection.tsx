import { LineChart, Zap, Settings } from 'lucide-react';

const features = [
  {
    Icon: LineChart,
    title: 'Spot',
    description: 'Buy and sell crypto assets with real-time prices and low fees.',
  },
  {
    Icon: Zap,
    title: 'Perpetual contract',
    description: 'Trade futures contracts with leverage and advanced order types.',
  },
  {
    Icon: Settings,
    title: 'Options',
    description: 'Hedge your portfolio and create options trading strategies.',
  },
];

export default function ExploreMarketSection() {
  return (
    <section id="trade" className="py-16 bg-white">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Explore the market</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Our cryptocurrency market is flourishing, encompassing digital currencies and the
              infrastructure that empowers digital payments, providing seamless, secure transactions
              for a connected world.
            </p>

            <div className="space-y-6 mb-8">
              {features.map((feature) => (
                <div key={feature.title} className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.Icon className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{feature.title}</h3>
                    <p className="text-gray-600 text-sm">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <button className="px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition font-medium">
              Explore Markets
            </button>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-3xl p-8 h-96 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 bg-white rounded-full shadow-lg flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="text-blue-600" size={64} />
                </div>
                <p className="text-gray-600 font-medium">Interactive Trading Interface</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrendingUp({ className, size }: { className: string; size: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
