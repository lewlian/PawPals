// Dog sizes for validation
export const DOG_SIZES = ['Small', 'Medium', 'Large'] as const;
export type DogSize = (typeof DOG_SIZES)[number];

// Common dog breeds in Singapore, alphabetically sorted
// "Singapore Special" and "Other / Mixed" at end for easy access
export const DOG_BREEDS = [
  'Beagle',
  'Bichon Frise',
  'Border Collie',
  'Cavalier King Charles Spaniel',
  'Chihuahua',
  'Cocker Spaniel',
  'Corgi',
  'Dachshund',
  'Dalmatian',
  'French Bulldog',
  'German Shepherd',
  'Golden Retriever',
  'Husky',
  'Jack Russell Terrier',
  'Japanese Spitz',
  'Labrador Retriever',
  'Maltese',
  'Miniature Pinscher',
  'Miniature Schnauzer',
  'Papillon',
  'Pekingese',
  'Pomeranian',
  'Poodle (Miniature)',
  'Poodle (Standard)',
  'Poodle (Toy)',
  'Pug',
  'Rottweiler',
  'Samoyed',
  'Schnauzer',
  'Shetland Sheepdog',
  'Shiba Inu',
  'Shih Tzu',
  'Siberian Husky',
  'Silky Terrier',
  'Yorkshire Terrier',
  // Special entries at end
  'Singapore Special',
  'Other / Mixed',
] as const;

export type DogBreed = (typeof DOG_BREEDS)[number];

/**
 * Search breeds by partial name match (case-insensitive)
 * @param query - Search string
 * @returns Matching breed names
 */
export function searchBreeds(query: string): string[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    return [...DOG_BREEDS];
  }

  return DOG_BREEDS.filter((breed) =>
    breed.toLowerCase().includes(normalizedQuery)
  );
}
