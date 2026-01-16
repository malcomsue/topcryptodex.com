/*
  # Create Cryptocurrency Trading Platform Schema

  1. New Tables
    - `cryptocurrencies`
      - `id` (uuid, primary key)
      - `symbol` (text, unique) - e.g., "BTC", "ETH"
      - `name` (text) - full name
      - `icon_color` (text) - hex color for icon background
      - `current_price` (decimal) - current price in USD
      - `price_change_24h` (decimal) - 24h price change percentage
      - `market_cap` (bigint) - market capitalization
      - `volume_24h` (bigint) - 24h trading volume
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `user_profiles`
      - `id` (uuid, primary key, references auth.users)
      - `username` (text, unique)
      - `full_name` (text)
      - `avatar_url` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `educational_content`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `image_url` (text)
      - `category` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Public read access for cryptocurrencies and educational content
*/

-- Create cryptocurrencies table
CREATE TABLE IF NOT EXISTS cryptocurrencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text UNIQUE NOT NULL,
  name text NOT NULL,
  icon_color text DEFAULT '#3b82f6',
  current_price decimal(20, 2) NOT NULL,
  price_change_24h decimal(10, 2) NOT NULL,
  market_cap bigint DEFAULT 0,
  volume_24h bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create educational_content table
CREATE TABLE IF NOT EXISTS educational_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE cryptocurrencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE educational_content ENABLE ROW LEVEL SECURITY;

-- Policies for cryptocurrencies (public read, admin write)
CREATE POLICY "Anyone can view cryptocurrencies"
  ON cryptocurrencies FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated users can insert cryptocurrencies"
  ON cryptocurrencies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cryptocurrencies"
  ON cryptocurrencies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for user_profiles
CREATE POLICY "Users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policies for educational_content (public read)
CREATE POLICY "Anyone can view educational content"
  ON educational_content FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated users can insert educational content"
  ON educational_content FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert sample cryptocurrency data
INSERT INTO cryptocurrencies (symbol, name, icon_color, current_price, price_change_24h, market_cap) VALUES
  ('BTC', 'Bitcoin', '#F7931A', 97381.21, -2.15, 1920000000000),
  ('ETH', 'Ethereum', '#627EEA', 31118.37, -1.98, 375000000000),
  ('USDT', 'Tether', '#26A17B', 1.00, 0.01, 120000000000),
  ('BNB', 'Binance', '#F3BA2F', 690.12, -3.24, 98000000000),
  ('SOL', 'Solana', '#14F195', 240.88, 5.67, 110000000000),
  ('XRP', 'Ripple', '#23292F', 2.31, -1.45, 130000000000),
  ('USDC', 'USD Coin', '#2775CA', 1.00, 0.00, 42000000000),
  ('ADA', 'Cardano', '#0033AD', 1.08, -2.87, 38000000000),
  ('AVAX', 'Avalanche', '#E84142', 52.45, 4.23, 21000000000),
  ('DOGE', 'Dogecoin', '#C2A633', 0.42, -1.56, 62000000000)
ON CONFLICT (symbol) DO NOTHING;

-- Insert sample educational content
INSERT INTO educational_content (title, description, category) VALUES
  ('When is the best time to invest in crypto?', 'Learn about market cycles and timing your investments for maximum returns.', 'investment'),
  ('Understanding Bitcoin''s Technology & Potential: A Comprehensive Guide', 'Deep dive into blockchain technology and Bitcoin''s revolutionary potential.', 'technology'),
  ('How to buy Bitcoin: A step by step guide for beginners', 'Complete beginner-friendly guide to purchasing your first Bitcoin.', 'tutorial'),
  ('Navigating Crypto Taxes: What You Need to Know', 'Essential information about cryptocurrency taxation and reporting.', 'finance')
ON CONFLICT DO NOTHING;