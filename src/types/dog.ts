export const DOG_SIZES = ['Small', 'Medium', 'Large'] as const;
export type DogSize = (typeof DOG_SIZES)[number];

export interface Dog {
  id: number;
  userId: number;
  name: string;
  size: DogSize;
  breed: string;
  age: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDogInput {
  name: string;
  size: DogSize;
  breed: string;
  age: number;
}

export interface UpdateDogInput {
  name?: string;
  size?: DogSize;
  breed?: string;
  age?: number;
}
