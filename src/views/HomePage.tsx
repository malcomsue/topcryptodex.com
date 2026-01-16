import EducationSection from '../components/EducationSection';
import ExploreMarketSection from '../components/ExploreMarketSection';
import FAQSection from '../components/FAQSection';
import FinanceSection from '../components/FinanceSection';
import GettingStartedSection from '../components/GettingStartedSection';
import HeroSection from '../components/HeroSection';
import MarketsSection from '../components/MarketsSection';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <HeroSection />
      <MarketsSection />
      <GettingStartedSection />
      <ExploreMarketSection />
      <FinanceSection />
      <EducationSection />
      <FAQSection />
    </div>
  );
}
