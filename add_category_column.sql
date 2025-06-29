-- Add category column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN category VARCHAR(50) DEFAULT 'shopping' 
CHECK (category IN ('shopping', 'travel', 'entertainment', 'finance', 'other'));

-- Update existing records to have a default category
UPDATE campaigns 
SET category = 'shopping' 
WHERE category IS NULL;